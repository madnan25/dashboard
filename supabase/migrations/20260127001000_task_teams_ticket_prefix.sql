-- Add manual ticket prefix per team (used for ticket numbering).

ALTER TABLE public.task_teams
ADD COLUMN IF NOT EXISTS ticket_prefix text;

-- Optional safety: if provided, it must be alphanumeric, 2-8 chars.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'task_teams_ticket_prefix_format'
  ) THEN
    ALTER TABLE public.task_teams
    ADD CONSTRAINT task_teams_ticket_prefix_format
    CHECK (ticket_prefix IS NULL OR ticket_prefix ~ '^[A-Z0-9]{2,8}$');
  END IF;
END;
$$;

-- Seed common existing teams (best-effort).
UPDATE public.task_teams
SET ticket_prefix = 'DES'
WHERE ticket_prefix IS NULL AND name ILIKE '%design%';

UPDATE public.task_teams
SET ticket_prefix = 'PROD'
WHERE ticket_prefix IS NULL AND name ILIKE '%production%';

