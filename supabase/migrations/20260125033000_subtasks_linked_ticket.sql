-- Subtasks: optionally link to a ticket (for cross-team work like Design).

ALTER TABLE public.task_subtasks
  ADD COLUMN IF NOT EXISTS linked_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS task_subtasks_linked_task_idx ON public.task_subtasks(linked_task_id);

