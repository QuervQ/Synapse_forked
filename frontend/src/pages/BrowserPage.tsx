import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Tab {
    id: number;
    url: string;
    title: string;
}

type HighlighterMode = 'element' | 'detail' | 'off';

function BrowserPage() {
    const [tabs, setTabs] = useState<Tab[]>([
        { id: 1, url: 'https://www.wikipedia.org', title: 'New Tab' }
    ]);
    const [activeTabId, setActiveTabId] = useState(1);
    const [nextId, setNextId] = useState(2);
    const [webview, setWebview] = useState<any>(null);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [highlighterMode, setHighlighterMode] = useState<HighlighterMode>('off');

    // webviewの参照を保持
    const webviewRefs = useRef<{ [key: number]: any }>({});
    // ハイライタースクリプトが注入されたwebviewを追跡
    const highlighterInjected = useRef<Set<number>>(new Set());

    // ハイライター機能のスクリプト
    const getHighlighterScript = () => {
        return `
(function() {
    if (window.__highlighterInstalled) return;
    window.__highlighterInstalled = true;

    class ElementHighlighter {
        constructor() {
            this.mode = 'off';
            this.overlay = null;
            this.tooltip = null;
            this.currentElement = null;
            this.detailHighlights = [];
            this.isMouseDown = false;
            this.init();
        }

        init() {
            this.createOverlay();
            this.createTooltip();
            this.injectStyles();
            this.attachEventListeners();
        }

        createOverlay() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'element-highlighter-overlay';
            this.overlay.style.cssText = \`
                position: fixed;
                pointer-events: none;
                z-index: 2147483647;
                display: none;
                box-shadow: 0 0 0 1px rgba(66, 133, 244, 0.8) inset,
                            0 0 0 9999px rgba(66, 133, 244, 0.15);
                outline: 1px solid rgba(66, 133, 244, 0.8);
            \`;
            document.body.appendChild(this.overlay);
        }

        createTooltip() {
            this.tooltip = document.createElement('div');
            this.tooltip.id = 'element-highlighter-tooltip';
            this.tooltip.style.cssText = \`
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 11px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                pointer-events: none;
                z-index: 2147483648;
                display: none;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            \`;
            document.body.appendChild(this.tooltip);
        }

        injectStyles() {
            if (document.getElementById('highlighter-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'highlighter-styles';
            style.textContent = \`
                .detail-highlight {
                    background-color: rgba(255, 235, 59, 0.35) !important;
                    outline: 2px solid rgba(255, 193, 7, 0.9) !important;
                    outline-offset: 1px !important;
                }
                
                mark.text-selection-highlight {
                    background-color: rgba(255, 235, 59, 0.5) !important;
                    color: inherit !important;
                    padding: 2px 0 !important;
                    border-radius: 2px !important;
                }
                
                .element-mode-cursor * {
                    cursor: crosshair !important;
                }
                
                .detail-mode-cursor * {
                    cursor: text !important;
                }
                
                #mode-indicator {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.85);
                    color: white;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-family: 'Segoe UI', sans-serif;
                    font-size: 13px;
                    font-weight: 500;
                    z-index: 2147483647;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    display: none;
                }
            \`;
            document.head.appendChild(style);
        }

        attachEventListeners() {
            document.addEventListener('mousemove', (e) => {
                if (this.mode === 'element') {
                    this.highlightElement(e);
                }
            });

            document.addEventListener('click', (e) => {
                if (this.mode === 'element') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectElement(e.target);
                }
            }, true);

            document.addEventListener('mousedown', (e) => {
                if (this.mode === 'detail') {
                    this.isMouseDown = true;
                    this.clearDetailHighlights();
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (this.mode === 'detail' && this.isMouseDown) {
                    this.isMouseDown = false;
                    setTimeout(() => this.highlightSelection(), 10);
                }
            });

            document.addEventListener('scroll', () => {
                if (this.mode === 'element' && this.currentElement) {
                    this.updateOverlayPosition(this.currentElement);
                }
            }, true);

            window.addEventListener('resize', () => {
                if (this.mode === 'element' && this.currentElement) {
                    this.updateOverlayPosition(this.currentElement);
                }
            });
        }

        highlightElement(event) {
            const element = event.target;
            if (!element || element === this.overlay || element === this.tooltip) return;

            this.currentElement = element;
            this.updateOverlayPosition(element);
            this.updateTooltip(element, event);
        }

        updateOverlayPosition(element) {
            const rect = element.getBoundingClientRect();
            this.overlay.style.display = 'block';
            this.overlay.style.left = rect.left + window.scrollX + 'px';
            this.overlay.style.top = rect.top + window.scrollY + 'px';
            this.overlay.style.width = rect.width + 'px';
            this.overlay.style.height = rect.height + 'px';
        }

        updateTooltip(element, event) {
            const tagName = element.tagName.toLowerCase();
            const id = element.id ? \`#\${element.id}\` : '';
            const classList = Array.from(element.classList).filter(c => 
                !c.includes('highlight') && !c.includes('cursor')
            );
            const classes = classList.length ? \`.\${classList.join('.')}\` : '';
            
            const rect = element.getBoundingClientRect();
            const dimensions = \` \${Math.round(rect.width)}×\${Math.round(rect.height)}\`;

            this.tooltip.textContent = tagName + id + classes + dimensions;
            this.tooltip.style.display = 'block';
            
            const tooltipRect = this.tooltip.getBoundingClientRect();
            let left = event.clientX + 15;
            let top = event.clientY + 15;
            
            if (left + tooltipRect.width > window.innerWidth) {
                left = event.clientX - tooltipRect.width - 15;
            }
            if (top + tooltipRect.height > window.innerHeight) {
                top = event.clientY - tooltipRect.height - 15;
            }
            
            this.tooltip.style.left = left + 'px';
            this.tooltip.style.top = top + 'px';
        }

        selectElement(element) {
            console.log('✅ Selected element:', element);
            console.log('📝 Tag:', element.tagName);
            console.log('🆔 ID:', element.id || 'none');
            console.log('📋 Classes:', element.className || 'none');
            console.log('📏 Size:', element.getBoundingClientRect().width, '×', element.getBoundingClientRect().height);
            console.log('📄 HTML:', element.outerHTML.substring(0, 200) + '...');
            
            const originalOutline = element.style.outline;
            const originalOutlineOffset = element.style.outlineOffset;
            element.style.outline = '3px solid #4CAF50';
            element.style.outlineOffset = '2px';
            
            setTimeout(() => {
                element.style.outline = originalOutline;
                element.style.outlineOffset = originalOutlineOffset;
            }, 1000);
        }

        highlightSelection() {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

            const range = selection.getRangeAt(0);
            const selectedText = selection.toString();
            
            // テキストのみが選択されているかチェック
            const isTextOnly = this.isTextOnlySelection(range);
            
            if (isTextOnly && selectedText.trim()) {
                // テキストのみの場合：選択範囲を<mark>要素でラップ
                this.highlightTextRange(range);
                console.log('✨ Text highlighted:', selectedText.substring(0, 100));
            } else {
                // 要素選択の場合：従来通り要素全体をハイライト
                const selectedElements = this.getSelectedElements(range);
                selectedElements.forEach(el => {
                    if (el && el.nodeType === 1 && !el.classList.contains('detail-highlight')) {
                        el.classList.add('detail-highlight');
                        this.detailHighlights.push(el);
                    }
                });
                console.log('🎯 Highlighted elements:', selectedElements.length);
            }
        }

        isTextOnlySelection(range) {
            // 選択範囲がテキストノードのみを含むかチェック
            const container = range.commonAncestorContainer;
            
            // テキストノード内の選択
            if (container.nodeType === 3) {
                return true;
            }
            
            // 要素ノード内の選択をチェック
            const fragment = range.cloneContents();
            const walker = document.createTreeWalker(
                fragment,
                NodeFilter.SHOW_ALL,
                null
            );
            
            let hasElements = false;
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeType === 1 && node.nodeName !== 'BR') {
                    hasElements = true;
                    break;
                }
            }
            
            return !hasElements;
        }

        highlightTextRange(range) {
            try {
                // 既存の選択範囲を保存
                const originalRange = range.cloneRange();
                
                // <mark>要素を作成
                const mark = document.createElement('mark');
                mark.className = 'text-selection-highlight';
                mark.style.cssText = 'background-color: rgba(255, 235, 59, 0.5) !important; color: inherit !important;';
                
                // 選択範囲を<mark>でラップ
                range.surroundContents(mark);
                
                // ハイライト要素を記録
                this.detailHighlights.push(mark);
                
                // 選択を解除
                window.getSelection().removeAllRanges();
            } catch (e) {
                // surroundContentsが失敗した場合（複数要素にまたがる場合など）
                // より複雑な方法で処理
                this.highlightComplexTextRange(range);
            }
        }

        highlightComplexTextRange(range) {
            try {
                const fragment = range.extractContents();
                const mark = document.createElement('mark');
                mark.className = 'text-selection-highlight';
                mark.style.cssText = 'background-color: rgba(255, 235, 59, 0.5) !important; color: inherit !important;';
                mark.appendChild(fragment);
                range.insertNode(mark);
                
                this.detailHighlights.push(mark);
                window.getSelection().removeAllRanges();
            } catch (e) {
                console.error('Failed to highlight text:', e);
            }
        }

        getSelectedElements(range) {
            const elements = new Set();
            const container = range.commonAncestorContainer;
            
            if (container.nodeType === 3) {
                if (container.parentElement) {
                    elements.add(container.parentElement);
                }
            } else if (container.nodeType === 1) {
                const treeWalker = document.createTreeWalker(
                    container,
                    NodeFilter.SHOW_ELEMENT,
                    {
                        acceptNode: (node) => {
                            try {
                                return range.intersectsNode(node) 
                                    ? NodeFilter.FILTER_ACCEPT 
                                    : NodeFilter.FILTER_REJECT;
                            } catch (e) {
                                return NodeFilter.FILTER_REJECT;
                            }
                        }
                    }
                );
                
                let node;
                while (node = treeWalker.nextNode()) {
                    elements.add(node);
                }
                
                if (elements.size === 0) {
                    elements.add(container);
                }
            }
            
            return Array.from(elements);
        }

        clearDetailHighlights() {
            this.detailHighlights.forEach(el => {
                if (!el) return;
                
                // <mark>要素の場合は削除してコンテンツを戻す
                if (el.tagName === 'MARK' && el.classList.contains('text-selection-highlight')) {
                    const parent = el.parentNode;
                    if (parent) {
                        // <mark>の中身を親要素に戻す
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                        // テキストノードを正規化
                        parent.normalize();
                    }
                } else if (el.classList) {
                    // 通常の要素ハイライトの場合はクラスを削除
                    el.classList.remove('detail-highlight');
                }
            });
            this.detailHighlights = [];
        }

        setMode(newMode) {
            this.mode = newMode;
            this.clearDetailHighlights();
            
            document.body.classList.remove('element-mode-cursor', 'detail-mode-cursor');
            
            if (this.mode === 'element') {
                this.overlay.style.display = 'none';
                this.tooltip.style.display = 'none';
                document.body.classList.add('element-mode-cursor');
            } else if (this.mode === 'detail') {
                this.overlay.style.display = 'none';
                this.tooltip.style.display = 'none';
                document.body.classList.add('detail-mode-cursor');
            } else {
                this.overlay.style.display = 'none';
                this.tooltip.style.display = 'none';
            }
            
            this.showModeIndicator();
        }

        showModeIndicator() {
            let indicator = document.getElementById('mode-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'mode-indicator';
                document.body.appendChild(indicator);
            }
            
            const modeText = {
                'element': '🔍 要素選択モード',
                'detail': '✏️ 詳細選択モード',
                'off': '❌ ハイライト無効'
            };
            
            indicator.textContent = modeText[this.mode] || '';
            indicator.style.display = 'block';
            
            setTimeout(() => {
                if (indicator) indicator.style.display = 'none';
            }, 2000);
        }

        disable() {
            this.setMode('off');
        }
    }

    window.__elementHighlighter = new ElementHighlighter();
    console.log('🎨 Element Highlighter initialized!');
})();
        `;
    };

    // ハイライタースクリプトを注入
    const injectHighlighterScript = (webviewEl: any, tabId: number) => {
        if (!webviewEl || highlighterInjected.current.has(tabId)) return;

        webviewEl.executeJavaScript(getHighlighterScript())
            .then(() => {
                console.log(`✅ Highlighter injected for tab ${tabId}`);
                highlighterInjected.current.add(tabId);
                
                // 現在のモードを適用
                if (highlighterMode !== 'off') {
                    changeHighlighterModeForWebview(webviewEl, highlighterMode);
                }
            })
            .catch((err: any) => {
                console.error(`❌ Failed to inject highlighter for tab ${tabId}:`, err);
            });
    };

    // 特定のwebviewのハイライターモードを変更
    const changeHighlighterModeForWebview = (webviewEl: any, mode: HighlighterMode) => {
        if (!webviewEl) return;

        webviewEl.executeJavaScript(`
            if (window.__elementHighlighter) {
                window.__elementHighlighter.setMode('${mode}');
            }
        `).catch((err: any) => {
            console.error('Failed to change highlighter mode:', err);
        });
    };

    // アクティブなwebviewのハイライターモードを変更
    const changeHighlighterMode = (mode: HighlighterMode) => {
        setHighlighterMode(mode);
        const activeWebview = webviewRefs.current[activeTabId];
        if (activeWebview) {
            changeHighlighterModeForWebview(activeWebview, mode);
        }
    };

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
            
            // アクティブなタブのハイライターモードを更新
            if (highlighterMode !== 'off' && highlighterInjected.current.has(activeTabId)) {
                changeHighlighterModeForWebview(activeWebview, highlighterMode);
            }
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

    // キーボードショートカット
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+Shift+C: 要素選択モード
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
                e.preventDefault();
                changeHighlighterMode(highlighterMode === 'element' ? 'off' : 'element');
            }
            // Ctrl+Shift+D: 詳細選択モード
            else if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                changeHighlighterMode(highlighterMode === 'detail' ? 'off' : 'detail');
            }
            // Escape: 無効化
            else if (e.code === 'Escape' && highlighterMode !== 'off') {
                e.preventDefault();
                changeHighlighterMode('off');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [highlighterMode, activeTabId]);

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
                    <div style={{ 
                        marginLeft: 'auto', 
                        display: 'flex', 
                        gap: '4px',
                        borderLeft: '1px solid #999',
                        paddingLeft: '10px'
                    }}>
                        <button
                            onClick={() => changeHighlighterMode(highlighterMode === 'element' ? 'off' : 'element')}
                            style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                background: highlighterMode === 'element' ? '#4285f4' : '#fff',
                                color: highlighterMode === 'element' ? 'white' : 'black',
                                border: '1px solid #999',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: highlighterMode === 'element' ? 'bold' : 'normal'
                            }}
                            title="要素選択モード (Ctrl+Shift+C)"
                        >
                            🔍 要素選択
                        </button>
                        <button
                            onClick={() => changeHighlighterMode(highlighterMode === 'detail' ? 'off' : 'detail')}
                            style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                background: highlighterMode === 'detail' ? '#fbbc04' : '#fff',
                                color: 'black',
                                border: '1px solid #999',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: highlighterMode === 'detail' ? 'bold' : 'normal'
                            }}
                            title="詳細選択モード (Ctrl+Shift+D)"
                        >
                            ✏️ 詳細選択
                        </button>
                        {highlighterMode !== 'off' && (
                            <button
                                onClick={() => changeHighlighterMode('off')}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    background: '#ea4335',
                                    color: 'white',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                title="ハイライト無効化 (Esc)"
                            >
                                ❌ 無効
                            </button>
                        )}
                    </div>
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