CREATE POLICY users_can_join_rooms ON public.chat_room_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
