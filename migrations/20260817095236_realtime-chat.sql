-- Realtime chat channels: chat:<room_id> pattern
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('chat:%', 'Per-room chat messages', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description,
    enabled = EXCLUDED.enabled;

-- Publish a realtime event whenever a message row is inserted
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
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_message_realtime_trigger ON public.messages;
CREATE TRIGGER chat_message_realtime_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_message();

-- Only room members may subscribe to a chat:<room> channel
ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_subscribe_chat_channels
ON realtime.channels FOR SELECT
TO authenticated
USING (
  pattern = 'chat:%'
  AND EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE chat_room_id = NULLIF(split_part(realtime.channel_name(), ':', 2), '')::uuid
      AND user_id = (SELECT auth.uid())
  )
);

-- Only room members may publish onto a chat:<room> channel
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_publish_chat_messages
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  channel_name LIKE 'chat:%'
  AND EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE chat_room_id = NULLIF(split_part(channel_name, ':', 2), '')::uuid
      AND user_id = (SELECT auth.uid())
  )
);