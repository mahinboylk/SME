-- Chat read receipts & attachments support.
-- 1. Track who sent the last message so the UI can show unread badges.
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS last_message_sender_id uuid;

-- 2. Publish read-receipt events for already-open rooms.
CREATE OR REPLACE FUNCTION public.notify_chat_read()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'chat:' || NEW.chat_room_id::text,
    'message_read',
    jsonb_build_object(
      'id', NEW.id,
      'chat_room_id', NEW.chat_room_id,
      'reader_id', NEW.sender_id,
      'is_read', true,
      'read_at', NEW.read_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_message_read_trigger ON public.messages;
CREATE TRIGGER chat_message_read_trigger
AFTER UPDATE OF is_read ON public.messages
FOR EACH ROW
WHEN (NEW.is_read = true AND (OLD.is_read IS NOT TRUE OR OLD.read_at IS DISTINCT FROM NEW.read_at))
EXECUTE FUNCTION public.notify_chat_read();

-- 3. Keep chat_rooms.last_message_sender_id in sync whenever a message is
--    inserted (supersedes the app-side preview update for the sender field).
CREATE OR REPLACE FUNCTION public.sync_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_rooms
  SET last_message_preview = CASE WHEN NEW.message_type = 'text' THEN NEW.content ELSE '[attachment]' END,
      last_message_at = NEW.created_at,
      last_message_sender_id = NEW.sender_id,
      updated_at = NEW.created_at
  WHERE id = NEW.chat_room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_room_last_message_trigger ON public.messages;
CREATE TRIGGER chat_room_last_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_chat_room_last_message();
