-- Allow users to create notifications addressed to themselves (in-app delivery)
CREATE POLICY "users_can_insert_own_notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to mark their own notifications as read
CREATE POLICY "users_can_update_own_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());