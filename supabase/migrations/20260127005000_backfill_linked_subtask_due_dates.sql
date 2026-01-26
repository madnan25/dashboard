-- Backfill linked subtask due dates and assignees from linked tickets.
-- This makes the UI consistent immediately after deploying the due-date sync triggers.

UPDATE public.task_subtasks s
SET due_at = t.due_at,
    assignee_id = t.assignee_id
FROM public.tasks t
WHERE s.linked_task_id = t.id
  AND (
    s.due_at IS DISTINCT FROM t.due_at
    OR s.assignee_id IS DISTINCT FROM t.assignee_id
  );

