-- Add approver kind for task flow templates: ticket_manager

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'task_flow_approver_kind'
      AND e.enumlabel = 'ticket_manager'
  ) THEN
    ALTER TYPE public.task_flow_approver_kind ADD VALUE 'ticket_manager';
  END IF;
END $$;


