import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { insforge } from '@/lib/insforge';
import { MessageSquare, Send, Search, Loader2, AlertCircle, Paperclip, Check, CheckCheck, FileText, Trash2 } from 'lucide-react';
import { useTranslation } from '@/contexts/I18nContext';
import { usePageMeta } from '@/hooks/usePageMeta';

interface ChatRoom {
  id: string;
  name: string | null;
  type: string;
  updated_at: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  last_message_sender_id?: string | null;
  unread_count?: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type?: string | null;
  file_url?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
  deleted_at?: string | null;
}

const ATTACHMENT_BUCKET = 'chat-attachments';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  if (diffMin < 10080) return `${Math.floor(diffMin / 1440)}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function Messages() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  usePageMeta('Messages');
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks the room whose fetches are still relevant, so a slow response for a
  // previously-active room can never overwrite the current room's messages.
  const activeRoomIdRef = useRef<string | null>(null);
  const activeRoomRef = useRef<ChatRoom | null>(null);

  const filteredRooms = rooms.filter(r =>
    (r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      if (!profile) {
        setRooms([]);
        return;
      }
      // Only rooms I am a member of — chat_rooms is world-readable by RLS,
      // so listing it directly would expose every conversation in the app.
      const { data: memberships, error: memError } = await insforge.database
        .from('chat_room_members')
        .select('chat_room_id')
        .eq('user_id', profile.id);
      if (memError) throw memError;
      const myRoomIds = Array.from(
        new Set(((memberships || []) as Array<{ chat_room_id: string }>).map((m) => m.chat_room_id))
      );
      if (myRoomIds.length === 0) {
        setRooms([]);
        return;
      }
      const { data, error: fetchError } = await insforge.database
        .from('chat_rooms')
        .select('id, name, type, updated_at, last_message_preview, last_message_at, last_message_sender_id')
        .in('id', myRoomIds)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      let roomRows = (data || []) as ChatRoom[];

      // For direct chats, show the *other* participant's name/company instead of the room's raw name
      // (room was created with seller's company name, so exporter would otherwise see own name)
      const directRooms = roomRows.filter((r) => r.type === 'direct');
      if (directRooms.length > 0 && profile) {
        try {
          const directIds = directRooms.map((r) => r.id);
          const { data: allMembers } = await insforge.database
            .from('chat_room_members')
            .select('chat_room_id, user_id')
            .in('chat_room_id', directIds);
          const membersByRoom = new Map<string, string[]>();
          for (const m of (allMembers || []) as Array<{ chat_room_id: string; user_id: string }>) {
            const arr = membersByRoom.get(m.chat_room_id) || [];
            arr.push(m.user_id);
            membersByRoom.set(m.chat_room_id, arr);
          }
          const otherIds: string[] = [];
          const roomToOther = new Map<string, string>();
          for (const room of directRooms) {
            const memberIds = membersByRoom.get(room.id) || [];
            const other = memberIds.find((uid) => uid !== profile.id);
            if (other) {
              otherIds.push(other);
              roomToOther.set(room.id, other);
            }
          }
          if (otherIds.length > 0) {
            const uniqOtherIds = Array.from(new Set(otherIds));
            const { data: users } = await insforge.database
              .from('users')
              .select('id, full_name')
              .in('id', uniqOtherIds);
            const displayByUser = new Map<string, string>();
            for (const u of (users || []) as Array<{ id: string; full_name: string | null }>) {
              if (u.full_name) displayByUser.set(u.id, u.full_name);
            }
            roomRows = roomRows.map((r) => {
              const otherId = roomToOther.get(r.id);
              if (r.type === 'direct' && otherId) {
                const display = displayByUser.get(otherId);
                if (display) return { ...r, name: display };
              }
              return r;
            });
          }
        } catch {
          /* non-fatal — fall back to raw room.name */
        }
      }

      // Unread badge: messages from others that I haven't read yet.
      // is_read is only flipped when the recipient opens the room, so
      // is_read=false + sender != me is a good proxy.
      const roomIds = roomRows.map(r => r.id);
      if (profile && roomIds.length > 0) {
        const { data: unread } = await insforge.database
          .from('messages')
          .select('chat_room_id')
          .in('chat_room_id', roomIds)
          .eq('is_read', false)
          .neq('sender_id', profile.id);
        const counts: Record<string, number> = {};
        for (const m of (unread || []) as Array<{ chat_room_id: string }>) {
          counts[m.chat_room_id] = (counts[m.chat_room_id] || 0) + 1;
        }
        setRooms(roomRows.map(r => ({ ...r, unread_count: counts[r.id] || 0 })));
      } else {
        setRooms(roomRows);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to load messages.'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Realtime sidebar: subscribe to every room so last_message_preview/unread updates for *any* room, not just activeRoom
  const roomIdsKey = rooms.map((r) => r.id).join(',');
  useEffect(() => {
    if (rooms.length === 0 || !profile) return;
    const onPreview = (payload: { meta?: { channel?: string }; chat_room_id?: string; content?: string; message_type?: string; sender_id?: string; created_at?: string } & Partial<Message>) => {
      const roomId = (payload as { chat_room_id?: string }).chat_room_id;
      if (!roomId) return;
      const ch = payload.meta?.channel;
      if (ch && ch !== `chat:${roomId}` && ch !== `realtime:chat:${roomId}`) return;
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                updated_at: (payload as { created_at?: string }).created_at || r.updated_at,
                last_message_preview: payload.message_type === 'text' ? payload.content ?? r.last_message_preview : payload.content ? t('Attachment') : r.last_message_preview,
                last_message_at: (payload as { created_at?: string }).created_at || r.last_message_at,
                last_message_sender_id: (payload as { sender_id?: string }).sender_id || r.last_message_sender_id,
                unread_count: payload.sender_id === profile.id ? r.unread_count : activeRoomRef.current?.id === roomId ? 0 : (r.unread_count ?? 0) + 1,
              }
            : r
        )
      );
    };
    insforge.realtime.on('new_message', onPreview);
    const onDeletedPreview = (payload: { meta?: { channel?: string }; chat_room_id?: string; id?: string }) => {
      const roomId = (payload as { chat_room_id?: string }).chat_room_id;
      if (!roomId) return;
      const ch = payload.meta?.channel;
      if (ch && ch !== `chat:${roomId}` && ch !== `realtime:chat:${roomId}`) return;
      if (activeRoomRef.current?.id === roomId) return;
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, last_message_preview: 'This message was deleted', last_message_at: new Date().toISOString() } : r)));
    };
    insforge.realtime.on('message_deleted', onDeletedPreview);
    const channels = rooms.map((r) => `chat:${r.id}`);
    for (const ch of channels) insforge.realtime.subscribe(ch).catch(() => {});
    return () => {
      insforge.realtime.off('new_message', onPreview);
      insforge.realtime.off('message_deleted', onDeletedPreview);
      for (const ch of channels) insforge.realtime.unsubscribe(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIdsKey, profile, t]);

  // Realtime: new conversation count — both sides update when Contact Seller creates a room
  useEffect(() => {
    if (!profile) return;
    const channel = `rooms:${profile.id}`;
    const onNewRoom = () => fetchRooms();
    insforge.realtime.on('new_room', onNewRoom);
    insforge.realtime.subscribe(channel).catch(() => {});
    return () => {
      insforge.realtime.off('new_room', onNewRoom);
      insforge.realtime.unsubscribe(channel);
    };
  }, [profile, fetchRooms]);

  // Auto-select room from ?room= param (used by Contact Seller)
  useEffect(() => {
    const roomId = searchParams.get('room');
    if (roomId && rooms.length > 0 && !activeRoom) {
      const found = rooms.find((r) => r.id === roomId);
      if (found) setActiveRoom(found);
    }
  }, [rooms, searchParams, activeRoom]);

  const ensureMembership = useCallback(async (roomId: string) => {
    if (!profile) return;
    try {
      await insforge.database
        .from('chat_room_members')
        .insert([{ chat_room_id: roomId, user_id: profile.id }])
        .select()
        .single();
    } catch {
      /* already a member or not permitted — ignore */
    }
  }, [profile]);

  const markRoomRead = useCallback(async (roomId: string) => {
    if (!profile) return;
    try {
      const now = new Date().toISOString();
      // Mark incoming messages as read (trigger publishes 'message_read').
      await insforge.database
        .from('messages')
        .update({ is_read: true, read_at: now })
        .eq('chat_room_id', roomId)
        .neq('sender_id', profile.id)
        .eq('is_read', false);
      // Track my own watermark so future unread badges are accurate.
      await insforge.database
        .from('chat_room_members')
        .update({ last_read_at: now })
        .eq('chat_room_id', roomId)
        .eq('user_id', profile.id);
      setRooms(prev => prev.map(r => (r.id === roomId ? { ...r, unread_count: 0 } : r)));
      setMessages(prev => prev.map(m =>
        m.sender_id !== profile.id && !m.is_read ? { ...m, is_read: true, read_at: now } : m
      ));
    } catch {
      /* best-effort */
    }
  }, [profile]);

  const fetchMessages = useCallback(async (roomId: string) => {
    try {
      const { data, error: msgError } = await insforge.database
        .from('messages')
        .select('*')
        .eq('chat_room_id', roomId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;
      // Ignore stale responses — the user may have switched rooms mid-flight.
      if (activeRoomIdRef.current !== roomId) return;
      setMessages(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    activeRoomIdRef.current = activeRoom?.id ?? null;
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;
    const load = () => fetchMessages(activeRoom.id);
    const channel = `chat:${activeRoom.id}`;
    // Join the room so RLS permits reading (and seeing) its messages.
    ensureMembership(activeRoom.id).finally(() => {
      if (!cancelled) {
        load();
        markRoomRead(activeRoom.id);
      }
    });

    // Realtime: a DB trigger publishes 'new_message' with the inserted row,
    // so new messages appear instantly without polling.
    const isChannelMatch = (metaChannel?: string) =>
      metaChannel === channel || metaChannel === `realtime:${channel}`;
    const onNewMessage = (payload: { meta?: { channel?: string }; chat_room_id?: string } & Partial<Message>) => {
      if (cancelled) return;
      const ch = payload.meta?.channel;
      if (ch) {
        if (!isChannelMatch(ch)) return;
      } else if ((payload as { chat_room_id?: string }).chat_room_id && (payload as { chat_room_id?: string }).chat_room_id !== activeRoom.id) {
        return;
      }
      const msg = payload as Message;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      // The user is looking at the room, so incoming messages are read immediately.
      if (msg.sender_id !== profile?.id) {
        markRoomRead(activeRoom.id);
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoom.id
            ? {
                ...r,
                updated_at: msg.created_at,
                last_message_preview: msg.message_type === 'text' ? msg.content : t('Attachment'),
                last_message_at: msg.created_at,
                last_message_sender_id: msg.sender_id,
                unread_count: msg.sender_id === profile?.id ? r.unread_count : 0,
              }
            : r
        )
      );
    };
    const onMessageRead = (payload: { meta?: { channel?: string }; reader_id?: string; chat_room_id?: string } & Partial<Message>) => {
      if (cancelled) return;
      const ch2 = payload.meta?.channel;
      if (ch2 && !isChannelMatch(ch2)) return;
      if (!ch2 && (payload as { chat_room_id?: string }).chat_room_id && (payload as { chat_room_id?: string }).chat_room_id !== activeRoom.id) return;
      if (payload.reader_id === profile?.id) {
        // My own read receipt — clear the unread badge locally.
        setRooms((prev) => prev.map((r) => (r.id === activeRoom.id ? { ...r, unread_count: 0 } : r)));
      }
      setMessages((prev) => prev.map((m) =>
        m.id === payload.id ? { ...m, is_read: true, read_at: payload.read_at ?? m.read_at } : m
      ));
    };
    const onMessageDeleted = (payload: { meta?: { channel?: string }; chat_room_id?: string; id?: string; content?: string; deleted_at?: string; file_url?: string | null }) => {
      if (cancelled) return;
      const ch3 = payload.meta?.channel;
      if (ch3 && !isChannelMatch(ch3)) return;
      if (!ch3 && payload.chat_room_id && payload.chat_room_id !== activeRoom.id) return;
      const id = payload.id;
      if (!id) return;
      const deletedAt = payload.deleted_at || new Date().toISOString();
      const content = payload.content || 'This message was deleted';
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === id ? { ...m, deleted_at: deletedAt, content, file_url: null } : m));
        const lastMsg = [...updated].reverse().find((m) => !m.deleted_at);
        const preview = lastMsg ? (lastMsg.message_type === 'text' ? lastMsg.content : t('Attachment')) : 'This message was deleted';
        const lastAt = lastMsg ? lastMsg.created_at : deletedAt;
        setRooms((rPrev) =>
          rPrev.map((r) =>
            r.id === activeRoom.id ? { ...r, last_message_preview: preview, last_message_at: lastAt, last_message_sender_id: lastMsg?.sender_id || r.last_message_sender_id } : r
          )
        );
        return updated;
      });
    };
    insforge.realtime.on('new_message', onNewMessage);
    insforge.realtime.on('message_read', onMessageRead);
    insforge.realtime.on('message_deleted', onMessageDeleted);
    insforge.realtime
      .subscribe(channel)
      .catch(() => {});

    return () => {
      cancelled = true;
      insforge.realtime.off('new_message', onNewMessage);
      insforge.realtime.off('message_read', onMessageRead);
      insforge.realtime.off('message_deleted', onMessageDeleted);
      insforge.realtime.unsubscribe(channel);
    };
  }, [activeRoom, ensureMembership, fetchMessages, markRoomRead, profile, t]);

  const persistPreview = async (roomId: string, content: string, messageType: string, createdAt: string, senderId: string) => {
    // The DB trigger keeps chat_rooms in sync; this local update makes the
    // sidebar reflect the send instantly.
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? {
              ...r,
              updated_at: createdAt,
              last_message_preview: messageType === 'text' ? content : t('Attachment'),
              last_message_at: createdAt,
              last_message_sender_id: senderId,
            }
          : r
      )
    );
  };

  const insertMessage = async (payload: Record<string, unknown>) => {
    if (!activeRoom || !profile) return;
    await ensureMembership(activeRoom.id);
    const { error: sendError } = await insforge.database
      .from('messages')
      .insert([{ chat_room_id: activeRoom.id, sender_id: profile.id, ...payload }]);

    if (sendError) throw sendError;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || !profile) return;

    try {
      setSending(true);
      const content = newMessage;
      await insertMessage({ content, message_type: 'text' });
      setNewMessage('');
      await fetchMessages(activeRoom.id);
      await persistPreview(activeRoom.id, content, 'text', new Date().toISOString(), profile.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to send message.'));
    } finally {
      setSending(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeRoom || !profile) return;

    try {
      setUploadingFile(true);
      setError(null);
      const ext = file.name.split('.').pop() || 'bin';
      const key = `rooms/${activeRoom.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await insforge.storage.from(ATTACHMENT_BUCKET).upload(key, file);
      if (res.error) throw res.error;
      const url =
        res.data?.url ||
        (insforge.storage.from(ATTACHMENT_BUCKET).getPublicUrl(key).data?.publicUrl ?? '');
      const isImage = file.type.startsWith('image/');
      await insertMessage({
        content: file.name,
        message_type: isImage ? 'image' : 'file',
        file_url: url,
      });
      await fetchMessages(activeRoom.id);
      await persistPreview(activeRoom.id, file.name, 'file', new Date().toISOString(), profile.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to send message.'));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!profile || !activeRoom) return;
    if (!window.confirm(t('Delete this message?'))) return;
    try {
      const now = new Date().toISOString();
      const { error } = await insforge.database
        .from('messages')
        .update({ deleted_at: now, content: 'This message was deleted', file_url: null })
        .eq('id', messageId)
        .eq('sender_id', profile.id);
      if (error) throw error;

      const updated = messages.map((m) =>
        m.id === messageId ? { ...m, deleted_at: now, content: 'This message was deleted', file_url: null } : m
      );
      setMessages(updated);

      const lastMsg = [...updated].reverse().find((m) => !m.deleted_at);
      const preview = lastMsg
        ? (lastMsg.message_type === 'text' ? lastMsg.content : t('Attachment'))
        : 'No messages yet';
      const lastAt = lastMsg ? lastMsg.created_at : now;

      await insforge.database
        .from('chat_rooms')
        .update({ last_message_preview: preview, last_message_at: lastAt, last_message_sender_id: lastMsg?.sender_id ?? profile.id })
        .eq('id', activeRoom.id);

      setRooms((prev) =>
        prev.map((r) =>
          r.id === activeRoom.id
            ? { ...r, last_message_preview: preview, last_message_at: lastAt, last_message_sender_id: lastMsg?.sender_id ?? profile.id }
            : r
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to delete message.'));
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!profile) return;
    if (!window.confirm(t('Delete this conversation?'))) return;
    try {
      const { error } = await insforge.database
        .from('chat_room_members')
        .delete()
        .eq('chat_room_id', roomId)
        .eq('user_id', profile.id);
      if (error) throw error;
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (activeRoom?.id === roomId) {
        setActiveRoom(null);
        setSearchParams({}, { replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to delete conversation.'));
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6 animate-fade-in">
      {/* Left Sidebar - Chat List */}
      <div className="w-80 flex flex-col glass-strong rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-bg-secondary/50">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary-500" />
            {t('Messages')}
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder={t('Search conversations...')}
              className="w-full bg-bg-tertiary border-none rounded-xl pl-9 py-2 text-sm focus:ring-2 focus:ring-primary-500/20"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} className="group relative">
                <button
                  onClick={() => {
                    setActiveRoom(room);
                    setSearchParams({ room: room.id }, { replace: true });
                  }}
                  className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${
                    activeRoom?.id === room.id 
                      ? 'bg-primary-500/10 border-primary-500/20' 
                      : 'hover:bg-bg-tertiary border-transparent'
                  } border`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white shrink-0 shadow-inner">
                    {room.name?.charAt(0) || '?'}
                  </div>
                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5 gap-2">
                      <h3 className={`text-sm font-semibold truncate ${activeRoom?.id === room.id ? 'text-primary-500' : 'text-text-primary'}`}>
                         {room.name || t('Chat')}
                      </h3>
                      <span className="text-xs text-text-tertiary shrink-0">
                        {formatTimestamp(room.last_message_at || room.updated_at)}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary truncate">
                      {room.last_message_preview || t('No messages yet')}
                    </p>
                  </div>
                  {(room.unread_count ?? 0) > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {Math.min(room.unread_count ?? 0, 9)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                  className="absolute bottom-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger-500/10 text-text-tertiary hover:text-danger-500 transition-opacity"
                  title={t('Delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Area - Chat Window */}
      <div className="flex-1 flex flex-col glass-strong rounded-2xl border border-border overflow-hidden">
        {activeRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border/50 bg-bg-secondary/50 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white shadow-inner">
                {activeRoom.name?.charAt(0) || '?'}
              </div>
              <div>
                <h3 className="font-bold text-text-primary">{activeRoom.name || t('Chat')}</h3>
                <p className="text-xs text-text-secondary flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success-500" /> {t('Online')}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
              {messages.map(msg => {
                const isMe = msg.sender_id === profile?.id;
                const isDeleted = !!msg.deleted_at;
                const isImage = msg.message_type === 'image';
                const isFile = msg.message_type === 'file';
                if (isDeleted) {
                  return (
                    <div key={msg.id} className={`flex gap-3 max-w-[80%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs text-white ${isMe ? 'bg-primary-600' : 'bg-surface-600'}`}>
                        {isMe ? ((profile?.full_name || '?').charAt(0)) : (activeRoom.name?.charAt(0) || '?')}
                      </div>
                      <div className={`p-3 rounded-2xl border ${isMe ? 'bg-primary-500/60 text-white/80 rounded-tr-sm' : 'bg-bg-secondary border-border text-text-tertiary rounded-tl-sm'} opacity-60 italic`}>
                        <p className="text-sm flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t('This message was deleted')}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-white/60' : 'text-text-tertiary'}`}>
                          {formatTimestamp(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={`flex gap-3 max-w-[80%] group ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs text-white ${isMe ? 'bg-primary-600' : 'bg-surface-600'}`}>
                      {isMe ? ((profile?.full_name || '?').charAt(0)) : (activeRoom.name?.charAt(0) || '?')}
                    </div>
                    <div className={`p-3 rounded-2xl ${isMe ? 'bg-primary-500 text-white rounded-tr-sm shadow-md shadow-primary-500/20' : 'bg-bg-secondary border border-border text-text-primary rounded-tl-sm'}`}>
                      {isImage && msg.file_url ? (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={msg.file_url} alt={msg.content} className="max-w-xs max-h-56 rounded-lg object-cover" />
                        </a>
                      ) : isFile && msg.file_url ? (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-sm font-medium underline-offset-2 ${isMe ? 'text-white underline' : 'text-primary-500 underline'}`}>
                          <FileText className="w-4 h-4 shrink-0" />
                          {msg.content || t('Attachment')}
                        </a>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-white/70' : 'text-text-tertiary'}`}>
                        {formatTimestamp(msg.created_at)}
                        {isMe && (msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-success-300" /> : <Check className="w-3.5 h-3.5" />)}
                      </div>
                    </div>
                    {isMe && (
                      <button type="button" onClick={() => handleDeleteMessage(msg.id)} className="self-center p-1.5 opacity-0 group-hover:opacity-100 hover:text-danger-500 text-text-tertiary transition-opacity" title={t('Delete')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border/50 bg-bg-secondary/30">
              {error && (
                <div className="mb-2 p-2 bg-danger-500/10 border border-danger-500/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-danger-500 shrink-0" />
                  <p className="text-xs text-danger-500">{error}</p>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || sending}
                  className="btn px-3 bg-bg-tertiary text-text-primary hover:bg-border shrink-0"
                  aria-label={t('Attach file')}
                  title={t('Attach file')}
                >
                  {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>
                <input
                  type="text"
                  placeholder={t('Type your message...')}
                  className="flex-1 input bg-bg py-3 border-transparent focus:bg-bg-secondary shadow-inner"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={!newMessage.trim() || sending || uploadingFile}
                  className="btn btn-primary px-4 shadow-lg shadow-primary-500/20"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-primary-500" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">{t('Your Messages')}</h3>
            <p className="text-text-secondary max-w-sm">
              {t('Select a conversation from the sidebar to start chatting with verified buyers and exporters.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}