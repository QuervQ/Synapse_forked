import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../lib/supabase';
import ChatInterface from '../components/ChatInterface';
import '../styles/HomePage.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

interface GoogleAppsIconProps {
    className?: string;
    size?: number;
    color?: string;
}

interface Room {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    participant_count?: number;
}

const GoogleAppsIcon: React.FC<GoogleAppsIconProps> = ({
    className = '',
    size = 24,
    color = 'currentColor'
}) => {
    return (
        <svg
            className={className}
            focusable="false"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={color}
        >
            <path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,6zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z" />
        </svg>
    );
};

export default function GoogleStyleHome() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeRoomId = searchParams.get('v');
    const [searchQuery, setSearchQuery] = useState('');
    const [showApps, setShowApps] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [session, setSession] = useState<any>(null);
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [roomInput, setRoomInput] = useState('');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsName, setSettingsName] = useState('');
    const [settingsAvatarUrl, setSettingsAvatarUrl] = useState('');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(false);

    const toggleTheme = () => {
        console.log('Toggling theme');
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setSession(data.session);
                loadUserProfile(data.session.user);
            }
        });

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) loadUserProfile(session.user);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleJoinRoom();
        }
    };

    const handleOpenSettings = () => {
        setSettingsName(displayName);
        setSettingsAvatarUrl(avatarUrl || '');
        setShowSettingsModal(true);
        setShowProfileMenu(false);
    };

    const handleSaveSettings = async () => {
        if (!session?.user) return;

        try {
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: settingsName, picture: settingsAvatarUrl }
            });
            if (authError) throw authError;

            const { error: dbError } = await supabase
                .from('users')
                .update({ display_name: settingsName, avatar_url: settingsAvatarUrl })
                .eq('email', email);

            if (dbError) console.warn('DB Update failed (might be missing column):', dbError);

            setDisplayName(settingsName);
            setAvatarUrl(settingsAvatarUrl);
            setShowSettingsModal(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('プロフィールの更新に失敗しました');
        }
    };

    const loadRooms = async () => {
        setLoadingRooms(true);
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            // 各ルームの参加者数を取得
            const roomsWithCount = await Promise.all(
                (data || []).map(async (room) => {
                    const { count } = await supabase
                        .from('participants')
                        .select('*', { count: 'exact', head: true })
                        .eq('room_id', room.id);

                    return {
                        ...room,
                        participant_count: count || 0
                    };
                })
            );

            setRooms(roomsWithCount);
        } catch (error) {
            console.error('Failed to load rooms:', error);
        } finally {
            setLoadingRooms(false);
        }
    };

    const handleOpenRoomModal = () => {
        setShowRoomModal(true);
        loadRooms();
    };

    const handleJoinRoom = async () => {
        if (!session) {
            alert('ログインが必要です');
            return;
        }
        if (!roomInput.trim()) {
            alert('ルーム名を入力してください');
            return;
        }

        const roomId = roomInput.trim();
        // navigate(`/room/${roomId}`);
        setSearchParams({ v: roomId });
        setShowRoomModal(false);
    };

    const handleJoinExistingRoom = (roomId: string) => {
        // navigate(`/room/${roomId}`);
        setSearchParams({ v: roomId });
        setShowRoomModal(false);
    };

    const loadUserProfile = async (user: any) => {
        const userName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'No Name';

        setDisplayName(userName);
        setEmail(user.email ?? '');
        setAvatarUrl(user.user_metadata?.picture ?? null);
    };

    const handleGoogleSignIn = async () => {
        const redirectTo = window.location.origin; // 現在のオリジン（localhost）を取得
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo
            }
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setDisplayName('');
        setEmail('');
    };

    const getOrCreateUser = async (name: string, email: string) => {
        const { data: users, error: fetchError } = await supabase
            .from('users')
            .select()
            .eq('email', email)
            .maybeSingle();
        if (users && !fetchError) return users;
        const { data } = await supabase
            .from('users')
            .insert([{ display_name: name, email }])
            .select()
            .single();
        return data;
    };

    const handleSearch = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    const apps = [
        { name: 'Chat', icon: '/images/icon.png' },
    ];

    const [language, setLanguage] = useState<'ja' | 'en' | 'ru' | 'es' | 'pt'>('ja');
    const [showLanguageMenu, setShowLanguageMenu] = useState(false);

    const LANGUAGES = [
        { code: 'ja', label: '日本語', short: 'JP' },
        { code: 'en', label: 'English', short: 'EN' },
        { code: 'ru', label: 'Русский', short: 'RU' },
        { code: 'es', label: 'Español', short: 'ES' },
        { code: 'pt', label: 'Português', short: 'PT' },
    ] as const;

    const handleLanguageSelect = (code: typeof LANGUAGES[number]['code']) => {
        setLanguage(code);
        setShowLanguageMenu(false);
    };

    return (
        <div className={`google-home-container ${theme === 'dark' ? 'dark-mode' : ''} ${activeRoomId ? 'with-sidebar' : ''}`}>

            {/* Sidebar Chat Interface */}
            {activeRoomId && (
                <div className="sidebar-chat">
                    <ChatInterface
                        roomId={activeRoomId}
                        onClose={() => {
                            setSearchParams({});
                            // Optional: navigate('/') if you want to clear params completely from history cleanly, 
                            // but setSearchParams({}) is enough to remove 'v' param.
                        }}
                    />
                </div>
            )}

            {/* Header */}
            <header className="google-home-header">
                <button
                    type="button"
                    className="btn-theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
                >
                    <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-regular fa-moon'}`}></i>
                </button>

                <div className="language-menu-container">
                    <button
                        className="btn-language"
                        onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                        onBlur={() => setTimeout(() => setShowLanguageMenu(false), 200)}
                    >
                        {LANGUAGES.find(l => l.code === language)?.short || 'JP'}
                    </button>
                    {showLanguageMenu && (
                        <div
                            className="language-dropdown"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    className={`language-item ${language === lang.code ? 'active' : ''}`}
                                    onClick={() => handleLanguageSelect(lang.code)}
                                >
                                    <span className="lang-label">{lang.label}</span>
                                    {language === lang.code && <i className="fa-solid fa-check"></i>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Apps Icon */}
                <button className="apps-button" onClick={() => { setShowProfileMenu(false); setShowApps(!showApps); }}>
                    <GoogleAppsIcon />
                    {/* Apps Dropdown */}
                    {showApps && (
                        <div className="apps-dropdown" style={{ width: `${Math.min(apps.length, 3) * 80}px` }}>
                            <div className="apps-grid" style={{ gridTemplateColumns: `repeat(${Math.min(apps.length, 3)}, 1fr)` }}>
                                {apps.map((app, index) => (
                                    <div key={index} className="app-item" onClick={handleOpenRoomModal}>
                                        <div className="app-icon-wrapper">
                                            <img src={app.icon} alt={app.name} className="app-icon" />
                                        </div>
                                        <span className="app-name">{app.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </button>

                {/* Profile */}
                {displayName ? (
                    <button
                        className="profile-button"
                        onClick={() => {
                            setShowApps(false);
                            setShowProfileMenu(!showProfileMenu);
                        }}
                        onBlur={() => setTimeout(() => setShowProfileMenu(false), 200)}
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="avatar" className="profile-avatar" />
                        ) : (
                            <span className="profile-initial">
                                {displayName[0]?.toUpperCase()}
                            </span>
                        )}

                        {/* プロフィールメニュー */}
                        {showProfileMenu && (
                            <div
                                className="auth-dropdown"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="profile-header">
                                    <div className="profile-avatar-large">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="avatar" className="profile-avatar" />
                                        ) : (
                                            <span className="profile-initial">
                                                {displayName[0]?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="profile-name">{displayName}</div>
                                    <div className="profile-email">{session?.user?.email}</div>
                                </div>
                                <div className="profile-actions">
                                    <button
                                        onClick={handleOpenSettings}
                                        className="btn-settings">
                                        <i className="fa-solid fa-gear"></i> 設定
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="btn-logout">
                                        <i className="fa-solid fa-right-from-bracket"></i> ログアウト
                                    </button>

                                </div>
                            </div>
                        )}
                    </button>
                ) : (
                    <button className="login-button" onClick={handleGoogleSignIn}>
                        ログイン
                    </button>
                )}
            </header>

            {/* Main */}
            <main className="google-home-main">
                <h1 className="google-home-logo">Synapse</h1>

                {/* Search Box */}
                <form onSubmit={handleSearch} className="search-form">
                    <div className="search-box">
                        <span className="search-icon">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                        </span>

                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search"
                            className="search-input"
                        />

                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery('')} className="search-clear">
                                ×
                            </button>
                        )}
                    </div>
                </form>
            </main>

            {/* ルームモーダル */}
            {showRoomModal && (
                <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowRoomModal(false)}>
                            ×
                        </button>

                        <h2 className="modal-title">ルームに参加</h2>
                        <p className="modal-subtitle">
                            既存のルームに参加するか、新しいルームを作成しましょう
                        </p>

                        <div className="modal-input-group">
                            <label htmlFor="room-name">ルーム名</label>
                            <input
                                id="room-name"
                                type="text"
                                placeholder="例: my-room"
                                value={roomInput}
                                onChange={(e) => setRoomInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                autoFocus
                            />
                        </div>

                        <button className="btn-modal-primary" onClick={handleJoinRoom}>
                            このルームに参加
                        </button>

                        <div className="modal-divider">
                            <span>ルーム一覧</span>
                        </div>

                        <div className="active-rooms">
                            {loadingRooms ? (
                                <p style={{ color: '#999', textAlign: 'center' }}>読み込み中...</p>
                            ) : rooms.length === 0 ? (
                                <p style={{ color: '#999', textAlign: 'center' }}>
                                    まだルームがありません。<br />上記から新しいルームを作成してください。
                                </p>
                            ) : (
                                <div className="room-list">
                                    {rooms.map((room) => (
                                        <button
                                            key={room.id}
                                            className="room-item"
                                            onClick={() => handleJoinExistingRoom(room.id)}
                                        >
                                            <span className="room-name">{room.id}</span>
                                            <span className="room-count">
                                                👤 {room.participant_count || 0}人
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowSettingsModal(false)}>
                            ×
                        </button>

                        <h2 className="modal-title">プロフィール設定</h2>

                        <div className="modal-input-group">
                            <label>表示名</label>
                            <input
                                type="text"
                                value={settingsName}
                                onChange={(e) => setSettingsName(e.target.value)}
                                placeholder="表示名を入力"
                            />
                        </div>

                        <div className="settings-preview-container">
                            {settingsAvatarUrl && (
                                <div className="settings-preview-wrapper">
                                    <img
                                        src={settingsAvatarUrl}
                                        alt="Preview"
                                        className="settings-preview-image"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                            )}
                        </div>

                        <button className="btn-modal-primary" onClick={handleSaveSettings}>
                            保存
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}