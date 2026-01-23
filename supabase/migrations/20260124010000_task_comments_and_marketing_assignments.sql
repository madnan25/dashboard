-- Task comments + marketing-only assignments.

-- 1) Helper: check marketing team membership by user id
CREATE OR REPLACE FUNCTION public.is_marketing_team_member(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.is_marketing_team = true
      AND p.role NOT IN ('viewer', 'sales_ops')
  );
$$;

-- 2) Task comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS task_comments_author_idx ON public.task_comments(author_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comments_select ON public.task_comments;
CREATE POLICY task_comments_select ON public.task_comments
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

DROP POLICY IF EXISTS task_comments_insert ON public.task_comments;
CREATE POLICY task_comments_insert ON public.task_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
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

DROP POLICY IF EXISTS task_comments_update ON public.task_comments;
CREATE POLICY task_comments_update ON public.task_comments
FOR UPDATE TO authenticated
USING (public.is_marketing_manager());

DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;
CREATE POLICY task_comments_delete ON public.task_comments
FOR DELETE TO authenticated
USING (public.is_marketing_manager());

DROP TRIGGER IF EXISTS set_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER set_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Assignment guards
CREATE OR REPLACE FUNCTION public.guard_task_assignee_marketing_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    IF NOT public.is_marketing_team_member(NEW.assignee_id) THEN
      RAISE EXCEPTION 'Assignee must be a marketing team member';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_assignee_marketing_team ON public.tasks;
CREATE TRIGGER trg_guard_task_assignee_marketing_team
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_assignee_marketing_team();

CREATE OR REPLACE FUNCTION public.guard_task_subtask_assignee_marketing_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL THEN
    IF NOT public.is_marketing_team_member(NEW.assignee_id) THEN
      RAISE EXCEPTION 'Subtask assignee must be a marketing team member';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_subtask_assignee_marketing_team ON public.task_subtasks;
CREATE TRIGGER trg_guard_task_subtask_assignee_marketing_team
BEFORE INSERT OR UPDATE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.guard_task_subtask_assignee_marketing_team();

CREATE OR REPLACE FUNCTION public.guard_task_team_approver_marketing_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approver_user_id IS NOT NULL THEN
    IF NOT public.is_marketing_team_member(NEW.approver_user_id) THEN
      RAISE EXCEPTION 'Team approver must be a marketing team member';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_task_team_approver_marketing_team ON public.task_teams;
CREATE TRIGGER trg_guard_task_team_approver_marketing_team
BEFORE INSERT OR UPDATE ON public.task_teams
FOR EACH ROW EXECUTE FUNCTION public.guard_task_team_approver_marketing_team();
