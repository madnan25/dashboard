-- Kanban tasks module (global)

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_status'
  ) THEN
    CREATE TYPE public.task_status AS ENUM (
      'queued','in_progress','submitted','approved','live','closed','blocked','dropped'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_priority'
  ) THEN
    CREATE TYPE public.task_priority AS ENUM ('p0','p1','p2','p3');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_approval_state'
  ) THEN
    CREATE TYPE public.task_approval_state AS ENUM ('not_required','pending','approved');
  END IF;
END $$;

-- 2) Tables
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  priority public.task_priority NOT NULL DEFAULT 'p2',
  status public.task_status NOT NULL DEFAULT 'queued',
  approval_state public.task_approval_state NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  due_at date,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_due_at_idx ON public.tasks(due_at);

CREATE TABLE IF NOT EXISTS public.task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  type text NOT NULL,
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_events_task_idx ON public.task_events(task_id, created_at DESC);

-- 3) Triggers
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Approval stamp guard
CREATE OR REPLACE FUNCTION public.guard_task_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text text;
BEGIN
  role_text := public.current_user_role();

  -- If approval is marked approved, only CMO can do it
  IF NEW.approval_state = 'approved' THEN
    IF role_text IS DISTINCT FROM 'cmo' THEN
      RAISE EXCEPTION 'CMO only can approve tasks';
    END IF;
    NEW.approved_by := auth.uid();
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
  ELSE
    -- If not approved, clear stamp
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  -- Non-CMO cannot directly write approved_by/approved_at regardless
  IF role_text IS DISTINCT FROM 'cmo' THEN
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      -- If they tried to set these (or keep them), block
      -- (NEW values already cleared above when not approved)
      IF NEW.approval_state = 'approved' THEN
        RAISE EXCEPTION 'CMO only can approve tasks';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_approval ON public.tasks;
CREATE TRIGGER trg_guard_task_approval
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_approval();

-- Event logging
CREATE OR REPLACE FUNCTION public.log_task_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), 'created', NULL, NEW.status::text);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
    END IF;

    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'assignee', OLD.assignee_id::text, NEW.assignee_id::text);
    END IF;

    IF NEW.approval_state IS DISTINCT FROM OLD.approval_state THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'approval', OLD.approval_state::text, NEW.approval_state::text);
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
    END IF;

    IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'due_at', OLD.due_at::text, NEW.due_at::text);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_task_events ON public.tasks;
CREATE TRIGGER trg_log_task_events
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_events();

-- 4) RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

-- tasks policies
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() IS DISTINCT FROM 'viewer');

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (public.current_user_role() IS DISTINCT FROM 'viewer')
WITH CHECK (public.current_user_role() IS DISTINCT FROM 'viewer');

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (public.current_user_role() = 'cmo');

-- task_events policies
DROP POLICY IF EXISTS task_events_select ON public.task_events;
CREATE POLICY task_events_select ON public.task_events
FOR SELECT TO authenticated
USING (true);

-- Deny direct writes from clients
DROP POLICY IF EXISTS task_events_insert_deny ON public.task_events;
CREATE POLICY task_events_insert_deny ON public.task_events
FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS task_events_update_deny ON public.task_events;
CREATE POLICY task_events_update_deny ON public.task_events
FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS task_events_delete_deny ON public.task_events;
CREATE POLICY task_events_delete_deny ON public.task_events
FOR DELETE TO authenticated
USING (false);

