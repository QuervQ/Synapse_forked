import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSession } from '../lib/supabase';
import { createOrGetRoom, joinRoom, leaveRoom } from '../lib/rooms';
import '../styles/RoomPage.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

interface Message {
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

export default function RoomPage() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [userId, setUserId] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map());
    const [displayName] = useState('');
    const [loading, setLoading] = useState(true);
    const supabaseRef = useRef<any>(null);
    const cursorChannelRef = useRef<RealtimeChannel | null>(null);
    const chatChannelRef = useRef<RealtimeChannel | null>(null);
    const myUserIdRef = useRef<string>('');
    const myColorRef = useRef<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initializeRoom = async () => {
            try {
                const session = await getSession();
                if (!session?.user?.email) {
                    alert('ログインが必要です');
                    navigate('/');
                    return;
                }

                const email = session.user.email;
                const local = email.split('@')[0];
                const cleaned = local.replace(/[._]+/g, ' ');
                const words = cleaned.split(/\s+/).filter(Boolean);
                const displayName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                setUsername(displayName);
                setUserId(session.user.id);
                myUserIdRef.current = session.user.id;
                myColorRef.current = colors[Math.floor(Math.random() * colors.length)];

                if (!roomId) {
                    alert('ルームIDが無効です');
                    navigate('/');
                    return;
                }

                const { data: room, error: roomError } = await createOrGetRoom(roomId, session.user.id);

                if (roomError || !room) {
                    console.error('Room creation failed:', roomError);
                    alert('ルームの作成に失敗しました');
                    navigate('/');
                    return;
                }

                setCurrentRoomId(room.id);

                const { error: joinError } = await joinRoom(room.id, session.user.id, displayName);

                if (joinError) {
                    console.error('Join room failed:', joinError);
                }

                initializeSupabase();
            } catch (error) {
                console.error('Room initialization failed:', error);
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

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
    }, [roomId, navigate]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const initializeSupabase = () => {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

        const chatChannel = supabase.channel(`chat:${roomId}`);

        chatChannel
            .on('broadcast', { event: 'message' }, ({ payload }: { payload: Message }) => {
                setMessages(prev => {
                    const messageExists = prev.some(msg => 
                        msg.userId === payload.userId && 
                        msg.timestamp === payload.timestamp &&
                        msg.text === payload.text
                    );
                    return messageExists ? prev : [...prev, payload];
                });
            })
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
        if (!message || !chatChannelRef.current) return;

        const newMessage = {
            user: username,
            userId: myUserIdRef.current,
            text: message,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');

        try {
            await chatChannelRef.current.send({
                type: 'broadcast',
                event: 'message',
                payload: newMessage,
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    if (loading) {
        return (
            <div className="room-page">
                <div className="room-loading">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="room-page">
            <div className="cursor-area" onMouseMove={handleMouseMove}>
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

            <div className="chat-container">
                <div className="chat-header">
                    <span><i className="fa-jelly fa-regular fa-comment-dots"></i> {roomId}</span>
                    <span className="online-count">👤 {onlineCount}人</span>
                </div>
                <div className="messages">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`message ${msg.userId === myUserIdRef.current ? 'own' : ''}`}
                        >
                            <div className="message-user">{displayName}</div>
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

            <button className="leave-button" onClick={() => navigate('/')}>
                ← ホームに戻る
            </button>
        </div>
    );
}