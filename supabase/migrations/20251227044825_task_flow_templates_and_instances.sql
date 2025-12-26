-- Task flow templates + per-ticket flow instances
-- Managers can CRUD templates; tickets can snapshot/override steps at creation.

-- 1) Template tables
CREATE TABLE IF NOT EXISTS public.task_flow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS task_flow_templates_name_unique ON public.task_flow_templates (name);

DROP TRIGGER IF EXISTS set_task_flow_templates_updated_at ON public.task_flow_templates;
CREATE TRIGGER set_task_flow_templates_updated_at
BEFORE UPDATE ON public.task_flow_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_flow_approver_kind'
  ) THEN
    CREATE TYPE public.task_flow_approver_kind AS ENUM ('marketing_manager','user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_flow_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.task_flow_templates (id) ON DELETE CASCADE,
  step_order int NOT NULL,
  step_key text NOT NULL,
  label text NOT NULL,
  approver_kind public.task_flow_approver_kind NOT NULL DEFAULT 'marketing_manager',
  approver_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, step_order),
  UNIQUE (template_id, step_key)
);

CREATE INDEX IF NOT EXISTS task_flow_template_steps_template_idx ON public.task_flow_template_steps(template_id, step_order);

DROP TRIGGER IF EXISTS set_task_flow_template_steps_updated_at ON public.task_flow_template_steps;
CREATE TRIGGER set_task_flow_template_steps_updated_at
BEFORE UPDATE ON public.task_flow_template_steps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.task_flow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_flow_template_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_flow_templates_select ON public.task_flow_templates;
CREATE POLICY task_flow_templates_select ON public.task_flow_templates
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_flow_templates_write ON public.task_flow_templates;
CREATE POLICY task_flow_templates_write ON public.task_flow_templates
FOR ALL TO authenticated
USING (public.is_marketing_manager())
WITH CHECK (public.is_marketing_manager());

DROP POLICY IF EXISTS task_flow_template_steps_select ON public.task_flow_template_steps;
CREATE POLICY task_flow_template_steps_select ON public.task_flow_template_steps
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_flow_template_steps_write ON public.task_flow_template_steps;
CREATE POLICY task_flow_template_steps_write ON public.task_flow_template_steps
FOR ALL TO authenticated
USING (public.is_marketing_manager())
WITH CHECK (public.is_marketing_manager());

-- 2) Flow instances (snapshot of approvers/steps for a specific task)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_flow_step_status'
  ) THEN
    CREATE TYPE public.task_flow_step_status AS ENUM ('pending','approved');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.task_flow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks (id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.task_flow_templates (id) ON DELETE SET NULL,
  current_step_order int NOT NULL DEFAULT 1,
  is_overridden boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_flow_instances_task_idx ON public.task_flow_instances(task_id);

DROP TRIGGER IF EXISTS set_task_flow_instances_updated_at ON public.task_flow_instances;
CREATE TRIGGER set_task_flow_instances_updated_at
BEFORE UPDATE ON public.task_flow_instances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.task_flow_step_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_instance_id uuid NOT NULL REFERENCES public.task_flow_instances (id) ON DELETE CASCADE,
  step_order int NOT NULL,
  step_key text NOT NULL,
  label text NOT NULL,
  approver_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status public.task_flow_step_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_instance_id, step_order),
  UNIQUE (flow_instance_id, step_key)
);

CREATE INDEX IF NOT EXISTS task_flow_step_instances_flow_idx ON public.task_flow_step_instances(flow_instance_id, step_order);

