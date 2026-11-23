-- Publish a 'new_message' realtime event whenever a chat message is inserted so
-- subscribed clients (Messages page) receive it instantly over the WebSocket
-- channel instead of polling. Mirrors the payload shape consumed by
-- src/pages/dashboard/Messages.tsx.
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'chat:' || NEW.chat_room_id::text,
    'new_message',
    jsonb_build_object(
      'id', NEW.id,
      'chat_room_id', NEW.chat_room_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content,
      'message_type', NEW.message_type,
      'file_url', NEW.file_url,
      'is_read', NEW.is_read,
      'read_at', NEW.read_at,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_new_message_trigger ON public.messages;
CREATE TRIGGER chat_new_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_message();