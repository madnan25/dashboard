-- Subtasks: add description + simplify status model to 4 stages.
-- Stages: not_done, done, blocked, on_hold

-- 1) New enum type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_subtask_stage'
  ) THEN
    CREATE TYPE public.task_subtask_stage AS ENUM ('not_done','done','blocked','on_hold');
  END IF;
END $$;

-- 2) Add description column
ALTER TABLE public.task_subtasks
  ADD COLUMN IF NOT EXISTS description text;

-- 3) Convert status from task_status -> task_subtask_stage
ALTER TABLE public.task_subtasks
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.task_subtasks
  ALTER COLUMN status TYPE public.task_subtask_stage
  USING (
    CASE status::text
      WHEN 'closed' THEN 'done'
      WHEN 'approved' THEN 'done'
      WHEN 'blocked' THEN 'blocked'
      WHEN 'on_hold' THEN 'on_hold'
      WHEN 'dropped' THEN 'on_hold'
      ELSE 'not_done'
    END
  )::public.task_subtask_stage;

ALTER TABLE public.task_subtasks
  ALTER COLUMN status SET DEFAULT 'not_done';

-- 4) Points: secondaries are distinct subtask assignees (no status filtering)
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
  secondary_ids uuid[] := ARRAY[]::uuid[];
  secondary_count int;
  primary_share numeric;
  secondary_share_total numeric;
  secondary_share_each numeric;

  p_points numeric;
  s_points numeric;
  sec_id uuid;
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

  primary_id := COALESCE(NEW.assignee_id, NEW.created_by);

  SELECT ARRAY(
    SELECT DISTINCT s.assignee_id
    FROM public.task_subtasks s
    WHERE s.task_id = NEW.id
      AND s.assignee_id IS NOT NULL
      AND s.assignee_id IS DISTINCT FROM primary_id
  ) INTO secondary_ids;

  secondary_count := COALESCE(array_length(secondary_ids, 1), 0);

  IF secondary_count = 0 THEN
    primary_share := 1.0;
    secondary_share_each := 0.0;
  ELSE
    primary_share := 0.60;
    secondary_share_total := 0.40;
    secondary_share_each := secondary_share_total / secondary_count;
  END IF;

  p_points := round(final_score * primary_share, 2);

  IF primary_id IS NOT NULL THEN
    INSERT INTO public.task_points_ledger(user_id, task_id, weight_tier, points_awarded, breakdown, week_start)
    VALUES (
      primary_id,
      NEW.id,
      NEW.weight_tier,
      p_points,
      jsonb_build_object(
        'W', W,
        'Mp', Mp,
        'Me', Me,
        'Ml', Ml,
        'final', final_score,
        'share', primary_share,
        'contribution_role', 'primary'
      ),
      week0
    )
    ON CONFLICT (user_id, task_id) DO NOTHING;
  END IF;

  IF secondary_count > 0 THEN
    FOREACH sec_id IN ARRAY secondary_ids LOOP
      s_points := round(final_score * secondary_share_each, 2);
      INSERT INTO public.task_points_ledger(user_id, task_id, weight_tier, points_awarded, breakdown, week_start)
      VALUES (
        sec_id,
        NEW.id,
        NEW.weight_tier,
        s_points,
        jsonb_build_object(
          'W', W,
          'Mp', Mp,
          'Me', Me,
          'Ml', Ml,
          'final', final_score,
          'share', secondary_share_each,
          'contribution_role', 'secondary',
          'secondary_count', secondary_count
        ),
        week0
      )
      ON CONFLICT (user_id, task_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

