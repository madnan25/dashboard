-- Master calendar: add Design & Production tag.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'task_master_calendar_tag'
  ) THEN
    -- Safety: should already exist, but keep fresh DBs working.
    CREATE TYPE public.task_master_calendar_tag AS ENUM ('marketing','sales','design');
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'task_master_calendar_tag'
        AND e.enumlabel = 'design'
    ) THEN
      ALTER TYPE public.task_master_calendar_tag ADD VALUE 'design';
    END IF;
  END IF;
END $$;

