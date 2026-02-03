-- Shared UI cooldown for subtask nudges
-- Store the last nudge metadata on the subtask row so everyone sees the cooldown state.

ALTER TABLE public.task_subtasks
  ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_nudged_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_nudged_assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Update RPC to record last nudge time (and enforce cooldown via the column when present).
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
  v_last_nudged_at timestamptz;
  v_last_nudged_assignee_id uuid;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_marketing_team() THEN
    RAISE EXCEPTION 'Marketing team only';
  END IF;

  SELECT s.assignee_id, s.task_id, s.title, s.last_nudged_at, s.last_nudged_assignee_id
  INTO v_assignee_id, v_task_id, v_subtask_title, v_last_nudged_at, v_last_nudged_assignee_id
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

  -- Authoritative cooldown: if last nudge was for the current assignee and within 30 minutes, do nothing.
  IF v_last_nudged_at IS NOT NULL
    AND v_last_nudged_assignee_id = v_assignee_id
    AND v_last_nudged_at > now() - interval '30 minutes'
  THEN
    RETURN;
  END IF;

  SELECT t.title
  INTO v_task_title
  FROM public.tasks t
  WHERE t.id = v_task_id
  LIMIT 1;

  v_title := 'Subtask pending';
  v_body := COALESCE(v_task_title, 'Ticket') || ': ' || COALESCE(v_subtask_title, 'Subtask');

  -- Backstop: prevent duplicates if last_nudged columns are null/unavailable in older environments.
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

  UPDATE public.task_subtasks
  SET last_nudged_at = now(),
      last_nudged_by = actor_id,
      last_nudged_assignee_id = v_assignee_id
  WHERE id = p_subtask_id;
END;
$$;

