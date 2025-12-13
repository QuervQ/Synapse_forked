import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { searchGoogle, SearchResult } from '../lib/search';
import { supabase } from '../lib/supabase';
import '../styles/SearchPage.css';

interface GoogleAppsIconProps {
    className?: string;
    size?: number;
    color?: string;
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
            <path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z" />
        </svg>
    );
};

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState<string>('0');
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

    useEffect(() => {
        const query = searchParams.get('q');
        if (query) {
            setSearchQuery(query);
            performSearch(query);
        }
    }, [searchParams]);

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

    const performSearch = async (query: string) => {
        if (!query.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const data = await searchGoogle({
                query,
                num: 10,
                start: 1
            });

            setResults(data.items || []);
            setTotalResults(data.searchInformation.totalResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : '検索に失敗しました');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleJoinRoom();
        }
    };

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
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
        const user = await getOrCreateUser(displayName, email);

        await supabase.from('participants').insert([
            { room_id: roomId, user_id: user.id, role: 'member' }
        ]);

        window.location.href = `/room/${roomId}`;
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

    const handleBackToHome = () => {
        navigate('/');
    };

    const handleGoogleSignIn = async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google' });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setDisplayName('');
        setEmail('');
    };

    const apps = [
        { name: 'Chat', icon: '/images/icon.png' },
    ];

    return (
        <div className="search-page-container">
            {/* ヘッダー */}
            <header className="search-page-header">
                <div className="header-content">
                    <h1 className="logo" onClick={handleBackToHome} style={{ cursor: 'pointer' }}>
                        Synapse
                    </h1>

                    <form onSubmit={handleSearch} className="search-form-header">
                        <div className="search-box-header">
                            <span className="search-icon">
                                <FontAwesomeIcon icon={faMagnifyingGlass} />
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search"
                                className="search-input-header"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="search-clear"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Apps Icon */}
                    <button className="apps-button" onClick={() => { setShowProfileMenu(false); setShowApps(!showApps); }}>
                        <GoogleAppsIcon />
                        {/* Apps Dropdown */}
                        {showApps && (
                            <div className="apps-dropdown" style={{ width: `${Math.min(apps.length, 3) * 80}px` }}>
                                <div className="apps-grid" style={{ gridTemplateColumns: `repeat(${Math.min(apps.length, 3)}, 1fr)` }}>
                                    {apps.map((app, index) => (
                                        <div key={index} className="app-item" onClick={() => setShowRoomModal(true)}>
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
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="search-page-main">
                {loading && (
                    <div className="loading">検索中...</div>
                )}

                {error && (
                    <div className="error-message">
                        エラー: {error}
                    </div>
                )}

                {!loading && !error && totalResults !== '0' && (
                    <div className="results-info">
                        約 {parseInt(totalResults).toLocaleString()} 件の結果
                    </div>
                )}

                {!loading && !error && results.length === 0 && searchParams.get('q') && (
                    <div className="no-results">
                        <p>「{searchParams.get('q')}」に一致する情報は見つかりませんでした。</p>
                    </div>
                )}

                <div className="search-results">
                    {results.map((result, index) => (
                        <div key={index} className="search-result-item">
                            <div className="result-url">{result.displayLink}</div>
                            <h3 className="result-title">
                                <a
                                    href={result.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {result.title}
                                </a>
                            </h3>
                            <p className="result-snippet">{result.snippet}</p>
                        </div>
                    ))}
                </div>
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

                        <div style={{ marginTop: '20px' }}>
                            {settingsAvatarUrl && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                    <img
                                        src={settingsAvatarUrl}
                                        alt="Preview"
                                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
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