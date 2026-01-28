-- Subtask assignment notifications (ping assignee like parent tickets).

-- 1) Extend enum with a new notification type.
DO $$
BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'subtask_assigned';
EXCEPTION
  WHEN undefined_object THEN
    -- enum doesn't exist yet (older env); ignore
    NULL;
END $$;

-- 2) Trigger: create notification when a subtask is assigned.
CREATE OR REPLACE FUNCTION public.log_subtask_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  actor_id uuid;
  parent_title text;
BEGIN
  actor_id := auth.uid();

  SELECT t.title INTO parent_title
  FROM public.tasks t
  WHERE t.id = NEW.task_id
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM actor_id THEN
      PERFORM public.insert_notification(
        NEW.assignee_id,
        'subtask_assigned',
        'New subtask assignment',
        COALESCE(parent_title, 'Ticket') || ': ' || COALESCE(NEW.title, 'Subtask'),
        NEW.task_id
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM actor_id THEN
        PERFORM public.insert_notification(
          NEW.assignee_id,
          'subtask_assigned',
          'New subtask assignment',
          COALESCE(parent_title, 'Ticket') || ': ' || COALESCE(NEW.title, 'Subtask'),
          NEW.task_id
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subtask_notifications ON public.task_subtasks;
CREATE TRIGGER trg_subtask_notifications
AFTER INSERT OR UPDATE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.log_subtask_notifications();

