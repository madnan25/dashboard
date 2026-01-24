-- Allow marketing team to read marketing team profiles (for assignment + name display).

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'cmo'
  OR (public.is_marketing_team() AND is_marketing_team = true)
);

