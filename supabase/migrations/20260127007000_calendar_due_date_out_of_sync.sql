-- Flag tickets whose due date is after their parent ticket due date.
-- Parent is inferred from task_subtasks.linked_task_id -> child ticket.

-- 1) Extend master calendar RPC to include out_of_sync boolean.
DROP FUNCTION IF EXISTS public.list_master_calendar_tasks(date, date);
CREATE FUNCTION public.list_master_calendar_tasks(p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  title text,
  due_at date,
  master_calendar_tag text,
  priority public.task_priority,
  status public.task_status,
  out_of_sync boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.due_at,
    t.master_calendar_tag::text,
    t.priority,
    t.status,
    (
      t.due_at IS NOT NULL
      AND t.status NOT IN ('closed','dropped')
      AND (
        SELECT MIN(p.due_at)
        FROM public.task_subtasks s
        JOIN public.tasks p ON p.id = s.task_id
        WHERE s.linked_task_id = t.id
          AND p.due_at IS NOT NULL
      ) IS NOT NULL
      AND t.due_at > (
        SELECT MIN(p.due_at)
        FROM public.task_subtasks s
        JOIN public.tasks p ON p.id = s.task_id
        WHERE s.linked_task_id = t.id
          AND p.due_at IS NOT NULL
      )
    ) AS out_of_sync
  FROM public.tasks t
  WHERE t.master_calendar_tag IS NOT NULL
    AND (p_due_from IS NULL OR t.due_at >= p_due_from)
    AND (p_due_to IS NULL OR t.due_at <= p_due_to)
  ORDER BY t.due_at NULLS LAST, t.updated_at DESC;
END;
$$;

-- 2) Marketing calendar helper: list out-of-sync child ticket ids (restricted to marketing team).
CREATE OR REPLACE FUNCTION public.list_due_date_out_of_sync_task_ids(p_due_from date DEFAULT NULL, p_due_to date DEFAULT NULL)
RETURNS TABLE (
  id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_marketing_team() THEN
    RAISE EXCEPTION 'Marketing team only';
  END IF;

  RETURN QUERY
  SELECT t.id
  FROM public.tasks t
  WHERE t.due_at IS NOT NULL
    AND t.status NOT IN ('closed','dropped')
    AND (p_due_from IS NULL OR t.due_at >= p_due_from)
    AND (p_due_to IS NULL OR t.due_at <= p_due_to)
    AND (
      SELECT MIN(p.due_at)
      FROM public.task_subtasks s
      JOIN public.tasks p ON p.id = s.task_id
      WHERE s.linked_task_id = t.id
        AND p.due_at IS NOT NULL
    ) IS NOT NULL
    AND t.due_at > (
      SELECT MIN(p.due_at)
      FROM public.task_subtasks s
      JOIN public.tasks p ON p.id = s.task_id
      WHERE s.linked_task_id = t.id
        AND p.due_at IS NOT NULL
    );
END;
$$;

