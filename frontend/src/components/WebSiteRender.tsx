// frontend/src/components/WebSiteRender.tsx
import { useState, useEffect, useRef } from 'react';

interface WebSiteRenderProps {
    url: string;
    width?: number | string;
    onUrlChange?: (url: string) => void;
    onWebviewReady?: (ref: any) => void;
    height?: number | string;
    isActive?: boolean;
    className?: string;
    enableHighlighter?: boolean; // 新機能の有効化フラグ
}

export function WebSiteRender({ 
    url, 
    width = 800, 
    height = 600, 
    isActive = true, 
    className, 
    onUrlChange, 
    onWebviewReady,
    enableHighlighter = true 
}: WebSiteRenderProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentUrl, setCurrentUrl] = useState(url);
    const [highlighterMode, setHighlighterMode] = useState<'element' | 'detail' | 'off'>('off');
    const webviewRef = useRef<any>(null);

    // ハイライター機能のJavaScriptコード
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
            // マウスムーブ（要素選択モード）
            document.addEventListener('mousemove', (e) => {
                if (this.mode === 'element') {
                    this.highlightElement(e);
                }
            });

            // クリック（要素選択モード）
            document.addEventListener('click', (e) => {
                if (this.mode === 'element') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectElement(e.target);
                }
            }, true);

            // マウスダウン（詳細選択モード）
            document.addEventListener('mousedown', (e) => {
                if (this.mode === 'detail') {
                    this.isMouseDown = true;
                    this.clearDetailHighlights();
                }
            });

            // マウスアップ（詳細選択モード）
            document.addEventListener('mouseup', (e) => {
                if (this.mode === 'detail' && this.isMouseDown) {
                    this.isMouseDown = false;
                    setTimeout(() => this.highlightSelection(), 10);
                }
            });

            // スクロール時の追従
            document.addEventListener('scroll', () => {
                if (this.mode === 'element' && this.currentElement) {
                    this.updateOverlayPosition(this.currentElement);
                }
            }, true);

            // ウィンドウリサイズ時の再計算
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
            
            // ツールチップの位置調整（画面外に出ないように）
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
            
            // 一時的に緑色で強調
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
            const selectedElements = this.getSelectedElements(range);
            
            selectedElements.forEach(el => {
                if (el && el.nodeType === 1 && !el.classList.contains('detail-highlight')) {
                    el.classList.add('detail-highlight');
                    this.detailHighlights.push(el);
                }
            });

            console.log('✨ Selected text:', selection.toString().substring(0, 100));
            console.log('🎯 Highlighted elements:', selectedElements.length);
        }

        getSelectedElements(range) {
            const elements = new Set();
            const container = range.commonAncestorContainer;
            
            if (container.nodeType === 3) {
                // テキストノード
                if (container.parentElement) {
                    elements.add(container.parentElement);
                }
            } else if (container.nodeType === 1) {
                // 要素ノード
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
                if (el && el.classList) {
                    el.classList.remove('detail-highlight');
                }
            });
            this.detailHighlights = [];
        }

        setMode(newMode) {
            this.mode = newMode;
            this.clearDetailHighlights();
            
            // カーソルスタイルの変更
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

    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;

        const handleDomReady = () => {
            if (onWebviewReady) onWebviewReady(webview);
            
            // ハイライター機能を注入
            if (enableHighlighter) {
                webview.executeJavaScript(getHighlighterScript())
                    .then(() => {
                        console.log('✅ Highlighter script injected successfully');
                    })
                    .catch((err: any) => {
                        console.error('❌ Failed to inject highlighter script:', err);
                    });
            }
        };

        webview.addEventListener('dom-ready', handleDomReady);

        const handleStartLoading = () => setIsLoading(true);
        const handleStopLoading = () => setIsLoading(false);
        const handleFailLoad = (e: any) => {
            setIsLoading(false);
            setError(`Failed to load: ${e.errorDescription} (${e.errorCode})`);
        };

        webview.addEventListener('did-start-loading', handleStartLoading);
        webview.addEventListener('did-stop-loading', handleStopLoading);
        webview.addEventListener('did-fail-load', handleFailLoad);

        const handleNavigate = (e: any) => {
            setCurrentUrl(e.url);
            if (onUrlChange) onUrlChange(e.url);
        };
        const handleNewWindow = (e: any) => {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            webview.src = e.url;
            setCurrentUrl(e.url);
            if (onUrlChange) onUrlChange(e.url);
        };
        const handleWillNavigate = (e: any) => {
            setCurrentUrl(e.url);
            if (onUrlChange) onUrlChange(e.url);
        };

        webview.addEventListener('did-navigate', handleNavigate);
        webview.addEventListener('did-navigate-in-page', handleNavigate);
        webview.addEventListener('new-window', handleNewWindow);
        webview.addEventListener('will-navigate', handleWillNavigate);

        return () => {
            webview.removeEventListener('dom-ready', handleDomReady);
            webview.removeEventListener('did-start-loading', handleStartLoading);
            webview.removeEventListener('did-stop-loading', handleStopLoading);
            webview.removeEventListener('did-fail-load', handleFailLoad);
            webview.removeEventListener('did-navigate', handleNavigate);
            webview.removeEventListener('did-navigate-in-page', handleNavigate);
            webview.removeEventListener('new-window', handleNewWindow);
            webview.removeEventListener('will-navigate', handleWillNavigate);
        };
    }, [enableHighlighter]);

    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;

        setIsLoading(true);
        setError(null);

        let newUrl = url;
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            newUrl = 'https://' + url;
        }
        webview.src = newUrl;
        setCurrentUrl(newUrl);
    }, [url]);

    // ハイライターモードを変更する関数
    const changeHighlighterMode = (mode: 'element' | 'detail' | 'off') => {
        const webview = webviewRef.current;
        if (!webview || !enableHighlighter) return;

        setHighlighterMode(mode);
        
        webview.executeJavaScript(`
            if (window.__elementHighlighter) {
                window.__elementHighlighter.setMode('${mode}');
            }
        `).catch((err: any) => {
            console.error('Failed to change highlighter mode:', err);
        });
    };

    // キーボードショートカット
    useEffect(() => {
        if (!enableHighlighter || !isActive) return;

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
    }, [enableHighlighter, isActive, highlighterMode]);

    if (!isActive) return null;

    let finalUrl = url;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        finalUrl = 'https://' + url;
    }

    return (
        <div
            className={className}
            style={{
                position: 'relative',
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                backgroundColor: '#f0f0f0',
                overflow: 'hidden'
            }}
        >
            {/* URL表示バー */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: enableHighlighter ? 150 : 0,
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: '12px',
                zIndex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {currentUrl}
            </div>

            {/* ハイライターコントロールボタン */}
            {enableHighlighter && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    zIndex: 1,
                    display: 'flex',
                    gap: '4px',
                    padding: '4px',
                    background: 'rgba(0,0,0,0.6)',
                }}>
                    <button
                        onClick={() => changeHighlighterMode(highlighterMode === 'element' ? 'off' : 'element')}
                        style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            background: highlighterMode === 'element' ? '#4285f4' : '#444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontWeight: highlighterMode === 'element' ? 'bold' : 'normal'
                        }}
                        title="要素選択モード (Ctrl+Shift+C)"
                    >
                        🔍 要素
                    </button>
                    <button
                        onClick={() => changeHighlighterMode(highlighterMode === 'detail' ? 'off' : 'detail')}
                        style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            background: highlighterMode === 'detail' ? '#fbbc04' : '#444',
                            color: highlighterMode === 'detail' ? 'black' : 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontWeight: highlighterMode === 'detail' ? 'bold' : 'normal'
                        }}
                        title="詳細選択モード (Ctrl+Shift+D)"
                    >
                        ✏️ 詳細
                    </button>
                    {highlighterMode !== 'off' && (
                        <button
                            onClick={() => changeHighlighterMode('off')}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#ea4335',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                            title="無効化 (Esc)"
                        >
                            ❌
                        </button>
                    )}
                </div>
            )}

            <webview
                ref={webviewRef}
                src={finalUrl}
                style={{ width: '100%', height: '100%', display: 'inline-flex' }}
                allowpopups="true"
            />

            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#666',
                    fontSize: '14px',
                    pointerEvents: 'none'
                }}>
                    Loading...
                </div>
            )}
            {error && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#d00',
                    fontSize: '14px',
                    textAlign: 'center',
                    padding: '20px',
                    pointerEvents: 'none'
                }}>
                    {error}
                </div>
            )}
        </div>
    );
}