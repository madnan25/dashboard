-- Status model update:
-- - Remove tasks.status = 'live'
-- - Add tasks.status = 'on_hold'
-- - Unify task_subtasks.status to use the same enum as tasks.status
--
-- Data mapping:
-- - tasks.status: 'live' -> 'approved'
-- - task_subtasks.status: 'todo' -> 'queued', 'done' -> 'closed'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'task_status_v2'
  ) THEN
    CREATE TYPE public.task_status_v2 AS ENUM (
      'queued',
      'in_progress',
      'submitted',
      'approved',
      'closed',
      'on_hold',
      'blocked',
      'dropped'
    );
  END IF;
END $$;

-- Tasks: move to v2 enum, mapping live -> approved
ALTER TABLE public.tasks
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.tasks
  ALTER COLUMN status TYPE public.task_status_v2
  USING (
    CASE status::text
      WHEN 'live' THEN 'approved'
      ELSE status::text
    END
  )::public.task_status_v2;

ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'queued';

-- Subtasks: move to same v2 enum, mapping todo/done
ALTER TABLE public.task_subtasks
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.task_subtasks
  ALTER COLUMN status TYPE public.task_status_v2
  USING (
    CASE status::text
      WHEN 'todo' THEN 'queued'
      WHEN 'done' THEN 'closed'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'dropped' THEN 'dropped'
      ELSE 'queued'
    END
  )::public.task_status_v2;

ALTER TABLE public.task_subtasks
  ALTER COLUMN status SET DEFAULT 'queued';

-- Drop legacy subtask enum type (no longer used)
DROP TYPE IF EXISTS public.task_subtask_status;

-- Replace old task_status type with v2 (rename)
DROP TYPE IF EXISTS public.task_status;
ALTER TYPE public.task_status_v2 RENAME TO task_status;



