// frontend/src/pages/BrowserPage.tsx

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHighlighter } from '../hooks/useHighlighter';
import { HighlighterControls } from '../components/HighlighterControls';
import { WebViewDebugger } from '../utils/webview-debug';

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

    // デバッグモード（開発時のみ有効化）
    const [debugMode, setDebugMode] = useState(true); // 常に有効にして問題を診断
    
    // デバッガーインスタンスを保持
    const debuggers = useRef<{ [key: number]: WebViewDebugger }>({});

    // webviewの参照を保持
    const webviewRefs = useRef<{ [key: number]: any }>({});
    
    // イベントリスナーが既にアタッチされているかを追跡
    const listenersAttached = useRef<Set<number>>(new Set());

    // ハイライター機能のフック
    const { 
        highlighterMode, 
        changeHighlighterMode, 
        injectHighlighterScript,
        highlighterInjected 
    } = useHighlighter({ 
        activeTabId,
        enabled: true,
        webviewRefs: webviewRefs  // 🔧 webviewRefs を渡す
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
        
        // タブを閉じるときにクリーンアップ
        highlighterInjected.current.delete(tabId);
        listenersAttached.current.delete(tabId);
        delete webviewRefs.current[tabId];
        delete debuggers.current[tabId];
        
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

    // デバッグ用の診断を実行
    const runDiagnostics = (tabId: number) => {
        const webviewEl = webviewRefs.current[tabId];
        if (!webviewEl) {
            console.error('❌ WebView not found for tab', tabId);
            return;
        }

        if (!debuggers.current[tabId]) {
            debuggers.current[tabId] = new WebViewDebugger(webviewEl, tabId);
        }

        debuggers.current[tabId].runFullDiagnostics();
    };

    // 特定のテストを実行
    const testOverlay = (tabId: number) => {
        const webviewEl = webviewRefs.current[tabId];
        if (!webviewEl) {
            console.error('❌ WebView not found for tab', tabId);
            return;
        }

        if (!debuggers.current[tabId]) {
            debuggers.current[tabId] = new WebViewDebugger(webviewEl, tabId);
        }

        debuggers.current[tabId].testOverlay();
    };

    const checkState = (tabId: number) => {
        const webviewEl = webviewRefs.current[tabId];
        if (!webviewEl) {
            console.error('❌ WebView not found for tab', tabId);
            return;
        }

        if (!debuggers.current[tabId]) {
            debuggers.current[tabId] = new WebViewDebugger(webviewEl, tabId);
        }

        debuggers.current[tabId].checkHighlighterState();
    };

    const testEvents = (tabId: number) => {
        const webviewEl = webviewRefs.current[tabId];
        if (!webviewEl) {
            console.error('❌ WebView not found for tab', tabId);
            return;
        }

        if (!debuggers.current[tabId]) {
            debuggers.current[tabId] = new WebViewDebugger(webviewEl, tabId);
        }

        debuggers.current[tabId].testEventListeners();
    };

    // 強制的に再注入
    const forceReinject = (tabId: number) => {
        console.log(`🔄 [forceReinject] Forcing re-injection for tab ${tabId}`);
        
        // 状態をクリア
        highlighterInjected.current.delete(tabId);
        
        const webviewEl = webviewRefs.current[tabId];
        if (!webviewEl) {
            console.error('❌ WebView not found for tab', tabId);
            return;
        }
        
        // 再注入を実行
        console.log('🔄 Cleared injection state, attempting re-injection...');
        injectHighlighterScript(webviewEl, tabId);
        
        // 1秒後に状態をチェック
        setTimeout(() => {
            if (!debuggers.current[tabId]) {
                debuggers.current[tabId] = new WebViewDebugger(webviewEl, tabId);
            }
            debuggers.current[tabId].checkHighlighterState();
        }, 1000);
    };

    // アクティブタブが変わったらwebview参照を更新
    useEffect(() => {
        const activeWebview = webviewRefs.current[activeTabId];
        if (activeWebview) {
            setWebview(activeWebview);
            updateNavigationState(activeWebview);
        }
    }, [activeTabId]);

    // dom-readyイベントハンドラ
    const handleDomReady = (webviewEl: any, tabId: number) => {
        console.log(`📄 DOM ready for tab ${tabId}`);
        
        // 🔧 dom-ready が発火したということは新しいページが読み込まれた
        // 既存の注入状態をクリアする（ページが変わったため）
        const wasInjected = highlighterInjected.current.has(tabId);
        if (wasInjected) {
            console.log(`🔄 [handleDomReady] Clearing injection state for tab ${tabId} (page changed)`);
            highlighterInjected.current.delete(tabId);
        }
        
        if (tabId === activeTabId) {
            setWebview(webviewEl);
            updateNavigationState(webviewEl);
        }
        
        // 🔧 重要：少し待ってから注入（DOMが完全に安定するまで）
        // dom-ready は document.readyState === 'interactive' で発火するが、
        // これだと body がまだ準備中の場合がある
        console.log(`⏳ [handleDomReady] Waiting for DOM to stabilize...`);
        setTimeout(() => {
            console.log(`💉 Attempting to inject highlighter for tab ${tabId}`);
            injectHighlighterScript(webviewEl, tabId);
            
            // デバッグモードの場合、さらに待ってから状態をチェック
            if (debugMode) {
                setTimeout(() => {
                    if (!debuggers.current[tabId]) {
                        debuggers.current[tabId] = new WebViewDebugger(webviewEl, tabId);
                    }
                    console.log(`🔍 Auto-checking state for tab ${tabId} after injection`);
                    debuggers.current[tabId].checkHighlighterState();
                }, 500);
            }
        }, 300); // 300ms 待つ（dom-ready から完全な準備まで）
    };

    // 各webviewにイベントリスナーを設定（一度だけ）
    useEffect(() => {
        tabs.forEach(tab => {
            const webviewEl = webviewRefs.current[tab.id];
            
            // webviewが存在しない、または既にリスナーがアタッチされている場合はスキップ
            if (!webviewEl || listenersAttached.current.has(tab.id)) {
                return;
            }

            console.log(`🔌 Attaching event listeners for tab ${tab.id}`);

            const handleDidNavigate = (e: any) => {
                if (e.isMainFrame) {
                    console.log(`🧭 Navigation detected for tab ${tab.id}: ${e.url}`);
                    setTabs(prevTabs => prevTabs.map(t =>
                        t.id === tab.id ? { ...t, url: e.url } : t
                    ));
                    if (tab.id === activeTabId) {
                        updateNavigationState(webviewEl);
                    }
                    
                    // ページ遷移時はハイライター再注入が必要
                    console.log(`🔄 Marking tab ${tab.id} for re-injection after navigation`);
                    highlighterInjected.current.delete(tab.id);
                }
            };

            const handlePageTitleUpdated = (e: any) => {
                setTabs(prevTabs => prevTabs.map(t =>
                    t.id === tab.id ? { ...t, title: e.title } : t
                ));
            };

            // 🔧 ページの読み込みが完全に完了したとき
            const handleDidFinishLoad = () => {
                console.log(`✅ [Tab ${tab.id}] Page finished loading completely`);
                
                // ページが完全に読み込まれた後、ハイライターが存在するか確認
                // 存在しない場合は注入（dom-ready で失敗した場合の保険）
                const webviewEl = webviewRefs.current[tab.id];
                if (webviewEl) {
                    setTimeout(() => {
                        webviewEl.executeJavaScript('typeof window.__elementHighlighter')
                            .then((type: string) => {
                                if (type === 'undefined') {
                                    console.warn(`⚠️ [Tab ${tab.id}] Highlighter not found after page load, injecting now...`);
                                    highlighterInjected.current.delete(tab.id);
                                    injectHighlighterScript(webviewEl, tab.id);
                                } else {
                                    console.log(`✅ [Tab ${tab.id}] Highlighter already present after page load`);
                                }
                            })
                            .catch((err: any) => {
                                console.error(`❌ [Tab ${tab.id}] Failed to check highlighter:`, err);
                            });
                    }, 200); // 完全な読み込み後さらに少し待つ
                }
            };

            const domReadyHandler = () => handleDomReady(webviewEl, tab.id);

            // 🔧 WebView のコンソールメッセージを親コンソールに転送（デバッグ用）
            const consoleMessageHandler = (e: any) => {
                const prefix = `[WebView Tab ${tab.id}]`;
                const message = e.message;
                const level = e.level; // 0=verbose, 1=info, 2=warning, 3=error
                
                // ハイライター関連のログのみ表示（スパム防止）
                if (message.includes('HIGHLIGHTER') || message.includes('🎨') || 
                    message.includes('overlay') || message.includes('Overlay') ||
                    message.includes('elementHighlighter')) {
                    if (level === 3) {
                        console.error(prefix, message);
                    } else if (level === 2) {
                        console.warn(prefix, message);
                    } else {
                        console.log(prefix, message);
                    }
                }
            };

            webviewEl.addEventListener('did-navigate', handleDidNavigate);
            webviewEl.addEventListener('did-navigate-in-page', handleDidNavigate);
            webviewEl.addEventListener('page-title-updated', handlePageTitleUpdated);
            webviewEl.addEventListener('dom-ready', domReadyHandler);
            webviewEl.addEventListener('did-finish-load', handleDidFinishLoad); // 追加
            webviewEl.addEventListener('console-message', consoleMessageHandler);

            // リスナーがアタッチされたことをマーク
            listenersAttached.current.add(tab.id);
            
            console.log(`✅ Event listeners attached for tab ${tab.id}`);
        });

        // クリーンアップ関数
        return () => {
            // このエフェクトが再実行される場合、古いリスナーを削除
            // ただし、listenersAttachedは保持（一度だけアタッチするため）
        };
    }, [tabs]); // highlighterModeとactiveTabIdを依存配列から削除

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

                    {/* デバッグコントロール */}
                    {debugMode && (
                        <div style={{ 
                            marginLeft: 'auto', 
                            display: 'flex', 
                            gap: '4px',
                            borderLeft: '1px solid #999',
                            paddingLeft: '10px'
                        }}>
                            <button
                                onClick={() => forceReinject(activeTabId)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    background: '#4caf50',
                                    color: 'white',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                title="強制的にスクリプトを再注入"
                            >
                                🔄 再注入
                            </button>
                            <button
                                onClick={() => runDiagnostics(activeTabId)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    background: '#f44336',
                                    color: 'white',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                title="完全な診断を実行（コンソールをチェック）"
                            >
                                🔧 診断
                            </button>
                            <button
                                onClick={() => testOverlay(activeTabId)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    background: '#ff9800',
                                    color: 'white',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                title="オーバーレイ表示テスト（赤い箱が3秒間表示される）"
                            >
                                🧪 Test
                            </button>
                            <button
                                onClick={() => checkState(activeTabId)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    background: '#2196f3',
                                    color: 'white',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                title="ハイライターの現在の状態をチェック"
                            >
                                🔍 状態
                            </button>
                            <button
                                onClick={() => testEvents(activeTabId)}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    background: '#9c27b0',
                                    color: 'white',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                title="イベントリスナーをテスト（10秒間）"
                            >
                                🎯 Events
                            </button>
                        </div>
                    )}
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
                                    console.log(`🔄 URL changed manually, marking tab ${activeTabId} for re-injection`);
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
                            if (el) {
                                webviewRefs.current[tab.id] = el;
                                console.log(`🔗 [WebView Ref] Set ref for tab ${tab.id}`, {
                                    element: el,
                                    tagName: el.tagName,
                                    src: el.src,
                                    hasExecuteJavaScript: typeof el.executeJavaScript === 'function'
                                });
                            }
                        }}
                        src={tab.url.startsWith('http') ? tab.url : `https://${tab.url}`}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: tab.id === activeTabId ? 'inline-flex' : 'none'
                        }}
                        // WebView の属性を明示的に設定
                        partition="persist:webview"
                        allowpopups="true"
                        webpreferences="allowRunningInsecureContent, javascript=yes"
                    />
                ))}
            </div>
        </div>
    );
}

export default BrowserPage;