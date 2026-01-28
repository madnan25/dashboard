-- Task comments: authors can edit/delete their own comments.
-- Marketing managers (and CMO) can delete other people's comments.
-- Comment edits/deletes should appear in the task Activity tab via task_events.

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- UPDATE: only the original author (no cross-user editing).
DROP POLICY IF EXISTS task_comments_update ON public.task_comments;
CREATE POLICY task_comments_update ON public.task_comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- DELETE: author OR marketing manager/CMO moderation.
DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;
CREATE POLICY task_comments_delete ON public.task_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_marketing_manager());

-- Activity logging for comment edits/deletes.
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
      VALUES (NEW.task_id, auth.uid(), 'comment_edited', NULL, NEW.id::text);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_events(task_id, actor_id, type, from_value, to_value)
    VALUES (OLD.task_id, auth.uid(), 'comment_deleted', NULL, OLD.id::text);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_task_comment_events_update ON public.task_comments;
CREATE TRIGGER trg_log_task_comment_events_update
AFTER UPDATE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.log_task_comment_events();

DROP TRIGGER IF EXISTS trg_log_task_comment_events_delete ON public.task_comments;
CREATE TRIGGER trg_log_task_comment_events_delete
AFTER DELETE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.log_task_comment_events();

