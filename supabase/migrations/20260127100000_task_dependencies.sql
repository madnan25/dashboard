-- Task dependencies: link tickets/subtasks and auto-block.

-- 1) Task-to-task dependencies
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  blocked_task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  reason text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_task_id, blocked_task_id),
  CONSTRAINT task_dependencies_no_self CHECK (blocker_task_id <> blocked_task_id)
);

CREATE INDEX IF NOT EXISTS task_dependencies_blocker_idx ON public.task_dependencies(blocker_task_id);
CREATE INDEX IF NOT EXISTS task_dependencies_blocked_idx ON public.task_dependencies(blocked_task_id);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_dependencies_select ON public.task_dependencies;
CREATE POLICY task_dependencies_select ON public.task_dependencies
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_dependencies_write ON public.task_dependencies;
CREATE POLICY task_dependencies_write ON public.task_dependencies
FOR ALL TO authenticated
USING (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team())
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

-- 2) Subtask dependencies (blocked subtask depends on a task or another subtask)
CREATE TABLE IF NOT EXISTS public.task_subtask_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_subtask_id uuid NOT NULL REFERENCES public.task_subtasks (id) ON DELETE CASCADE,
  blocker_task_id uuid REFERENCES public.tasks (id) ON DELETE CASCADE,
  blocker_subtask_id uuid REFERENCES public.task_subtasks (id) ON DELETE CASCADE,
  reason text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_subtask_dependencies_one_blocker CHECK (
    (blocker_task_id IS NOT NULL AND blocker_subtask_id IS NULL)
    OR (blocker_task_id IS NULL AND blocker_subtask_id IS NOT NULL)
  ),
  CONSTRAINT task_subtask_dependencies_no_self CHECK (
    blocker_subtask_id IS NULL OR blocker_subtask_id <> blocked_subtask_id
  )
);

CREATE INDEX IF NOT EXISTS task_subtask_dependencies_blocked_idx ON public.task_subtask_dependencies(blocked_subtask_id);
CREATE INDEX IF NOT EXISTS task_subtask_dependencies_blocker_task_idx ON public.task_subtask_dependencies(blocker_task_id);
CREATE INDEX IF NOT EXISTS task_subtask_dependencies_blocker_subtask_idx ON public.task_subtask_dependencies(blocker_subtask_id);
CREATE UNIQUE INDEX IF NOT EXISTS task_subtask_dependencies_task_unique
  ON public.task_subtask_dependencies(blocked_subtask_id, blocker_task_id)
  WHERE blocker_task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS task_subtask_dependencies_subtask_unique
  ON public.task_subtask_dependencies(blocked_subtask_id, blocker_subtask_id)
  WHERE blocker_subtask_id IS NOT NULL;

ALTER TABLE public.task_subtask_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_subtask_dependencies_select ON public.task_subtask_dependencies;
CREATE POLICY task_subtask_dependencies_select ON public.task_subtask_dependencies
FOR SELECT TO authenticated
USING (public.is_marketing_team());

DROP POLICY IF EXISTS task_subtask_dependencies_write ON public.task_subtask_dependencies;
CREATE POLICY task_subtask_dependencies_write ON public.task_subtask_dependencies
FOR ALL TO authenticated
USING (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team())
WITH CHECK (public.current_user_role() IN ('cmo','brand_manager','member') AND public.is_marketing_team());

