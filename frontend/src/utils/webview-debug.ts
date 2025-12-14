// frontend/src/utils/webview-debug.ts

/**
 * WebView通信のデバッグヘルパー
 * WebViewとRenderer間の通信を監視・テストするユーティリティ
 */

export class WebViewDebugger {
    private webview: any;
    private tabId: number;

    constructor(webview: any, tabId: number) {
        this.webview = webview;
        this.tabId = tabId;
    }

    /**
     * WebView内のハイライターの状態をチェック
     */
    async checkHighlighterState(): Promise<void> {
        console.log(`🔍 [Tab ${this.tabId}] Checking highlighter state...`);

        try {
            // ハイライターオブジェクトの存在確認
            const exists = await this.webview.executeJavaScript(
                'typeof window.__elementHighlighter !== "undefined"'
            );
            console.log(`   - Highlighter exists: ${exists}`);

            if (!exists) {
                console.error('❌ Highlighter not found in WebView!');
                return;
            }

            // 現在のモードを取得
            const mode = await this.webview.executeJavaScript(
                'window.__elementHighlighter.mode'
            );
            console.log(`   - Current mode: ${mode}`);

            // 初期化状態を確認
            const initialized = await this.webview.executeJavaScript(
                'window.__elementHighlighter.initialized'
            );
            console.log(`   - Initialized: ${initialized}`);

            // オーバーレイの存在確認
            const overlayExists = await this.webview.executeJavaScript(
                '!!document.getElementById("element-highlighter-overlay")'
            );
            console.log(`   - Overlay element exists: ${overlayExists}`);

            // オーバーレイのスタイル確認
            const overlayStyles = await this.webview.executeJavaScript(`
                (function() {
                    const overlay = document.getElementById('element-highlighter-overlay');
                    if (!overlay) return null;
                    return {
                        display: overlay.style.display,
                        position: overlay.style.position,
                        zIndex: overlay.style.zIndex,
                        left: overlay.style.left,
                        top: overlay.style.top,
                        width: overlay.style.width,
                        height: overlay.style.height,
                        inDOM: !!overlay.parentNode
                    };
                })();
            `);
            console.log(`   - Overlay styles:`, overlayStyles);

            // ハイライト数を確認
            const highlightCount = await this.webview.executeJavaScript(
                'window.__elementHighlighter.detailHighlights.length'
            );
            console.log(`   - Active highlights: ${highlightCount}`);

            console.log('✅ State check complete');
        } catch (error) {
            console.error('❌ Failed to check state:', error);
        }
    }

