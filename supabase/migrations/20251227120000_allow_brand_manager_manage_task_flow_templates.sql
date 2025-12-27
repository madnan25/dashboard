-- Allow Brand Managers to manage task flow templates/steps (in addition to marketing managers + CMO).

DROP POLICY IF EXISTS task_flow_templates_write ON public.task_flow_templates;
CREATE POLICY task_flow_templates_write ON public.task_flow_templates
FOR ALL TO authenticated
USING (public.is_marketing_manager() OR public.current_user_role() = 'brand_manager')
WITH CHECK (public.is_marketing_manager() OR public.current_user_role() = 'brand_manager');

DROP POLICY IF EXISTS task_flow_template_steps_write ON public.task_flow_template_steps;
CREATE POLICY task_flow_template_steps_write ON public.task_flow_template_steps
FOR ALL TO authenticated
USING (public.is_marketing_manager() OR public.current_user_role() = 'brand_manager')
WITH CHECK (public.is_marketing_manager() OR public.current_user_role() = 'brand_manager');


