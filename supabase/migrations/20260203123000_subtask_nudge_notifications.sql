-- Subtask nudge notifications (manual bell "ping" to assignee)

-- 1) Extend enum with a new notification type.
DO $$
BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'subtask_nudge';
EXCEPTION
  WHEN undefined_object THEN
    -- enum doesn't exist yet (older env); ignore
    NULL;
END $$;

-- 2) RPC: allow marketing team members to ping a subtask assignee.
-- Inserts via insert_notification() which bypasses notifications RLS.
CREATE OR REPLACE FUNCTION public.nudge_subtask_assignee(p_subtask_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  actor_id uuid;
  v_assignee_id uuid;
  v_task_id uuid;
  v_subtask_title text;
  v_task_title text;
  v_title text;
  v_body text;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_marketing_team() THEN
    RAISE EXCEPTION 'Marketing team only';
  END IF;

  SELECT s.assignee_id, s.task_id, s.title
  INTO v_assignee_id, v_task_id, v_subtask_title
  FROM public.task_subtasks s
  WHERE s.id = p_subtask_id
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Subtask not found';
  END IF;

  IF v_assignee_id IS NULL THEN
    RETURN;
  END IF;

  IF v_assignee_id = actor_id THEN
    RETURN;
  END IF;

  SELECT t.title
  INTO v_task_title
  FROM public.tasks t
  WHERE t.id = v_task_id
  LIMIT 1;

  v_title := 'Subtask pending';
  v_body := COALESCE(v_task_title, 'Ticket') || ': ' || COALESCE(v_subtask_title, 'Subtask');

  -- Basic spam protection: do not create the same nudge repeatedly.
  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = v_assignee_id
      AND n.type = 'subtask_nudge'
      AND n.related_task_id = v_task_id
      AND n.title = v_title
      AND COALESCE(n.body, '') = v_body
      AND n.created_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;

  PERFORM public.insert_notification(
    v_assignee_id,
    'subtask_nudge',
    v_title,
    v_body,
    v_task_id
  );
END;
$$;

