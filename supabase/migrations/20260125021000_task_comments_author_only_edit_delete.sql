-- Comments: only the original author can edit or delete their own comment.
-- Managers/CMO should not be able to edit/delete other people's comments.

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comments_update ON public.task_comments;
CREATE POLICY task_comments_update ON public.task_comments
FOR UPDATE TO authenticated
USING (author_id = auth.uid() AND public.is_marketing_team())
WITH CHECK (author_id = auth.uid() AND public.is_marketing_team());

DROP POLICY IF EXISTS task_comments_delete ON public.task_comments;
CREATE POLICY task_comments_delete ON public.task_comments
FOR DELETE TO authenticated
USING (author_id = auth.uid() AND public.is_marketing_team());

