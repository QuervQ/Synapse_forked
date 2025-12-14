// frontend/src/utils/highlighter-script.ts

/**
 * Webview内で実行されるハイライタースクリプトを返す
 * このスクリプトはwebview内にJavaScriptとして注入される
 */
export function getHighlighterScript(): string {
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
                
                /* モード中はリンクとボタンの見た目を変更 */
                .element-mode-cursor a,
                .detail-mode-cursor a,
                .element-mode-cursor button,
                .detail-mode-cursor button {
                    pointer-events: none !important;
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

            // クリック防止（要素選択・詳細選択モード）
            document.addEventListener('click', (e) => {
                if (this.mode === 'element' || this.mode === 'detail') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    if (this.mode === 'element') {
                        this.selectElement(e.target);
                    }
                }
            }, true);

            // リンクとボタンの動作を完全に無効化
            document.addEventListener('mousedown', (e) => {
                if (this.mode === 'element' || this.mode === 'detail') {
                    // リンクやボタンの場合は動作を防止
                    const target = e.target;
                    if (target.tagName === 'A' || target.tagName === 'BUTTON' || 
                        target.closest('a') || target.closest('button')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                }
                
                if (this.mode === 'detail') {
                    this.isMouseDown = true;
                    // 詳細選択モードでは既存のハイライトをクリアしない
                }
            });

            // マウスアップ（詳細選択モード）
            document.addEventListener('mouseup', (e) => {
                if (this.mode === 'detail' && this.isMouseDown) {
                    this.isMouseDown = false;
                    setTimeout(() => this.highlightSelection(), 10);
                }
            });

            // キーボードイベント（Enter / Esc）
            document.addEventListener('keydown', (e) => {
                if (this.mode === 'detail' && e.key === 'Enter') {
                    // Enter: 選択確定（現在の選択を維持）
                    e.preventDefault();
                    const selection = window.getSelection();
                    if (selection) {
                        selection.removeAllRanges();
                    }
                    console.log('✅ 選択を確定しました');
                } else if (e.key === 'Escape' && (this.mode === 'element' || this.mode === 'detail')) {
                    // Esc: ハイライトをクリアしてモードを終了
                    e.preventDefault();
                    this.clearDetailHighlights();
                    this.setMode('off');
                    console.log('❌ ハイライトをクリアしました');
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

            // フォーム送信の防止
            document.addEventListener('submit', (e) => {
                if (this.mode === 'element' || this.mode === 'detail') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, true);

            // コンテキストメニュー以外のイベントも防止
            ['auxclick', 'dblclick', 'contextmenu'].forEach(eventType => {
                document.addEventListener(eventType, (e) => {
                    if (this.mode === 'element' || this.mode === 'detail') {
                        if (eventType !== 'contextmenu') {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                }, true);
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
            const oldMode = this.mode;
            this.mode = newMode;
            
            // モード終了時のみハイライトをクリア
            if (newMode === 'off' && oldMode !== 'off') {
                // Escキー以外でモードを終了する場合はハイライトを保持
                // （Escキーの場合は明示的にclearDetailHighlights()が呼ばれる）
            }
            
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
                'element': '🔍 要素選択モード (クリック無効)',
                'detail': '✏️ 詳細選択モード (Enter: 確定 / Esc: クリア)',
                'off': '✅ 通常モード'
            };
            
            indicator.textContent = modeText[this.mode] || '';
            indicator.style.display = 'block';
            
            // 通常モード以外は表示し続ける
            if (this.mode === 'off') {
                setTimeout(() => {
                    if (indicator) indicator.style.display = 'none';
                }, 2000);
            }
        }

        disable() {
            this.setMode('off');
        }
    }

    window.__elementHighlighter = new ElementHighlighter();
    console.log('🎨 Element Highlighter initialized!');
})();
    `;
}