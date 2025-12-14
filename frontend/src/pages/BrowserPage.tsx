// frontend/src/pages/BrowserPage.tsx

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHighlighter } from '../hooks/useHighlighter';
import { HighlighterControls } from '../components/HighlighterControls';

interface Tab {
    id: number;
    url: string;
    title: string;
}

function BrowserPage() {
    const [tabs, setTabs] = useState<Tab[]>([
        { id: 1, url: 'https://www.wikipedia.org', title: 'New Tab' }
    ]);
    const [activeTabId, setActiveTabId] = useState(1);
    const [nextId, setNextId] = useState(2);
    const [webview, setWebview] = useState<any>(null);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);

    // webviewの参照を保持
    const webviewRefs = useRef<{ [key: number]: any }>({});

    // ハイライター機能のフック
    const { 
        highlighterMode, 
        changeHighlighterMode, 
        injectHighlighterScript,
        highlighterInjected 
    } = useHighlighter({ 
        activeTabId,
        enabled: true 
    });

    const addTab = () => {
        const newTab = {
            id: nextId,
            url: 'https://google.com',
            title: 'New Tab'
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(nextId);
        setNextId(nextId + 1);
    };

    const closeTab = (tabId: number) => {
        if (tabs.length === 1) return;
        
        // タブを閉じるときにハイライター注入履歴から削除
        highlighterInjected.current.delete(tabId);
        delete webviewRefs.current[tabId];
        
        const newTabs = tabs.filter(tab => tab.id !== tabId);
        setTabs(newTabs);
        if (activeTabId === tabId) {
            setActiveTabId(newTabs[0].id);
        }
    };

    const handleUrlChange = (tabId: number, newUrl: string) => {
        setTabs(tabs.map(tab =>
            tab.id === tabId ? { ...tab, url: newUrl } : tab
        ));
    };

    const goBack = () => {
        if (webview && webview.canGoBack && webview.canGoBack()) {
            webview.goBack();
        }
    };

    const goForward = () => {
        if (webview && webview.canGoForward && webview.canGoForward()) {
            webview.goForward();
        }
    };

    const updateNavigationState = (webviewEl: any) => {
        try {
            if (webviewEl && webviewEl.canGoBack && webviewEl.canGoForward) {
                setCanGoBack(webviewEl.canGoBack());
                setCanGoForward(webviewEl.canGoForward());
            }
        } catch (e) {
            setCanGoBack(false);
            setCanGoForward(false);
        }
    };

    // アクティブタブが変わったらwebview参照を更新
    useEffect(() => {
        const activeWebview = webviewRefs.current[activeTabId];
        if (activeWebview) {
            setWebview(activeWebview);
            updateNavigationState(activeWebview);
        }
    }, [activeTabId]);

    // 各webviewにイベントリスナーを設定
    useEffect(() => {
        tabs.forEach(tab => {
            const webviewEl = webviewRefs.current[tab.id];
            if (!webviewEl) return;

            const handleDidNavigate = (e: any) => {
                if (e.isMainFrame) {
                    setTabs(prevTabs => prevTabs.map(t =>
                        t.id === tab.id ? { ...t, url: e.url } : t
                    ));
                    if (tab.id === activeTabId) {
                        updateNavigationState(webviewEl);
                    }
                    
                    // ページ遷移時はハイライター再注入が必要
                    highlighterInjected.current.delete(tab.id);
                }
            };

            const handlePageTitleUpdated = (e: any) => {
                setTabs(prevTabs => prevTabs.map(t =>
                    t.id === tab.id ? { ...t, title: e.title } : t
                ));
            };

            const handleDomReady = () => {
                // dom-readyイベントでwebview参照を更新
                if (tab.id === activeTabId) {
                    setWebview(webviewEl);
                    updateNavigationState(webviewEl);
                }
                
                // ハイライタースクリプトを注入
                injectHighlighterScript(webviewEl, tab.id);
            };

            webviewEl.addEventListener('did-navigate', handleDidNavigate);
            webviewEl.addEventListener('did-navigate-in-page', handleDidNavigate);
            webviewEl.addEventListener('page-title-updated', handlePageTitleUpdated);
            webviewEl.addEventListener('dom-ready', handleDomReady);

            return () => {
                webviewEl.removeEventListener('did-navigate', handleDidNavigate);
                webviewEl.removeEventListener('did-navigate-in-page', handleDidNavigate);
                webviewEl.removeEventListener('page-title-updated', handlePageTitleUpdated);
                webviewEl.removeEventListener('dom-ready', handleDomReady);
            };
        });
    }, [tabs, activeTabId, highlighterMode]);

    const activeTab = tabs.find(tab => tab.id === activeTabId);

    return (
        <div className="browser-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div className="browser-header" style={{ padding: '8px', background: '#e0e0e0', borderBottom: '1px solid #ccc' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                    <Link to="/" style={{ textDecoration: 'none' }}>🏠 Home</Link>
                    <button 
                        onClick={goBack} 
                        disabled={!canGoBack}
                        style={{
                            padding: '4px 12px',
                            cursor: canGoBack ? 'pointer' : 'not-allowed',
                            opacity: canGoBack ? 1 : 0.5
                        }}
                    >
                        ← Back
                    </button>
                    <button 
                        onClick={goForward} 
                        disabled={!canGoForward}
                        style={{
                            padding: '4px 12px',
                            cursor: canGoForward ? 'pointer' : 'not-allowed',
                            opacity: canGoForward ? 1 : 0.5
                        }}
                    >
                        Forward →
                    </button>

                    {/* ハイライターコントロール */}
                    <HighlighterControls 
                        mode={highlighterMode} 
                        onModeChange={changeHighlighterMode}
                    />
                </div>

                <div className="tab-bar" style={{ display: 'flex', gap: '4px', marginBottom: '8px', overflowX: 'auto' }}>
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                            onClick={() => setActiveTabId(tab.id)}
                            style={{
                                padding: '4px 12px',
                                background: tab.id === activeTabId ? '#fff' : '#ddd',
                                border: '1px solid #999',
                                borderRadius: '4px 4px 0 0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                maxWidth: '150px'
                            }}
                        >
                            <span className="tab-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tab.title}
                            </span>
                            <button
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button onClick={addTab} style={{ padding: '4px 8px' }}>+ 新しいタブ</button>
                </div>

                <div className="address-bar" style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={activeTab?.url || ''}
                        onChange={(e) => handleUrlChange(activeTabId, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const webviewEl = webviewRefs.current[activeTabId];
                                if (webviewEl) {
                                    let newUrl = activeTab?.url || '';
                                    if (newUrl && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
                                        newUrl = 'https://' + newUrl;
                                    }
                                    webviewEl.src = newUrl;
                                    // URL変更時はハイライター再注入が必要
                                    highlighterInjected.current.delete(activeTabId);
                                }
                            }
                        }}
                        placeholder="URL を入力..."
                        style={{ flex: 1, padding: '6px 12px', fontSize: '14px', border: '1px solid #999', borderRadius: '4px' }}
                    />
                </div>
            </div>

            <div className="browser-content" style={{ flex: 1, position: 'relative' }}>
                {tabs.map(tab => (
                    <webview
                        key={tab.id}
                        ref={el => {
                            if (el) webviewRefs.current[tab.id] = el;
                        }}
                        src={tab.url.startsWith('http') ? tab.url : `https://${tab.url}`}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: tab.id === activeTabId ? 'inline-flex' : 'none'
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default BrowserPage;