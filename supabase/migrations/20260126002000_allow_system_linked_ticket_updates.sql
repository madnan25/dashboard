-- Allow system-managed linked-ticket updates to bypass property guard.
-- The linked-subtask sync is a trigger-driven system update and should not be blocked by
-- guard_task_property_updates() (which is intended for user edits).

-- 1) Guard: bypass when system flag is set (only set inside SECURITY DEFINER triggers).
CREATE OR REPLACE FUNCTION public.guard_task_property_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
  is_system boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  is_system := (current_setting('dashboard.system_update', true) = '1');
  IF is_system THEN
    RETURN NEW;
  END IF;

  -- Privileged: CMO, marketing manager, or the creator of the ticket.
  is_privileged := (public.current_user_role() = 'cmo')
                  OR public.is_marketing_manager()
                  OR (OLD.created_by IS NOT NULL AND OLD.created_by = auth.uid());

  IF is_privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged marketing users: allow only status changes among work states.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('queued','in_progress','submitted','blocked','on_hold','dropped') THEN
      RAISE EXCEPTION 'Only managers can set that status';
    END IF;
  END IF;

  -- Block any property edits (including approval fields) for non-privileged users.
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.due_at IS DISTINCT FROM OLD.due_at
     OR NEW.master_calendar_tag IS DISTINCT FROM OLD.master_calendar_tag
     OR NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id
     OR NEW.approval_state IS DISTINCT FROM OLD.approval_state
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  THEN
    RAISE EXCEPTION 'Only the creator or a marketing manager can edit ticket properties';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Linked-subtask sync: set system flag while updating linked ticket.
CREATE OR REPLACE FUNCTION public.sync_subtask_to_linked_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_title text;
  linked_status public.task_status;
  existing_desc text;
  managed text;
  tail text;
  next_desc text;
  details text;
BEGIN
  IF NEW.linked_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.title INTO parent_title
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  details := COALESCE(NEW.description, '');

  managed := concat(
    '<!--dashboard:linked-subtask-->', E'\n',
    'Design work for: ', COALESCE(parent_title, '—'), E'\n',
    'Parent ticket: /tasks/', NEW.task_id::text, E'\n',
    'Subtask: ', NEW.title, E'\n',
    'Subtask details:', E'\n',
    details, E'\n',
    '<!--dashboard:linked-subtask-end-->'
  );

  SELECT t.status, t.description INTO linked_status, existing_desc
  FROM public.tasks t
  WHERE t.id = NEW.linked_task_id;

  -- Preserve user notes by keeping everything outside the managed block,
  -- but strip any legacy auto-generated header blocks to avoid duplication.
  tail := COALESCE(existing_desc, '');
  tail := regexp_replace(
    tail,
    '(?s)<!--dashboard:linked-subtask-->.*?<!--dashboard:linked-subtask-end-->\\s*',
    '',
    'g'
  );
  tail := regexp_replace(
    tail,
    '(?s)^\\s*Design work for:.*?\\nParent ticket:.*?\\nSubtask:.*?(\\nSubtask details:.*?\\n.*?)*(\\n\\n|$)',
    '',
    'g'
  );
  tail := btrim(tail);

  next_desc := managed;
  IF tail <> '' THEN
    next_desc := next_desc || E'\n\n' || tail;
  END IF;

  -- Mark as system update so property guard doesn't block it.
  PERFORM set_config('dashboard.system_update', '1', true);
  UPDATE public.tasks
  SET description = next_desc
  WHERE id = NEW.linked_task_id;

  -- Align status/assignee (assignee is handled by guard + linked-ticket sync).
  UPDATE public.task_subtasks
  SET status = public.map_task_status_to_subtask_stage(linked_status)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

