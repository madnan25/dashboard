-- Server-side RPC to create a task flow instance from a template.
-- Resolves approver_kind, including ticket_manager (ticket "Manager" is stored in task_contributions.role='coordinator').

CREATE OR REPLACE FUNCTION public.create_task_flow_instance_from_template(p_task_id uuid, p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst_id uuid;
  manager_id uuid;
  role_text text;
  t public.task_flow_templates%ROWTYPE;
  s public.task_flow_template_steps%ROWTYPE;
  resolved_approver uuid;
BEGIN
  role_text := public.current_user_role();
  IF NOT public.is_marketing_team() OR role_text = 'viewer' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO t FROM public.task_flow_templates WHERE id = p_template_id;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Ticket manager (contribution role coordinator)
  SELECT c.user_id INTO manager_id
  FROM public.task_contributions c
  WHERE c.task_id = p_task_id AND c.role = 'coordinator'
  LIMIT 1;

  IF manager_id IS NULL THEN
    RAISE EXCEPTION 'Ticket manager is required before setting a flow';
  END IF;

  -- Ensure no existing instance
  IF EXISTS (SELECT 1 FROM public.task_flow_instances i WHERE i.task_id = p_task_id) THEN
    RAISE EXCEPTION 'This ticket already has a flow';
  END IF;

  INSERT INTO public.task_flow_instances(task_id, template_id, is_overridden)
  VALUES (p_task_id, p_template_id, false)
  RETURNING id INTO inst_id;

  FOR s IN
    SELECT * FROM public.task_flow_template_steps
    WHERE template_id = p_template_id
    ORDER BY step_order ASC
  LOOP
    resolved_approver := NULL;

    IF s.approver_kind = 'ticket_manager' OR s.approver_kind = 'marketing_manager' THEN
      resolved_approver := manager_id;
    ELSIF s.approver_kind = 'user' THEN
      resolved_approver := s.approver_user_id;
    END IF;

    IF resolved_approver IS NULL THEN
      RAISE EXCEPTION 'Every step needs an approver';
    END IF;

    INSERT INTO public.task_flow_step_instances(flow_instance_id, step_order, step_key, label, approver_user_id)
    VALUES (inst_id, s.step_order, s.step_key, s.label, resolved_approver);
  END LOOP;

  RETURN inst_id;
END;
$$;


