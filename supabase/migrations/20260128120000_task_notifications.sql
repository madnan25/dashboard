-- Task notifications (assignment + approvals)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'notification_type'
  ) THEN
    CREATE TYPE public.notification_type AS ENUM (
      'task_assigned',
      'task_approval_requested',
      'task_approved'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  related_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx
  ON public.notifications (user_id, read_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Helper for trigger-driven inserts (bypasses RLS).
CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_task_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, related_task_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_task_id);
END;
$$;

-- Trigger: create notifications on assignment + approvals.
CREATE OR REPLACE FUNCTION public.log_task_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
BEGIN
  actor_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM actor_id THEN
      PERFORM public.insert_notification(
        NEW.assignee_id,
        'task_assigned',
        'New ticket assignment',
        NEW.title,
        NEW.id
      );
    END IF;

    IF NEW.status = 'submitted'
      AND NEW.approval_state = 'pending'
      AND NEW.approver_user_id IS NOT NULL
      AND NEW.approver_user_id IS DISTINCT FROM actor_id
    THEN
      PERFORM public.insert_notification(
        NEW.approver_user_id,
        'task_approval_requested',
        'Approval requested',
        NEW.title,
        NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM actor_id THEN
        PERFORM public.insert_notification(
          NEW.assignee_id,
          'task_assigned',
          'New ticket assignment',
          NEW.title,
          NEW.id
        );
      END IF;
    END IF;

    IF NEW.status = 'submitted'
      AND NEW.approval_state = 'pending'
      AND NEW.approver_user_id IS NOT NULL
      AND (
        OLD.status IS DISTINCT FROM 'submitted'
        OR OLD.approval_state IS DISTINCT FROM 'pending'
        OR NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id
      )
      AND NEW.approver_user_id IS DISTINCT FROM actor_id
    THEN
      PERFORM public.insert_notification(
        NEW.approver_user_id,
        'task_approval_requested',
        'Approval requested',
        NEW.title,
        NEW.id
      );
    END IF;

    IF NEW.approval_state = 'approved' AND OLD.approval_state IS DISTINCT FROM 'approved' THEN
      IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM actor_id THEN
        PERFORM public.insert_notification(
          NEW.created_by,
          'task_approved',
          'Ticket approved',
          NEW.title,
          NEW.id
        );
      END IF;

      IF NEW.assignee_id IS NOT NULL
        AND NEW.assignee_id IS DISTINCT FROM actor_id
        AND NEW.assignee_id IS DISTINCT FROM NEW.created_by
      THEN
        PERFORM public.insert_notification(
          NEW.assignee_id,
          'task_approved',
          'Ticket approved',
          NEW.title,
          NEW.id
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_notifications ON public.tasks;
CREATE TRIGGER trg_task_notifications
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_notifications();

-- Marketing home inbox: counts + queue (marketing team only).
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

  SELECT COUNT(*) INTO assigned_count
  FROM public.tasks t
  WHERE t.assignee_id = uid
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
  SELECT COUNT(*) INTO overdue_count
  FROM base
  WHERE due_at IS NOT NULL
    AND due_at < CURRENT_DATE
    AND status NOT IN ('closed','dropped');

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO items
  FROM (
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      t.approval_state,
      t.approver_user_id,
      t.assignee_id,
      t.created_by,
      t.due_at,
      t.updated_at
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
    ORDER BY t.updated_at DESC
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

-- Realtime: add notifications table to publication (safe if already present).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
