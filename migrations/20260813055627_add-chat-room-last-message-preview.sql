ALTER TABLE public.chat_rooms ADD COLUMN last_message_preview text;
ALTER TABLE public.chat_rooms ADD COLUMN last_message_at timestamptz;

UPDATE public.chat_rooms r
SET last_message_preview = m.content,
    last_message_at = m.created_at
FROM (
  SELECT DISTINCT ON (chat_room_id) chat_room_id, content, created_at
  FROM public.messages
  ORDER BY chat_room_id, created_at DESC
) m
WHERE r.id = m.chat_room_id;
