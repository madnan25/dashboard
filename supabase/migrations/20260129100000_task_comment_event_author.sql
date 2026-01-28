-- Add comment author context to activity events.

CREATE OR REPLACE FUNCTION public.log_task_comment_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.body IS DISTINCT FROM OLD.body THEN
      INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
      VALUES (NEW.task_id, auth.uid(), 'comment_edited', NEW.author_id::text, NEW.id::text);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
    VALUES (OLD.task_id, auth.uid(), 'comment_deleted', OLD.author_id::text, OLD.id::text);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;
