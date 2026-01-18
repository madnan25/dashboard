-- Task teams and team-based approvals.

-- 1) Team configuration
CREATE TABLE IF NOT EXISTS public.task_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  approver_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS task_teams_approver_idx ON public.task_teams (approver_user_id);

DROP TRIGGER IF EXISTS set_task_teams_updated_at ON public.task_teams;
CREATE TRIGGER set_task_teams_updated_at
BEFORE UPDATE ON public.task_teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.task_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_teams_select ON public.task_teams;
CREATE POLICY task_teams_select ON public.task_teams
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS task_teams_write ON public.task_teams;
CREATE POLICY task_teams_write ON public.task_teams
FOR ALL TO authenticated
USING (public.current_user_role() = 'cmo')
WITH CHECK (public.current_user_role() = 'cmo');

-- 2) Team routing columns
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.task_teams (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approver_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_team_idx ON public.tasks (team_id);
CREATE INDEX IF NOT EXISTS tasks_approver_idx ON public.tasks (approver_user_id);

-- 3) Sync approver from team selection
CREATE OR REPLACE FUNCTION public.set_task_approver_from_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_approver uuid;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    IF NEW.team_id IS NULL THEN
      NEW.approver_user_id := NULL;
    ELSE
      SELECT approver_user_id INTO team_approver
      FROM public.task_teams
      WHERE id = NEW.team_id;
      NEW.approver_user_id := team_approver;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      NEW.approval_state := 'pending';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_approver_from_team ON public.tasks;
CREATE TRIGGER trg_set_task_approver_from_team
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_task_approver_from_team();

-- 4) Propagate approver updates to pending tasks
CREATE OR REPLACE FUNCTION public.propagate_task_team_approver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id THEN
    UPDATE public.tasks
    SET approver_user_id = NEW.approver_user_id,
        approval_state = CASE WHEN approval_state = 'approved' THEN approval_state ELSE 'pending' END,
        approved_by = CASE WHEN approval_state = 'approved' THEN approved_by ELSE NULL END,
        approved_at = CASE WHEN approval_state = 'approved' THEN approved_at ELSE NULL END
    WHERE team_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_task_team_approver ON public.task_teams;
CREATE TRIGGER trg_propagate_task_team_approver
AFTER UPDATE ON public.task_teams
FOR EACH ROW EXECUTE FUNCTION public.propagate_task_team_approver();

-- 5) Approval and close guards (team approver or CMO)
CREATE OR REPLACE FUNCTION public.guard_task_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_state = 'approved' THEN
    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NEW.approver_user_id IS NULL THEN
        RAISE EXCEPTION 'Approver is not set for this task';
      END IF;
      IF NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned approver can approve tasks';
      END IF;
    END IF;

    NEW.approved_by := auth.uid();
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
    IF NEW.status IN ('queued','in_progress','submitted') THEN
      NEW.status := 'approved';
    END IF;
  ELSE
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_task_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    IF public.current_user_role() IS DISTINCT FROM 'cmo' THEN
      IF NEW.approver_user_id IS NULL OR NEW.approver_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Only the assigned approver can close tickets';
      END IF;
    END IF;

    IF NEW.approval_state IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Ticket must be approved before closing';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6) RLS updates for tasks + related tables
-- Coordinator no longer implies marketing manager in team-based routing.
DROP TRIGGER IF EXISTS trg_guard_task_contribution_manager_role ON public.task_contributions;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'cmo'
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR approver_user_id = auth.uid()
);

DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'cmo'
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR approver_user_id = auth.uid()
)
WITH CHECK (
  public.current_user_role() = 'cmo'
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR approver_user_id = auth.uid()
);

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (public.current_user_role() = 'cmo');

DROP POLICY IF EXISTS task_events_select ON public.task_events;
CREATE POLICY task_events_select ON public.task_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS task_contributions_select ON public.task_contributions;
CREATE POLICY task_contributions_select ON public.task_contributions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS task_contributions_write ON public.task_contributions;
CREATE POLICY task_contributions_write ON public.task_contributions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS task_subtasks_select ON public.task_subtasks;
CREATE POLICY task_subtasks_select ON public.task_subtasks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS task_subtasks_write ON public.task_subtasks;
CREATE POLICY task_subtasks_write ON public.task_subtasks
FOR ALL TO authenticated
USING (
  assignee_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
)
WITH CHECK (
  assignee_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND (
        public.current_user_role() = 'cmo'
        OR t.created_by = auth.uid()
        OR t.assignee_id = auth.uid()
        OR t.approver_user_id = auth.uid()
      )
  )
);
