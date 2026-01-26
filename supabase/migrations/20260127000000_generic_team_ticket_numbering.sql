-- Generic team ticket numbering system.
-- Replaces the specific DES/PROD sequences with a generic prefix-based system.

-- Table to track ticket numbers per prefix
CREATE TABLE IF NOT EXISTS public.team_ticket_numbers (
  prefix text PRIMARY KEY,
  next_number bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Initialize existing prefixes from existing tickets
DO $$
DECLARE
  max_des bigint;
  max_prod bigint;
BEGIN
  -- Get max DES number
  SELECT COALESCE(MAX((substring(title from '^DES-([0-9]+):'))::bigint), 0)
  INTO max_des
  FROM public.tasks
  WHERE title ~ '^DES-[0-9]+:';

  -- Get max PROD number
  SELECT COALESCE(MAX((substring(title from '^PROD-([0-9]+):'))::bigint), 0)
  INTO max_prod
  FROM public.tasks
  WHERE title ~ '^PROD-[0-9]+:';

  -- Insert or update DES prefix
  INSERT INTO public.team_ticket_numbers (prefix, next_number)
  VALUES ('DES', GREATEST(max_des + 1, 1))
  ON CONFLICT (prefix) DO UPDATE
  SET next_number = GREATEST(team_ticket_numbers.next_number, max_des + 1);

  -- Insert or update PROD prefix
  INSERT INTO public.team_ticket_numbers (prefix, next_number)
  VALUES ('PROD', GREATEST(max_prod + 1, 1))
  ON CONFLICT (prefix) DO UPDATE
  SET next_number = GREATEST(team_ticket_numbers.next_number, max_prod + 1);
END;
$$;

-- Generic RPC function to get next ticket number for any prefix
CREATE OR REPLACE FUNCTION public.next_team_ticket_number(p_prefix text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num bigint;
BEGIN
  -- Insert or get existing prefix, then increment
  INSERT INTO public.team_ticket_numbers (prefix, next_number)
  VALUES (UPPER(p_prefix), 1)
  ON CONFLICT (prefix) DO NOTHING;

  -- Get and increment the number
  UPDATE public.team_ticket_numbers
  SET next_number = next_number + 1,
      updated_at = now()
  WHERE prefix = UPPER(p_prefix)
  RETURNING next_number - 1 INTO next_num;

  RETURN next_num;
END;
$$;

-- Grant access
GRANT SELECT, INSERT, UPDATE ON public.team_ticket_numbers TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_team_ticket_number(text) TO authenticated;