-- 3) Dependency status helpers
CREATE OR REPLACE FUNCTION public.task_status_is_resolved(p_status public.task_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status::text IN ('approved','closed','dropped');
$$;

CREATE OR REPLACE FUNCTION public.subtask_stage_is_resolved(p_status public.task_subtask_stage)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status::text = 'done';
$$;

-- 4) Recompute blocked state for tasks/subtasks + linked tickets
CREATE OR REPLACE FUNCTION public.recompute_task_blocked_status(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_status public.task_status;
  has_unresolved boolean;
BEGIN
  IF p_task_id IS NULL THEN
    RETURN;
  END IF;

  SELECT status INTO cur_status
  FROM public.tasks
  WHERE id = p_task_id;

  IF cur_status IS NULL THEN
    RETURN;
  END IF;

  IF cur_status IN ('approved','closed','dropped') THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.task_dependencies d
    JOIN public.tasks t ON t.id = d.blocker_task_id
    WHERE d.blocked_task_id = p_task_id
      AND NOT public.task_status_is_resolved(t.status)
  ) INTO has_unresolved;

  IF has_unresolved THEN
    UPDATE public.tasks
    SET status = 'blocked'
    WHERE id = p_task_id
      AND status IS DISTINCT FROM 'blocked'
      AND status NOT IN ('approved','closed','dropped');
  ELSE
    UPDATE public.tasks
    SET status = 'queued'
    WHERE id = p_task_id
      AND status = 'blocked';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_linked_ticket_blocked_status(p_linked_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_status public.task_status;
  has_unresolved boolean;
BEGIN
  IF p_linked_task_id IS NULL THEN
    RETURN;
  END IF;

  SELECT status INTO cur_status
  FROM public.tasks
  WHERE id = p_linked_task_id;

  IF cur_status IS NULL THEN
    RETURN;
  END IF;

  IF cur_status IN ('approved','closed','dropped') THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.task_subtasks s
    WHERE s.linked_task_id = p_linked_task_id
      AND EXISTS (
        SELECT 1
        FROM public.task_subtask_dependencies d
        LEFT JOIN public.tasks bt ON bt.id = d.blocker_task_id
        LEFT JOIN public.task_subtasks bs ON bs.id = d.blocker_subtask_id
        WHERE d.blocked_subtask_id = s.id
          AND (
            (d.blocker_task_id IS NOT NULL AND NOT public.task_status_is_resolved(bt.status))
            OR (d.blocker_subtask_id IS NOT NULL AND NOT public.subtask_stage_is_resolved(bs.status))
          )
      )
  ) INTO has_unresolved;

  IF has_unresolved THEN
    UPDATE public.tasks
    SET status = 'blocked'
    WHERE id = p_linked_task_id
      AND status IS DISTINCT FROM 'blocked'
      AND status NOT IN ('approved','closed','dropped');
  ELSE
    UPDATE public.tasks
    SET status = 'queued'
    WHERE id = p_linked_task_id
      AND status = 'blocked';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_subtask_blocked_status(p_subtask_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_status public.task_subtask_stage;
  linked_task uuid;
  has_unresolved boolean;
BEGIN
  IF p_subtask_id IS NULL THEN
    RETURN;
  END IF;

  SELECT status, linked_task_id INTO cur_status, linked_task
  FROM public.task_subtasks
  WHERE id = p_subtask_id;

  IF cur_status IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.task_subtask_dependencies d
    LEFT JOIN public.tasks bt ON bt.id = d.blocker_task_id
    LEFT JOIN public.task_subtasks bs ON bs.id = d.blocker_subtask_id
    WHERE d.blocked_subtask_id = p_subtask_id
      AND (
        (d.blocker_task_id IS NOT NULL AND NOT public.task_status_is_resolved(bt.status))
        OR (d.blocker_subtask_id IS NOT NULL AND NOT public.subtask_stage_is_resolved(bs.status))
      )
  ) INTO has_unresolved;

  IF linked_task IS NOT NULL THEN
    PERFORM public.recompute_linked_ticket_blocked_status(linked_task);
    RETURN;
  END IF;

  IF cur_status = 'done' THEN
    RETURN;
  END IF;

  IF has_unresolved THEN
    UPDATE public.task_subtasks
    SET status = 'blocked'
    WHERE id = p_subtask_id
      AND status IS DISTINCT FROM 'blocked'
      AND status <> 'done';
  ELSE
    UPDATE public.task_subtasks
    SET status = 'not_done'
    WHERE id = p_subtask_id
      AND status = 'blocked';
  END IF;
