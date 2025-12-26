-- Tasks collaboration: contributions + subtasks

-- 1) Contribution roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_contribution_role'
  ) THEN
    CREATE TYPE public.task_contribution_role AS ENUM ('primary','secondary','coordinator');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.task_contribution_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, role)
);

CREATE INDEX IF NOT EXISTS task_contributions_task_idx ON public.task_contributions(task_id);
CREATE INDEX IF NOT EXISTS task_contributions_user_idx ON public.task_contributions(user_id);

ALTER TABLE public.task_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_contributions_select ON public.task_contributions;
CREATE POLICY task_contributions_select ON public.task_contributions
FOR SELECT TO authenticated
USING (public.is_marketing_team());

-- Owners (task assignee or creator) + CMO can manage; assignees of subtasks will be handled separately
DROP POLICY IF EXISTS task_contributions_write ON public.task_contributions;
CREATE POLICY task_contributions_write ON public.task_contributions
FOR ALL TO authenticated
USING (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
      )
  )
);

DROP TRIGGER IF EXISTS set_task_contributions_updated_at ON public.task_contributions;
CREATE TRIGGER set_task_contributions_updated_at
BEFORE UPDATE ON public.task_contributions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Subtasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_subtask_status'
  ) THEN
    CREATE TYPE public.task_subtask_status AS ENUM ('todo','in_progress','done','dropped');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  title text NOT NULL,
  status public.task_subtask_status NOT NULL DEFAULT 'todo',
  assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  due_at date,
  effort_points int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_subtasks_task_idx ON public.task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS task_subtasks_assignee_idx ON public.task_subtasks(assignee_id);

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_subtasks_select ON public.task_subtasks;
CREATE POLICY task_subtasks_select ON public.task_subtasks
FOR SELECT TO authenticated
USING (public.is_marketing_team());

-- Write policy: active marketing roles + either task owner/creator/CMO, or the subtask assignee can update status
DROP POLICY IF EXISTS task_subtasks_write ON public.task_subtasks;
CREATE POLICY task_subtasks_write ON public.task_subtasks
FOR ALL TO authenticated
USING (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND (
    public.current_user_role() = 'cmo'
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_id
        AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
    )
  )
)
WITH CHECK (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND (
    public.current_user_role() = 'cmo'
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_id
        AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
    )
  )
);

DROP TRIGGER IF EXISTS set_task_subtasks_updated_at ON public.task_subtasks;
CREATE TRIGGER set_task_subtasks_updated_at
BEFORE UPDATE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Update scoring function to use contributions if present
-- Replaces award_task_points_on_approval() with a contribution-aware version.
CREATE OR REPLACE FUNCTION public.award_task_points_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.task_weight_config%ROWTYPE;
  approved_date date;
  due_date date;
  days_early int;
  days_late int;
  W int;
  Mp numeric;
  Me numeric;
  Ml numeric;
  base_score numeric;
  final_score numeric;
  week0 date;
  small_cap int;
  small_overcap numeric;
  small_count int;

  primary_id uuid;
  secondary_id uuid;
  coord_id uuid;

  primary_share numeric;
  secondary_share numeric;
  coord_share numeric;

  p_points numeric;
  s_points numeric;
  c_points numeric;
