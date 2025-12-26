-- Allow marketing-team members to use Tasks even if their app role is viewer.
-- Keep sales_ops blocked from Tasks.

-- Update helper
CREATE OR REPLACE FUNCTION public.is_marketing_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR (
      public.current_user_role() IS DISTINCT FROM 'sales_ops'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_marketing_team = true
      )
    )
  );
$$;

-- Allow marketing team members (incl viewer) to create/update tasks
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.is_marketing_team());

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (public.is_marketing_team())
WITH CHECK (public.is_marketing_team());

