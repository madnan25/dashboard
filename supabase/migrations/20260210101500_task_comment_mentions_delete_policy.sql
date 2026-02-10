-- Allow comment authors (and CMO/marketing managers) to remove mentions on edit.
-- Needed so edited comments can re-sync @mentions cleanly.

ALTER TABLE public.task_comment_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_comment_mentions_delete ON public.task_comment_mentions;
CREATE POLICY task_comment_mentions_delete
  ON public.task_comment_mentions
  FOR DELETE TO authenticated
  USING (
    public.is_marketing_team()
    AND EXISTS (
      SELECT 1
      FROM public.task_comments c
      WHERE c.id = public.task_comment_mentions.comment_id
        AND (
          c.author_id = auth.uid()
          OR public.current_user_role() = 'cmo'
          OR public.is_marketing_manager_member(auth.uid())
        )
    )
  );