DROP TRIGGER IF EXISTS set_task_flow_step_instances_updated_at ON public.task_flow_step_instances;
CREATE TRIGGER set_task_flow_step_instances_updated_at
BEFORE UPDATE ON public.task_flow_step_instances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.task_flow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_flow_step_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_flow_instances_select ON public.task_flow_instances;
CREATE POLICY task_flow_instances_select ON public.task_flow_instances
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_flow_instances_write ON public.task_flow_instances;
CREATE POLICY task_flow_instances_write ON public.task_flow_instances
FOR ALL TO authenticated
USING (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND (
    public.current_user_role() = 'cmo'
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
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_id
        AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS task_flow_step_instances_select ON public.task_flow_step_instances;
CREATE POLICY task_flow_step_instances_select ON public.task_flow_step_instances
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_flow_step_instances_write ON public.task_flow_step_instances;
CREATE POLICY task_flow_step_instances_write ON public.task_flow_step_instances
FOR ALL TO authenticated
USING (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND EXISTS (
    SELECT 1
    FROM public.task_flow_instances i
    JOIN public.tasks t ON t.id = i.task_id
    WHERE i.id = flow_instance_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
        OR approver_user_id = auth.uid()
      )
  )
)
WITH CHECK (
  public.current_user_role() IN ('cmo','brand_manager','member')
  AND public.is_marketing_team()
  AND EXISTS (
    SELECT 1
    FROM public.task_flow_instances i
    JOIN public.tasks t ON t.id = i.task_id
    WHERE i.id = flow_instance_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
        OR approver_user_id = auth.uid()
      )
  )
);

-- 3) Approval enforcement: only approver can approve current step
CREATE OR REPLACE FUNCTION public.guard_task_flow_step_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_step int;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Only enforce when changing to approved
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT i.current_step_order INTO cur_step
    FROM public.task_flow_instances i
    WHERE i.id = NEW.flow_instance_id;

    IF cur_step IS NULL OR NEW.step_order IS DISTINCT FROM cur_step THEN
      RAISE EXCEPTION 'Only the current flow step can be approved';
    END IF;

    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NEW.approver_user_id IS NULL OR NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned approver can approve this step';
      END IF;
    END IF;

    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_flow_step_approval ON public.task_flow_step_instances;
CREATE TRIGGER trg_guard_task_flow_step_approval
BEFORE UPDATE ON public.task_flow_step_instances
FOR EACH ROW EXECUTE FUNCTION public.guard_task_flow_step_approval();

-- 4) When a step is approved, advance flow; when terminal step approved, approve task
CREATE OR REPLACE FUNCTION public.advance_task_flow_on_step_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst public.task_flow_instances%ROWTYPE;
  next_step int;
  max_step int;
  task_uuid uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved')) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO inst FROM public.task_flow_instances WHERE id = NEW.flow_instance_id;
  IF inst.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max(step_order) INTO max_step
  FROM public.task_flow_step_instances
  WHERE flow_instance_id = inst.id;

  IF max_step IS NULL THEN
    RETURN NEW;
  END IF;

  task_uuid := inst.task_id;
  next_step := inst.current_step_order + 1;

  IF inst.current_step_order >= max_step THEN
    -- terminal step approved: mark task approved + status approved (if not already)
    UPDATE public.tasks
    SET approval_state = 'approved',
        status = CASE WHEN status = 'submitted' OR status = 'in_progress' OR status = 'queued' THEN 'approved' ELSE status END
    WHERE id = task_uuid;
  ELSE
    UPDATE public.task_flow_instances
    SET current_step_order = next_step
    WHERE id = inst.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_task_flow ON public.task_flow_step_instances;
CREATE TRIGGER trg_advance_task_flow
AFTER UPDATE ON public.task_flow_step_instances
FOR EACH ROW EXECUTE FUNCTION public.advance_task_flow_on_step_approved();

-- 5) Relax existing approval guard: allow marketing managers to approve tasks
-- (Flow-based approval will set tasks.approval_state='approved' as the final step.)
CREATE OR REPLACE FUNCTION public.guard_task_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_manager boolean;
BEGIN
  is_manager := public.is_marketing_manager();

  IF NEW.approval_state = 'approved' THEN
    IF NOT is_manager THEN
      RAISE EXCEPTION 'Only marketing managers can approve tasks';
    END IF;
    NEW.approved_by := auth.uid();
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
  ELSE
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

