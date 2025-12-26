-- Tasks scoring: global weight tiers + immutable points ledger
-- Award points once when a ticket reaches approval_state = 'approved'.
-- Rework is neither penalized nor rewarded; no time tracking is stored.

-- 1) Weight config (global, CMO-tuned)
CREATE TABLE IF NOT EXISTS public.task_weight_config (
  id text PRIMARY KEY DEFAULT 'global',
  small_points int NOT NULL DEFAULT 3,
  medium_points int NOT NULL DEFAULT 6,
  large_points int NOT NULL DEFAULT 10,
  critical_points int NOT NULL DEFAULT 16,

  -- Priority multipliers
  mp_p0 numeric NOT NULL DEFAULT 1.15,
  mp_p1 numeric NOT NULL DEFAULT 1.05,
  mp_p2 numeric NOT NULL DEFAULT 1.00,
  mp_p3 numeric NOT NULL DEFAULT 0.95,

  -- Early multipliers (relative to due_at)
  me_3plus numeric NOT NULL DEFAULT 1.10,
  me_1to2 numeric NOT NULL DEFAULT 1.05,
  me_ontime numeric NOT NULL DEFAULT 1.00,

  -- Late penalty multipliers (step-capped)
  ml_1to2 numeric NOT NULL DEFAULT 0.90,
  ml_3to5 numeric NOT NULL DEFAULT 0.80,
  ml_6plus numeric NOT NULL DEFAULT 0.65,

  -- Guardrail: cap small-ticket scoring by volume
  small_weekly_cap int NOT NULL DEFAULT 12,
  small_overcap_multiplier numeric NOT NULL DEFAULT 0.50,

  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure the global row exists
INSERT INTO public.task_weight_config (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.task_weight_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_weight_config_select ON public.task_weight_config;
CREATE POLICY task_weight_config_select ON public.task_weight_config
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_weight_config_write ON public.task_weight_config;
CREATE POLICY task_weight_config_write ON public.task_weight_config
FOR ALL TO authenticated
USING (public.current_user_role() = 'cmo')
WITH CHECK (public.current_user_role() = 'cmo');

-- Keep updated_at current
DROP TRIGGER IF EXISTS set_task_weight_config_updated_at ON public.task_weight_config;
CREATE TRIGGER set_task_weight_config_updated_at
BEFORE UPDATE ON public.task_weight_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Add scoring fields to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS weight_tier text NOT NULL DEFAULT 'small',
  ADD COLUMN IF NOT EXISTS base_weight int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_weight_tier_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_weight_tier_check
      CHECK (weight_tier IN ('small','medium','large','critical'));
  END IF;
END $$;

-- Guard: only CMO can set/change weight_tier/base_weight
CREATE OR REPLACE FUNCTION public.guard_task_weight_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text text;
BEGIN
  role_text := public.current_user_role();

  IF role_text IS DISTINCT FROM 'cmo' THEN
    IF TG_OP = 'INSERT' THEN
      -- non-CMO may only create with defaults (tier=small, base_weight=0)
      IF NEW.weight_tier IS DISTINCT FROM 'small' THEN
        RAISE EXCEPTION 'CMO only can set task weight tier';
      END IF;
      IF NEW.base_weight IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'CMO only can set task base weight';
      END IF;
    ELSE
      IF NEW.weight_tier IS DISTINCT FROM OLD.weight_tier THEN
        RAISE EXCEPTION 'CMO only can change task weight tier';
      END IF;
      IF NEW.base_weight IS DISTINCT FROM OLD.base_weight THEN
        RAISE EXCEPTION 'CMO only can change task base weight';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_weight_fields ON public.tasks;
CREATE TRIGGER trg_guard_task_weight_fields
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_weight_fields();

-- Set completed_at when approval_state transitions to approved
CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_state = 'approved' AND (OLD.approval_state IS DISTINCT FROM 'approved') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_completed_at ON public.tasks;
CREATE TRIGGER trg_set_task_completed_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_task_completed_at();

-- 3) Points ledger (immutable)
CREATE TABLE IF NOT EXISTS public.task_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  weight_tier text NOT NULL,
  points_awarded numeric NOT NULL,
  breakdown jsonb NOT NULL,
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS task_points_ledger_user_week_idx ON public.task_points_ledger(user_id, week_start);
CREATE INDEX IF NOT EXISTS task_points_ledger_task_idx ON public.task_points_ledger(task_id);

ALTER TABLE public.task_points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_points_ledger_select ON public.task_points_ledger;
CREATE POLICY task_points_ledger_select ON public.task_points_ledger
FOR SELECT TO authenticated
USING (public.is_marketing_team());

-- Deny direct client writes (only triggers/functions write)
DROP POLICY IF EXISTS task_points_ledger_insert_deny ON public.task_points_ledger;
CREATE POLICY task_points_ledger_insert_deny ON public.task_points_ledger
FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS task_points_ledger_update_deny ON public.task_points_ledger;
CREATE POLICY task_points_ledger_update_deny ON public.task_points_ledger
FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS task_points_ledger_delete_deny ON public.task_points_ledger;
CREATE POLICY task_points_ledger_delete_deny ON public.task_points_ledger
FOR DELETE TO authenticated
USING (false);

-- 4) Scoring trigger: award points once on approval
CREATE OR REPLACE FUNCTION public.week_start_monday(d date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (d - ((extract(dow from d)::int + 6) % 7));
$$;

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
  coord_id uuid;
  primary_share numeric;
  coord_share numeric;

  p_points numeric;
  c_points numeric;
BEGIN
  -- Only run once (first time a ticket becomes approved)
  IF NOT (NEW.approval_state = 'approved' AND (OLD.approval_state IS DISTINCT FROM 'approved')) THEN
    RETURN NEW;
  END IF;

  -- No points for dropped tickets
  IF NEW.status = 'dropped' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cfg FROM public.task_weight_config WHERE id = 'global';

  approved_date := COALESCE(NEW.approved_at, NEW.completed_at, now())::date;
  due_date := NEW.due_at;
  week0 := public.week_start_monday(approved_date);

  -- Base weight W (CMO override takes precedence if set > 0)
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

  -- Priority multiplier Mp
  CASE NEW.priority
    WHEN 'p0' THEN Mp := cfg.mp_p0;
    WHEN 'p1' THEN Mp := cfg.mp_p1;
    WHEN 'p2' THEN Mp := cfg.mp_p2;
    WHEN 'p3' THEN Mp := cfg.mp_p3;
    ELSE Mp := 1.0;
  END CASE;

  -- Early/on-time + late multipliers
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

  -- Small-tier weekly cap guardrail (reduce score after cap)
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

  -- Default contribution split:
  -- primary executor: assignee_id (fallback created_by)
  -- coordinator: created_by (if different)
  primary_id := COALESCE(NEW.assignee_id, NEW.created_by);
  coord_id := NEW.created_by;

  IF coord_id IS NULL OR coord_id = primary_id THEN
    primary_share := 1.0;
    coord_share := 0.0;
  ELSE
    primary_share := 0.90; -- 65% + 25% rolls into primary when no secondary
    coord_share := 0.10;   -- fixed coordinator share
  END IF;

  p_points := round(final_score * primary_share, 2);
  c_points := round(final_score * coord_share, 2);

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

  IF coord_share > 0 AND coord_id IS NOT NULL THEN
    INSERT INTO public.task_points_ledger(user_id, task_id, weight_tier, points_awarded, breakdown, week_start)
    VALUES (
      coord_id,
      NEW.id,
      NEW.weight_tier,
      c_points,
      jsonb_build_object(
        'W', W,
        'Mp', Mp,
        'Me', Me,
        'Ml', Ml,
        'final', final_score,
        'share', coord_share,
        'contribution_role', 'coordinator'
      ),
      week0
    )
    ON CONFLICT (user_id, task_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_task_points ON public.tasks;
CREATE TRIGGER trg_award_task_points
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.award_task_points_on_approval();

