-- Replace marketing_team_role with a simple manager-capabilities toggle.

-- 1) Add flag
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_marketing_manager boolean NOT NULL DEFAULT false;

-- 2) Backfill defaults
UPDATE public.profiles
SET is_marketing_team = true,
    is_marketing_manager = true
WHERE role IN ('cmo','brand_manager');

-- Member role is marketing by definition
UPDATE public.profiles
SET is_marketing_team = true
WHERE role = 'member';

-- 3) Enforce: viewer/sales_ops cannot be managers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_marketing_manager_role_guard'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_marketing_manager_role_guard
    CHECK (NOT (role IN ('viewer','sales_ops') AND is_marketing_manager));
  END IF;
END $$;

-- 4) Update helper to use flag (CMO always)
CREATE OR REPLACE FUNCTION public.is_marketing_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR (
      public.current_user_role() IN ('brand_manager','member')
      AND public.is_marketing_team()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_marketing_team = true AND p.is_marketing_manager = true
      )
    )
  );
$$;

-- 5) Drop legacy role column + constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_marketing_team_role_check;

ALTER TABLE public.profiles
DROP COLUMN IF EXISTS marketing_team_role;

