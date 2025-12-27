-- Seed a default task approval flow template so the UI dropdown is never empty.
-- Idempotent by name.

DO $$
DECLARE
  tpl_id uuid;
BEGIN
  SELECT id INTO tpl_id
  FROM public.task_flow_templates
  WHERE name = 'Default: Manager approval';

  IF tpl_id IS NULL THEN
    INSERT INTO public.task_flow_templates(name, description)
    VALUES ('Default: Manager approval', 'Execution with final approval by the ticket manager.')
    RETURNING id INTO tpl_id;
  END IF;

  -- Ensure steps exist (replace to keep deterministic)
  DELETE FROM public.task_flow_template_steps WHERE template_id = tpl_id;

  INSERT INTO public.task_flow_template_steps(template_id, step_order, step_key, label, approver_kind, approver_user_id)
  VALUES
    (tpl_id, 1, 'manager_approval', 'Manager approval', 'ticket_manager', NULL);
END $$;


