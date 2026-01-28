-- Restore marketing-team visibility for tasks and related collaboration tables.
-- Ensures marketing team members can see each other's tickets (and marketing calendar works).

-- Tasks: marketing team can read all.
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (public.is_marketing_team());

-- Task events: marketing team can read all events for marketing tickets.
DROP POLICY IF EXISTS task_events_select ON public.task_events;
CREATE POLICY task_events_select ON public.task_events
FOR SELECT TO authenticated
USING (public.is_marketing_team());

-- Subtasks: marketing team can read all.
DROP POLICY IF EXISTS task_subtasks_select ON public.task_subtasks;
CREATE POLICY task_subtasks_select ON public.task_subtasks
FOR SELECT TO authenticated
USING (public.is_marketing_team());

-- Contributions: marketing team can read all.
DROP POLICY IF EXISTS task_contributions_select ON public.task_contributions;
CREATE POLICY task_contributions_select ON public.task_contributions
FOR SELECT TO authenticated
USING (public.is_marketing_team());
