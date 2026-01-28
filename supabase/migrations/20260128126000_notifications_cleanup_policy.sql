-- Allow users to delete their own notifications for cleanup.

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
FOR DELETE TO authenticated
USING (user_id = auth.uid());