END;
$$;

-- 5) Dependency triggers
CREATE OR REPLACE FUNCTION public.on_task_dependency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_task_blocked_status(NEW.blocked_task_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.blocked_task_id IS DISTINCT FROM OLD.blocked_task_id THEN
      PERFORM public.recompute_task_blocked_status(OLD.blocked_task_id);
    END IF;
    PERFORM public.recompute_task_blocked_status(NEW.blocked_task_id);
  ELSE
    PERFORM public.recompute_task_blocked_status(OLD.blocked_task_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_task_dependency_change ON public.task_dependencies;
CREATE TRIGGER trg_task_dependency_change
AFTER INSERT OR UPDATE OR DELETE ON public.task_dependencies
FOR EACH ROW EXECUTE FUNCTION public.on_task_dependency_change();

CREATE OR REPLACE FUNCTION public.on_task_status_dependency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep record;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR dep IN
      SELECT blocked_task_id
      FROM public.task_dependencies
      WHERE blocker_task_id = NEW.id
    LOOP
      PERFORM public.recompute_task_blocked_status(dep.blocked_task_id);
    END LOOP;

    FOR dep IN
      SELECT blocked_subtask_id
      FROM public.task_subtask_dependencies
      WHERE blocker_task_id = NEW.id
    LOOP
      PERFORM public.recompute_subtask_blocked_status(dep.blocked_subtask_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_status_dependency_change ON public.tasks;
CREATE TRIGGER trg_task_status_dependency_change
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.on_task_status_dependency_change();

CREATE OR REPLACE FUNCTION public.on_subtask_dependency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_subtask_blocked_status(NEW.blocked_subtask_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.blocked_subtask_id IS DISTINCT FROM OLD.blocked_subtask_id THEN
      PERFORM public.recompute_subtask_blocked_status(OLD.blocked_subtask_id);
    END IF;
    PERFORM public.recompute_subtask_blocked_status(NEW.blocked_subtask_id);
  ELSE
    PERFORM public.recompute_subtask_blocked_status(OLD.blocked_subtask_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_subtask_dependency_change ON public.task_subtask_dependencies;
CREATE TRIGGER trg_subtask_dependency_change
AFTER INSERT OR UPDATE OR DELETE ON public.task_subtask_dependencies
FOR EACH ROW EXECUTE FUNCTION public.on_subtask_dependency_change();

CREATE OR REPLACE FUNCTION public.on_subtask_status_dependency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep record;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR dep IN
      SELECT blocked_subtask_id
      FROM public.task_subtask_dependencies
      WHERE blocker_subtask_id = NEW.id
    LOOP
      PERFORM public.recompute_subtask_blocked_status(dep.blocked_subtask_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subtask_status_dependency_change ON public.task_subtasks;
CREATE TRIGGER trg_subtask_status_dependency_change
AFTER UPDATE OF status ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.on_subtask_status_dependency_change();

CREATE OR REPLACE FUNCTION public.on_subtask_linked_ticket_dependency_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.linked_task_id IS DISTINCT FROM OLD.linked_task_id THEN
    IF OLD.linked_task_id IS NOT NULL THEN
      PERFORM public.recompute_linked_ticket_blocked_status(OLD.linked_task_id);
    END IF;
    IF NEW.linked_task_id IS NOT NULL THEN
      PERFORM public.recompute_linked_ticket_blocked_status(NEW.linked_task_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subtask_linked_ticket_dependency_change ON public.task_subtasks;
CREATE TRIGGER trg_subtask_linked_ticket_dependency_change
AFTER UPDATE OF linked_task_id ON public.task_subtasks
FOR EACH ROW EXECUTE FUNCTION public.on_subtask_linked_ticket_dependency_change();
