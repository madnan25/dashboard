-- Log task description edits in activity stream.

CREATE OR REPLACE FUNCTION public.log_task_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
    VALUES (NEW.id, auth.uid(), 'created', NULL, NEW.status::text);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
    END IF;

    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'assignee', OLD.assignee_id::text, NEW.assignee_id::text);
    END IF;

    IF NEW.approval_state IS DISTINCT FROM OLD.approval_state THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'approval', OLD.approval_state::text, NEW.approval_state::text);
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
    END IF;

    IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'due_at', OLD.due_at::text, NEW.due_at::text);
    END IF;

    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.id, auth.uid(), 'description_edited', NULL, NULL);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