BEGIN
  IF NOT (NEW.approval_state = 'approved' AND (OLD.approval_state IS DISTINCT FROM 'approved')) THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'dropped' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cfg FROM public.task_weight_config WHERE id = 'global';

  approved_date := COALESCE(NEW.approved_at, NEW.completed_at, now())::date;
  due_date := NEW.due_at;
  week0 := public.week_start_monday(approved_date);

  IF NEW.base_weight > 0 THEN
    W := NEW.base_weight;
  ELSE
    CASE NEW.weight_tier
      WHEN 'small' THEN W := cfg.small_points;
      WHEN 'medium' THEN W := cfg.medium_points;
      WHEN 'large' THEN W := cfg.large_points;
      WHEN 'critical' THEN W := cfg.critical_points;
      ELSE W := cfg.small_points;
    END CASE;
  END IF;

  CASE NEW.priority
    WHEN 'p0' THEN Mp := cfg.mp_p0;
    WHEN 'p1' THEN Mp := cfg.mp_p1;
    WHEN 'p2' THEN Mp := cfg.mp_p2;
    WHEN 'p3' THEN Mp := cfg.mp_p3;
    ELSE Mp := 1.0;
  END CASE;

  Me := 1.0;
  Ml := 1.0;
  IF due_date IS NOT NULL THEN
    days_early := (due_date - approved_date);
    days_late := (approved_date - due_date);

    IF days_early >= 3 THEN
      Me := cfg.me_3plus;
    ELSIF days_early >= 1 THEN
      Me := cfg.me_1to2;
    ELSE
      Me := cfg.me_ontime;
    END IF;

    IF days_late BETWEEN 1 AND 2 THEN
      Ml := cfg.ml_1to2;
    ELSIF days_late BETWEEN 3 AND 5 THEN
      Ml := cfg.ml_3to5;
    ELSIF days_late >= 6 THEN
      Ml := cfg.ml_6plus;
    END IF;
  END IF;

  base_score := (W::numeric) * Mp;
  final_score := base_score * Me * Ml;

  -- Small-tier weekly cap guardrail: apply to primary (or fallback primary)
  IF NEW.weight_tier = 'small' THEN
    small_cap := cfg.small_weekly_cap;
    small_overcap := cfg.small_overcap_multiplier;
    SELECT count(*) INTO small_count
    FROM public.task_points_ledger
    WHERE user_id = COALESCE(NEW.assignee_id, NEW.created_by)
      AND week_start = week0
      AND weight_tier = 'small';
    IF small_count >= small_cap THEN
      final_score := final_score * small_overcap;
    END IF;
  END IF;

  -- Load contribution roles if present; else fall back to defaults.
  SELECT c.user_id INTO primary_id
  FROM public.task_contributions c
  WHERE c.task_id = NEW.id AND c.role = 'primary'
  LIMIT 1;

  SELECT c.user_id INTO secondary_id
  FROM public.task_contributions c
  WHERE c.task_id = NEW.id AND c.role = 'secondary'
  LIMIT 1;

  SELECT c.user_id INTO coord_id
  FROM public.task_contributions c
  WHERE c.task_id = NEW.id AND c.role = 'coordinator'
  LIMIT 1;

  IF primary_id IS NULL THEN
    primary_id := COALESCE(NEW.assignee_id, NEW.created_by);
  END IF;

  -- Shares: Primary 65%, Secondary 25%, Coordinator 10%
  primary_share := 0.65;
  secondary_share := 0.25;
  coord_share := 0.10;

  -- If no secondary, roll to primary
  IF secondary_id IS NULL THEN
    primary_share := primary_share + secondary_share;
    secondary_share := 0.0;
  END IF;

  -- If coordinator missing or duplicates, roll shares to primary
  IF coord_id IS NULL THEN
    primary_share := primary_share + coord_share;
    coord_share := 0.0;
  END IF;

  IF coord_share > 0 AND coord_id = primary_id THEN
    primary_share := primary_share + coord_share;
    coord_share := 0.0;
  END IF;

  IF secondary_share > 0 AND secondary_id = primary_id THEN
    primary_share := primary_share + secondary_share;
    secondary_share := 0.0;
  END IF;

  IF coord_share > 0 AND secondary_share > 0 AND coord_id = secondary_id THEN
    -- collapse coordinator into secondary if same person (rare)
    secondary_share := secondary_share + coord_share;
    coord_share := 0.0;
  END IF;

  p_points := round(final_score * primary_share, 2);
  s_points := round(final_score * secondary_share, 2);
  c_points := round(final_score * coord_share, 2);

  IF primary_id IS NOT NULL THEN
    INSERT INTO public.task_points_ledger(user_id, task_id, weight_tier, points_awarded, breakdown, week_start)
    VALUES (
      primary_id,
      NEW.id,
      NEW.weight_tier,
      p_points,
      jsonb_build_object('W', W, 'Mp', Mp, 'Me', Me, 'Ml', Ml, 'final', final_score, 'share', primary_share, 'contribution_role', 'primary'),
      week0
    )
    ON CONFLICT (user_id, task_id) DO NOTHING;
  END IF;

  IF secondary_share > 0 AND secondary_id IS NOT NULL THEN
    INSERT INTO public.task_points_ledger(user_id, task_id, weight_tier, points_awarded, breakdown, week_start)
    VALUES (
      secondary_id,
      NEW.id,
      NEW.weight_tier,
      s_points,
      jsonb_build_object('W', W, 'Mp', Mp, 'Me', Me, 'Ml', Ml, 'final', final_score, 'share', secondary_share, 'contribution_role', 'secondary'),
      week0
    )
    ON CONFLICT (user_id, task_id) DO NOTHING;
  END IF;

  IF coord_share > 0 AND coord_id IS NOT NULL THEN
    INSERT INTO public.task_points_ledger(user_id, task_id, weight_tier, points_awarded, breakdown, week_start)
    VALUES (
      coord_id,
      NEW.id,
      NEW.weight_tier,
      c_points,
      jsonb_build_object('W', W, 'Mp', Mp, 'Me', Me, 'Ml', Ml, 'final', final_score, 'share', coord_share, 'contribution_role', 'coordinator'),
      week0
    )
    ON CONFLICT (user_id, task_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

