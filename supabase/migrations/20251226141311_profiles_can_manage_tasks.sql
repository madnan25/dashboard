-- Delegated tasks administration
-- CMO can grant users ability to manage (delete) tasks.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS can_manage_tasks boolean NOT NULL DEFAULT false;

-- helper: CMO or delegated flag
CREATE OR REPLACE FUNCTION public.can_manage_tasks()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.current_user_role() = 'cmo'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.can_manage_tasks = true
    )
  );
$$;

-- Update tasks delete policy to use helper
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (public.can_manage_tasks());

