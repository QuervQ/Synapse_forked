import { useState, useEffect, useRef } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSession } from '../lib/supabase';
import { createOrGetRoom, joinRoom, leaveRoom } from '../lib/rooms';
import '../styles/RoomPage.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

interface Message {
    id?: string; // Optional because we might not have it immediately for temp messages, though here we will always try to have it
    user: string;
    userId: string;
    text: string;
    timestamp: number;
}

interface CursorData {
    user: string;
    x: number;
    y: number;
    color: string;
}

interface ChatInterfaceProps {
    roomId: string;
    onClose?: () => void;
}

export default function ChatInterface({ roomId, onClose }: ChatInterfaceProps) {
    const [username, setUsername] = useState('');
    const [userId, setUserId] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map());
    const [loading, setLoading] = useState(true);
    const supabaseRef = useRef<any>(null);
    const cursorChannelRef = useRef<RealtimeChannel | null>(null);
    const chatChannelRef = useRef<RealtimeChannel | null>(null);
    const myUserIdRef = useRef<string>('');
    const myColorRef = useRef<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Helper to add messages without duplicates
    const addMessages = (newMsgs: Message | Message[]) => {
        setMessages(prev => {
            const msgsToAdd = Array.isArray(newMsgs) ? newMsgs : [newMsgs];
            const existingIds = new Set(prev.map(m => m.id));
            const uniqueMsgs = msgsToAdd.filter(m => !m.id || !existingIds.has(m.id));

            if (uniqueMsgs.length === 0) return prev;

            return [...prev, ...uniqueMsgs].sort((a, b) => a.timestamp - b.timestamp);
        });
    };

    useEffect(() => {
        const initializeRoom = async () => {
            try {
                const session = await getSession();
                if (!session?.user?.email) {
                    // Logic to handle unauthenticated user inside the component
                    alert('ログインが必要です');
                    if (onClose) onClose();
                    return;
                }

                const email = session.user.email;
                const local = email.split('@')[0];
                const cleaned = local.replace(/[._]+/g, ' ');
                const words = cleaned.split(/\s+/).filter(Boolean);
                const displayName = words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                setUsername(displayName);
                setUserId(session.user.id);
                myUserIdRef.current = session.user.id;
                myColorRef.current = colors[Math.floor(Math.random() * colors.length)];

                if (!roomId) {
                    return;
                }

                const { data: room, error: roomError } = await createOrGetRoom(roomId, session.user.id);

                if (roomError || !room) {
                    console.error('Room creation failed:', roomError);
                    alert('ルームの作成に失敗しました');
                    if (onClose) onClose();
                    return;
                }

                setCurrentRoomId(room.id);

                const { error: joinError } = await joinRoom(room.id, session.user.id, displayName);

                if (joinError) {
                    console.error('Join room failed:', joinError);
                }

                // Initialize supabase client for data fetching if not already available in scope
                const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

                // Fetch message history
                const { data: history, error: historyError } = await supabaseClient
                    .from('messages')
                    .select('*')
                    .eq('room_id', room.id)
                    .order('created_at', { ascending: true });

                if (!historyError && history) {
                    const formattedHistory: Message[] = history.map((m: any) => ({
                        id: m.id,
                        user: m.user_name,
                        userId: m.user_id, // Ensure your table has this column or adjust schema
                        text: m.content || m.text,
                        timestamp: new Date(m.created_at).getTime(),
                    }));
                    addMessages(formattedHistory);
                }

                initializeSupabase(supabaseClient);
            } catch (error) {
                console.error('Room initialization failed:', error);
                if (onClose) onClose();
            } finally {
                setLoading(false);
            }
        };

        setMessages([]); // Clear messages when switching rooms
        setLoading(true);
        initializeRoom();

        return () => {
            if (currentRoomId && userId) {
                leaveRoom(currentRoomId, userId);
            }

            if (cursorChannelRef.current) {
                cursorChannelRef.current.unsubscribe();
            }
            if (chatChannelRef.current) {
                chatChannelRef.current.unsubscribe();
            }
        };
    }, [roomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const initializeSupabase = (client?: any) => {
        const supabase = client || createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        supabaseRef.current = supabase;

        const cursorChannel = supabase.channel(`cursor:${roomId}`, {
            config: {
                presence: {
                    key: myUserIdRef.current,
                },
            },
        });

        cursorChannel
            .on('presence', { event: 'sync' }, () => {
                const state = cursorChannel.presenceState();
                updateCursors(state);
                setOnlineCount(Object.keys(state).length);
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                setCursors(prev => {
                    const newCursors = new Map(prev);
                    newCursors.delete(key);
                    return newCursors;
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await cursorChannel.track({
                        user: username,
                        x: 0,
                        y: 0,
                        color: myColorRef.current,
                    });
                }
            });

        cursorChannelRef.current = cursorChannel;

        // DB Subscription for Chat
        const chatChannel = supabase.channel(`chat:${roomId}-db`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`,
                },
                (payload) => {
                    const newMsg = payload.new;
                    const formattedMsg: Message = {
                        id: newMsg.id,
                        user: newMsg.user_name,
                        userId: newMsg.user_id,
                        text: newMsg.content,
                        timestamp: new Date(newMsg.created_at).getTime(),
                    };
                    addMessages(formattedMsg);
                }
            )
            .subscribe();

        chatChannelRef.current = chatChannel;
    };

    const updateCursors = (state: any) => {
        const newCursors = new Map<string, CursorData>();
        Object.entries(state).forEach(([userId, presence]: [string, any]) => {
            if (userId !== myUserIdRef.current && presence[0]) {
                const data = presence[0];
                newCursors.set(userId, {
                    user: data.user,
                    x: data.x,
                    y: data.y,
                    color: data.color,
                });
            }
        });
        setCursors(newCursors);
    };

    const handleMouseMove = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cursorChannelRef.current) return;

        const x = e.clientX;
        const y = e.clientY;

        await cursorChannelRef.current.track({
            user: username,
            x: x,
            y: y,
            color: myColorRef.current,
        });
    };

    const handleSendMessage = async () => {
        const message = messageInput.trim();
        if (!message || !supabaseRef.current) return;

        // Clear input immediately for better feel
        setMessageInput('');

        // Insert into DB and select return data to get ID and timestamp
        const { data, error } = await supabaseRef.current
            .from('messages')
            .insert({
                room_id: roomId,
                user_id: myUserIdRef.current,
                user_name: username,
                content: message,
            })
            .select()
            .single();

        if (error) {
            console.error('Error sending message:', error);
            alert('メッセージの送信に失敗しました');
            // Restore input if failed (optional, but good UX)
            setMessageInput(message);
            return;
        }

        if (data) {
            const formattedMsg: Message = {
                id: data.id,
                user: data.user_name,
                userId: data.user_id,
                text: data.content,
                timestamp: new Date(data.created_at).getTime(),
            };
            addMessages(formattedMsg);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    if (loading) {
        return (
            <div className="room-page" style={{ position: 'relative', height: '100%', width: '100%' }}>
                <div className="room-loading">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="room-page" style={{ position: 'relative', height: '100%', width: '100%' }}>
            <div className="cursor-area" onMouseMove={handleMouseMove}>

                <div className="chat-container">
                    <div className="chat-header">
                        <span>💬 {roomId}</span>
                        <span className="online-count">👤 {onlineCount}人</span>
                        {onClose && (
                            <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'white' }}>×</button>
                        )}
                    </div>
                    <div className="messages">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`message ${msg.userId === myUserIdRef.current ? 'own' : ''}`}
                            >
                                <div className="message-user">{msg.user}</div>
                                <div className="message-text">{msg.text}</div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="input-container">
                        <input
                            type="text"
                            className="message-input"
                            placeholder="メッセージを入力..."
                            maxLength={200}
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                        />
                        <button className="send-button" onClick={handleSendMessage}>
                            送信
                        </button>
                    </div>
                </div>

                {Array.from(cursors.entries()).map(([userId, data]) => (
                    <div
                        key={userId}
                        className="cursor"
                        style={{
                            left: `${data.x}px`,
                            top: `${data.y}px`,
                            backgroundColor: data.color,
                        }}
                        data-user={data.user}
                    />
                ))}
            </div>
        </div>
    );
}
