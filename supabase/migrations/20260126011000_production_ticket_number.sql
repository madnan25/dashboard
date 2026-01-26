-- Production ticket numbering sequence + RPC.

CREATE SEQUENCE IF NOT EXISTS public.production_ticket_seq;

DO $$
DECLARE
  max_val bigint;
BEGIN
  SELECT COALESCE(MAX((substring(title from '^PROD-([0-9]+):'))::bigint), 0)
  INTO max_val
  FROM public.tasks
  WHERE title ~ '^PROD-[0-9]+:';

  IF max_val < 1 THEN
    -- Seed sequence so nextval() returns 1.
    PERFORM setval('public.production_ticket_seq', 1, false);
  ELSE
    -- Set to current max so nextval() returns max + 1.
    PERFORM setval('public.production_ticket_seq', max_val, true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_production_ticket_number()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.production_ticket_seq');
$$;

