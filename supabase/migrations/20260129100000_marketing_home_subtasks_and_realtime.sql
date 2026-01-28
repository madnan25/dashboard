-- Marketing home dashboard:
-- 1) Include subtasks in inbox items (marked as subtask).
-- 2) Touch parent ticket updated_at when subtasks change (enables task-based refresh + correct ordering).
-- 3) Enable realtime feeds for tasks + subtasks (RLS still applies).

-- 1) Touch parent task updated_at on subtask changes.
CREATE OR REPLACE FUNCTION public.touch_task_updated_at_from_subtask()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  target_task_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_task_id := OLD.task_id;
  ELSE
    target_task_id := NEW.task_id;
  END IF;

  IF target_task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET updated_at = now()
    WHERE id = target_task_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_task_updated_at_from_subtask ON public.task_subtasks;
CREATE TRIGGER trg_touch_task_updated_at_from_subtask
AFTER INSERT OR UPDATE OR DELETE ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.touch_task_updated_at_from_subtask();

-- 2) Inbox RPC: include subtasks as rows (item_type = 'subtask').
CREATE OR REPLACE FUNCTION public.get_marketing_home_inbox(p_limit int DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  assigned_count int;
  approval_count int;
  overdue_count int;
  involved_count int;
  items jsonb;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_marketing_team() THEN
    RAISE EXCEPTION 'Marketing team only';
  END IF;

  -- Assigned: open tickets assigned to you + open subtasks assigned to you.
  SELECT COUNT(*) INTO assigned_count
  FROM public.tasks t
  WHERE t.assignee_id = uid
    AND t.status NOT IN ('closed','dropped');

  SELECT assigned_count + COUNT(*) INTO assigned_count
  FROM public.task_subtasks s
  JOIN public.tasks t ON t.id = s.task_id
  WHERE s.assignee_id = uid
    AND (s.status IS DISTINCT FROM 'done')
    AND t.status NOT IN ('closed','dropped');

  SELECT COUNT(*) INTO approval_count
  FROM public.tasks t
  WHERE t.approver_user_id = uid
    AND t.approval_state = 'pending'
    AND t.status = 'submitted';

  WITH base AS (
    SELECT t.*
    FROM public.tasks t
    WHERE t.assignee_id = uid
      OR t.approver_user_id = uid
      OR t.created_by = uid
      OR EXISTS (
        SELECT 1 FROM public.task_contributions c
        WHERE c.task_id = t.id AND c.user_id = uid
      )
      OR EXISTS (
        SELECT 1 FROM public.task_subtasks s
        WHERE s.task_id = t.id AND s.assignee_id = uid
      )
  )
  SELECT COUNT(*) INTO involved_count
  FROM base
  WHERE status NOT IN ('closed','dropped');

  WITH task_overdue AS (
    SELECT t.id
    FROM public.tasks t
    WHERE (t.assignee_id = uid OR t.approver_user_id = uid OR t.created_by = uid)
      AND t.due_at IS NOT NULL
      AND t.due_at < CURRENT_DATE
      AND t.status NOT IN ('closed','dropped')
  ),
  subtask_overdue AS (
    SELECT s.id
    FROM public.task_subtasks s
    JOIN public.tasks t ON t.id = s.task_id
    WHERE s.assignee_id = uid
      AND s.due_at IS NOT NULL
      AND s.due_at < CURRENT_DATE
      AND (s.status IS DISTINCT FROM 'done')
      AND t.status NOT IN ('closed','dropped')
  )
  SELECT (SELECT COUNT(*) FROM task_overdue) + (SELECT COUNT(*) FROM subtask_overdue) INTO overdue_count;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO items
  FROM (
    WITH task_items AS (
      SELECT
        t.id::text AS id,
        'task'::text AS item_type,
        t.id::text AS task_id,
        t.title,
        NULL::text AS subtask_title,
        t.status::text AS status,
        t.priority::text AS priority,
        t.approval_state::text AS approval_state,
        t.approver_user_id::text AS approver_user_id,
        t.assignee_id::text AS assignee_id,
        t.created_by::text AS created_by,
        t.due_at::text AS due_at,
        t.updated_at::text AS updated_at
      FROM public.tasks t
      WHERE (
        t.assignee_id = uid
        OR t.approver_user_id = uid
        OR t.created_by = uid
        OR EXISTS (
          SELECT 1 FROM public.task_contributions c
          WHERE c.task_id = t.id AND c.user_id = uid
        )
        OR EXISTS (
          SELECT 1 FROM public.task_subtasks s
          WHERE s.task_id = t.id AND s.assignee_id = uid
        )
      )
        AND t.status NOT IN ('closed','dropped')
    ),
    subtask_items AS (
      SELECT
        s.id::text AS id,
        'subtask'::text AS item_type,
        s.task_id::text AS task_id,
        t.title,
        COALESCE(s.title, 'Subtask') AS subtask_title,
        t.status::text AS status,
        t.priority::text AS priority,
        t.approval_state::text AS approval_state,
        t.approver_user_id::text AS approver_user_id,
        s.assignee_id::text AS assignee_id,
        t.created_by::text AS created_by,
        COALESCE(s.due_at, t.due_at)::text AS due_at,
        GREATEST(t.updated_at, s.updated_at)::text AS updated_at
      FROM public.task_subtasks s
      JOIN public.tasks t ON t.id = s.task_id
      WHERE t.status NOT IN ('closed','dropped')
        AND (s.status IS DISTINCT FROM 'done')
        AND (
          s.assignee_id = uid
          OR t.approver_user_id = uid
        )
    )
    SELECT *
    FROM (
      SELECT * FROM task_items
      UNION ALL
      SELECT * FROM subtask_items
    ) u
    ORDER BY updated_at DESC
    LIMIT GREATEST(p_limit, 0)
  ) x;

  RETURN jsonb_build_object(
    'assigned_count', COALESCE(assigned_count, 0),
    'approval_count', COALESCE(approval_count, 0),
    'overdue_count', COALESCE(overdue_count, 0),
    'involved_count', COALESCE(involved_count, 0),
    'items', COALESCE(items, '[]'::jsonb)
  );
END;
$$;

-- 3) Realtime: add tasks + subtasks tables to publication (safe if already present).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_subtasks;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

