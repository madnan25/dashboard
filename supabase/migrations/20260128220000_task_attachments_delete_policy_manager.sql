-- Allow marketing managers to delete attachments
DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;
CREATE POLICY task_attachments_delete ON public.task_attachments
FOR DELETE TO authenticated
USING (public.is_marketing_team() AND (uploader_id = auth.uid() OR public.is_marketing_manager()));
