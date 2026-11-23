-- Read receipts were silently dropped: messages and chat_room_members had RLS
-- enabled but no UPDATE policies, so PostgREST filtered every PATCH to zero
-- rows (is_read / read_at / last_read_at never persisted and unread badges
-- reappeared after reload). Add scoped UPDATE policies matching the app's
-- markRoomRead flow in src/pages/dashboard/Messages.tsx.

-- Recipients (room members, not the sender) may flip is_read on incoming
-- messages. Only the read fields change; WITH CHECK keeps the row in a room
-- the actor belongs to.
DROP POLICY IF EXISTS room_members_can_mark_messages_read ON public.messages;
CREATE POLICY room_members_can_mark_messages_read ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.chat_room_id = messages.chat_room_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.chat_room_id = messages.chat_room_id
        AND m.user_id = auth.uid()
    )
  );

-- Members maintain their own unread watermark.
DROP POLICY IF EXISTS users_can_update_own_memberships ON public.chat_room_members;
CREATE POLICY users_can_update_own_memberships ON public.chat_room_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
