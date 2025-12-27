-- Enforce: tasks/subtasks can only be assigned to marketing roles (member, brand_manager, cmo).
-- Viewers + Sales Ops must never be assignees.

CREATE OR REPLACE FUNCTION public.is_assignable_task_assignee(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role IN ('member','brand_manager','cmo')
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_assignee_is_marketing_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_assignable_task_assignee(NEW.assignee_id) THEN
    RAISE EXCEPTION 'Assignee must be a marketing team member (member, brand_manager, or cmo)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tasks_assignee_role ON public.tasks;
CREATE TRIGGER trg_guard_tasks_assignee_role
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_assignee_is_marketing_role();

DROP TRIGGER IF EXISTS trg_guard_task_subtasks_assignee_role ON public.task_subtasks;
CREATE TRIGGER trg_guard_task_subtasks_assignee_role
BEFORE INSERT OR UPDATE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.guard_assignee_is_marketing_role();



