-- ============================================================================
-- Fix two chat realtime bugs:
--   1. `messages` had two AFTER INSERT triggers both calling
--      notify_chat_message() — the old chat_message_realtime_trigger
--      (from 20260817095236_realtime-chat.sql, slim payload) and the newer
--      chat_new_message_trigger (from 20260819100000_chat-new-message-trigger.sql,
--      rich payload). Every new message fired the realtime event twice.
--      The newer migration only DROPs its own trigger name, so the old one
--      survived. Keep the rich-payload trigger; drop the legacy one.
--   2. notify_chat_read() published reader_id = NEW.sender_id, which is the
--      *author* of the message — not the user who marked it read. The Messages
--      UI uses `payload.reader_id === profile?.id` to decide if the current
--      user was the reader, so the field has to be the actor of the UPDATE.
--      SECURITY DEFINER + auth.uid() returns the JWT subject of the caller,
--      which is correct.
-- ============================================================================

DROP TRIGGER IF EXISTS chat_message_realtime_trigger ON public.messages;

CREATE OR REPLACE FUNCTION public.notify_chat_read()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'chat:' || NEW.chat_room_id::text,
    'message_read',
    jsonb_build_object(
      'id', NEW.id,
      'chat_room_id', NEW.chat_room_id,
      'reader_id', auth.uid(),
      'is_read', true,
      'read_at', NEW.read_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