    /**
     * オーバーレイの表示テスト
     */
    async testOverlay(): Promise<boolean> {
        console.log(`🧪 [Tab ${this.tabId}] Testing overlay rendering...`);

        try {
            const result = await this.webview.executeJavaScript(`
                (function() {
                    const highlighter = window.__elementHighlighter;
                    if (!highlighter || !highlighter.overlay) {
                        return { success: false, error: 'Highlighter or overlay not found' };
                    }

                    // オーバーレイを強制的に表示
                    highlighter.overlay.style.display = 'block';
                    highlighter.overlay.style.left = '100px';
                    highlighter.overlay.style.top = '100px';
                    highlighter.overlay.style.width = '300px';
                    highlighter.overlay.style.height = '200px';
                    highlighter.overlay.style.background = 'rgba(255, 0, 0, 0.3)'; // 赤色で目立たせる

                    // 3秒後に非表示
                    setTimeout(() => {
                        highlighter.overlay.style.display = 'none';
                        highlighter.overlay.style.background = ''; // リセット
                    }, 3000);

                    return { 
                        success: true, 
                        position: {
                            left: highlighter.overlay.style.left,
                            top: highlighter.overlay.style.top,
                            width: highlighter.overlay.style.width,
                            height: highlighter.overlay.style.height
                        }
                    };
                })();
            `);

            if (result.success) {
                console.log('✅ Overlay test successful! Red box should appear for 3 seconds.');
                console.log('   Position:', result.position);
                return true;
            } else {
                console.error('❌ Overlay test failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Overlay test error:', error);
            return false;
        }
    }

    /**
     * イベントリスナーのテスト
     */
    async testEventListeners(): Promise<void> {
        console.log(`🎯 [Tab ${this.tabId}] Testing event listeners...`);

        try {
            await this.webview.executeJavaScript(`
                (function() {
                    let mousemoveCount = 0;
                    let clickCount = 0;
                    let mousedownCount = 0;

                    // テスト用リスナーを追加
                    const mousemoveHandler = () => {
                        mousemoveCount++;
                        if (mousemoveCount === 1 || mousemoveCount % 50 === 0) {
                            console.log('[TEST] Mousemove count:', mousemoveCount);
                        }
                    };

                    const clickHandler = () => {
                        clickCount++;
                        console.log('[TEST] Click count:', clickCount);
                    };

                    const mousedownHandler = () => {
                        mousedownCount++;
                        console.log('[TEST] Mousedown count:', mousedownCount);
                    };

                    document.addEventListener('mousemove', mousemoveHandler, true);
                    document.addEventListener('click', clickHandler, true);
                    document.addEventListener('mousedown', mousedownHandler, true);

                    console.log('✅ Test event listeners attached');
                    console.log('   Move your mouse and click to see event counts');
                    console.log('   Listeners will be removed after 10 seconds');

                    // 10秒後に削除
                    setTimeout(() => {
                        document.removeEventListener('mousemove', mousemoveHandler, true);
                        document.removeEventListener('click', clickHandler, true);
                        document.removeEventListener('mousedown', mousedownHandler, true);
                        console.log('✅ Test event listeners removed');
                        console.log('   Final counts:', {
                            mousemove: mousemoveCount,
                            click: clickCount,
                            mousedown: mousedownCount
                        });
                    }, 10000);
                })();
            `);

            console.log('✅ Event listener test initiated');
            console.log('   Check the WebView console for event counts');
            console.log('   Open DevTools: Right-click in webview → Inspect');
        } catch (error) {
            console.error('❌ Event listener test failed:', error);
        }
    }

    /**
     * モード変更のテスト
     */
    async testModeChange(mode: 'element' | 'detail' | 'off'): Promise<boolean> {
        console.log(`🎨 [Tab ${this.tabId}] Testing mode change to '${mode}'...`);

        try {
            // モード変更前の状態を取得
            const beforeMode = await this.webview.executeJavaScript(
                'window.__elementHighlighter.mode'
            );
            console.log(`   - Before: ${beforeMode}`);

            // モードを変更
            await this.webview.executeJavaScript(`
                window.__elementHighlighter.setMode('${mode}');
            `);

            // 少し待つ
            await new Promise(resolve => setTimeout(resolve, 100));

            // モード変更後の状態を取得
            const afterMode = await this.webview.executeJavaScript(
                'window.__elementHighlighter.mode'
            );
            console.log(`   - After: ${afterMode}`);

            // カーソルクラスを確認
            const cursorClass = await this.webview.executeJavaScript(`
                (function() {
                    const body = document.body;
                    return {
                        hasElementCursor: body.classList.contains('element-mode-cursor'),
                        hasDetailCursor: body.classList.contains('detail-mode-cursor'),
                        allClasses: Array.from(body.classList)
                    };
                })();
            `);
            console.log(`   - Cursor classes:`, cursorClass);

            if (afterMode === mode) {
                console.log('✅ Mode change successful');
                return true;
            } else {
                console.error(`❌ Mode change failed! Expected '${mode}', got '${afterMode}'`);
                return false;
            }
        } catch (error) {
            console.error('❌ Mode change test error:', error);
            return false;
        }
    }

    /**
     * 包括的な診断を実行
     */
    async runFullDiagnostics(): Promise<void> {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║  WebView Highlighter Diagnostics - Tab ${this.tabId}
╚════════════════════════════════════════════════════════════╝
        `);

        console.log('Step 1: Checking highlighter state...');
        await this.checkHighlighterState();

        console.log('\nStep 2: Testing overlay rendering...');
        const overlayWorks = await this.testOverlay();

        console.log('\nStep 3: Testing mode change...');
        await this.testModeChange('element');
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.testModeChange('off');

        console.log('\nStep 4: Testing event listeners...');
        console.log('⚠️  Move your mouse and click in the WebView for 10 seconds...');
        await this.testEventListeners();

        console.log('\n' + '='.repeat(60));
        console.log('Diagnostics Summary:');
        console.log(`  - Overlay rendering: ${overlayWorks ? '✅ PASS' : '❌ FAIL'}`);
        console.log('  - Event listener test: Check WebView console for results');
        console.log('  - Mode change: See logs above');
        console.log('\n💡 Tips:');
        console.log('  - Open WebView DevTools: Right-click in webview → Inspect');
        console.log('  - Check both this console AND the WebView console');
        console.log('='.repeat(60));
    }

    /**
     * 通信の健全性を継続的にモニター
     */
    startHealthMonitoring(intervalMs: number = 5000): () => void {
        console.log(`💓 [Tab ${this.tabId}] Starting health monitoring (every ${intervalMs}ms)`);

        const intervalId = setInterval(async () => {
            try {
                const health = await this.webview.executeJavaScript(`
                    (function() {
                        if (!window.__elementHighlighter) {
                            return { status: 'error', reason: 'Highlighter not found' };
                        }
                        return {
                            status: 'ok',
                            mode: window.__elementHighlighter.mode,
                            highlightCount: window.__elementHighlighter.detailHighlights.length,
                            overlayInDOM: !!document.getElementById('element-highlighter-overlay')?.parentNode
                        };
                    })();
                `);

                if (health.status === 'ok') {
                    console.log(`💚 [Tab ${this.tabId}] Health OK`, health);
                } else {
                    console.error(`💔 [Tab ${this.tabId}] Health check failed:`, health);
                }
            } catch (error) {
                console.error(`💔 [Tab ${this.tabId}] Health check error:`, error);
            }
        }, intervalMs);

        // 停止用の関数を返す
        return () => {
            clearInterval(intervalId);
            console.log(`💓 [Tab ${this.tabId}] Health monitoring stopped`);
        };
    }
}