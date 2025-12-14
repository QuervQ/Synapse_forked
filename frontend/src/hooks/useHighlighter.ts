// frontend/src/hooks/useHighlighter.ts

import { useEffect, useRef, useState } from 'react';
import { getHighlighterScript } from '../utils/highlighter-script';

export type HighlighterMode = 'element' | 'detail' | 'off';

interface UseHighlighterOptions {
    activeTabId: number;
    enabled?: boolean;
    webviewRefs?: React.MutableRefObject<{ [key: number]: any }>; // 🔧 追加
}

interface UseHighlighterReturn {
    highlighterMode: HighlighterMode;
    changeHighlighterMode: (mode: HighlighterMode) => void;
    injectHighlighterScript: (webviewEl: any, tabId: number) => void;
    highlighterInjected: React.MutableRefObject<Set<number>>;
}

/**
 * ハイライター機能を管理するカスタムフック
 */
export function useHighlighter({ activeTabId, enabled = true, webviewRefs: externalWebviewRefs }: UseHighlighterOptions): UseHighlighterReturn {
    const [highlighterMode, setHighlighterMode] = useState<HighlighterMode>('off');
    const highlighterInjected = useRef<Set<number>>(new Set());
    
    // 🔧 外部から渡された webviewRefs を使うか、内部で作成
    const internalWebviewRefs = useRef<{ [key: number]: any }>({});
    const webviewRefs = externalWebviewRefs || internalWebviewRefs;
    
    // 注入処理中のタブを追跡（競合状態を防ぐ）
    const injectingTabs = useRef<Set<number>>(new Set());
    // highlighterModeの最新値を常に参照するためのRef
    const highlighterModeRef = useRef<HighlighterMode>('off');

    // highlighterModeが変更されたらRefも更新（常に実行）
    useEffect(() => {
        highlighterModeRef.current = highlighterMode;
    }, [highlighterMode]);

    // アクティブタブが変更されたときにwebview参照を更新（常に実行）
    useEffect(() => {
        const activeWebview = webviewRefs.current[activeTabId];
        if (activeWebview && highlighterInjected.current.has(activeTabId)) {
            // アクティブタブのモードを現在の状態に同期
            changeHighlighterModeForWebview(activeWebview, highlighterModeRef.current);
        }
    }, [activeTabId]);

    // キーボードショートカット（常に実行）
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // enabledでない場合は早期リターン
            if (!enabled) return;

            // Ctrl+Shift+C: 要素選択モード
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
                e.preventDefault();
                changeHighlighterMode(highlighterModeRef.current === 'element' ? 'off' : 'element');
            }
            // Ctrl+Shift+D: 詳細選択モード
            else if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                changeHighlighterMode(highlighterModeRef.current === 'detail' ? 'off' : 'detail');
            }
            // Escape: ハイライトをクリアして無効化
            else if (e.code === 'Escape' && highlighterModeRef.current !== 'off') {
                e.preventDefault();
                setHighlighterMode('off');
                // すべてのタブのモードをオフに
                Object.entries(webviewRefs.current).forEach(([tabIdStr, webviewEl]) => {
                    const tabId = parseInt(tabIdStr);
                    if (webviewEl && highlighterInjected.current.has(tabId)) {
                        changeHighlighterModeForWebview(webviewEl, 'off');
                    }
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]); // activeTabId, highlighterMode を削除

    // ハイライタースクリプトを注入
    const injectHighlighterScript = (webviewEl: any, tabId: number) => {
        // 重複チェック
        if (!webviewEl || !enabled) {
            console.log(`⏭️ [injectHighlighterScript] Skipping for tab ${tabId} - webviewEl:${!!webviewEl}, enabled:${enabled}`);
            return;
        }
        
        // 既に注入済み、または注入処理中の場合はスキップ
        if (highlighterInjected.current.has(tabId) || injectingTabs.current.has(tabId)) {
            console.log(`⏭️ [injectHighlighterScript] Already injected or injecting for tab ${tabId}, skipping`);
            
            // 注入済みのはずなのに実際には存在しない場合の回復処理
            if (highlighterInjected.current.has(tabId)) {
                console.log(`🔍 [injectHighlighterScript] Verifying injection for tab ${tabId}...`);
                webviewEl.executeJavaScript('typeof window.__elementHighlighter')
                    .then((type: string) => {
                        if (type === 'undefined') {
                            console.warn(`⚠️ [injectHighlighterScript] Tab ${tabId} was marked as injected but highlighter not found!`);
                            console.warn(`   This usually means the page was navigated or reloaded.`);
                            console.warn(`   Clearing state and retrying...`);
                            // 状態をクリアして再注入
                            highlighterInjected.current.delete(tabId);
                            injectingTabs.current.delete(tabId);
                            // 即座に再試行
                            injectHighlighterScript(webviewEl, tabId);
                        } else {
                            console.log(`✅ [injectHighlighterScript] Tab ${tabId} verification passed, highlighter exists`);
                        }
                    })
                    .catch((err: any) => {
                        console.error(`❌ [injectHighlighterScript] Verification failed for tab ${tabId}:`, err);
                        // エラーの場合も状態をクリアして再注入
                        highlighterInjected.current.delete(tabId);
                        injectingTabs.current.delete(tabId);
                        // 少し待ってから再試行
                        setTimeout(() => injectHighlighterScript(webviewEl, tabId), 100);
                    });
            }
            return;
        }

        // 注入処理開始をマーク（競合状態を防ぐ）
        injectingTabs.current.add(tabId);

        // Refから最新の値を取得
        const currentMode = highlighterModeRef.current;

        console.log(`🔧 [injectHighlighterScript] Starting injection for tab ${tabId}`);
        console.log(`   - Current highlighterMode:`, currentMode);
        console.log(`   - webviewEl.src:`, webviewEl.src);

        const scriptToInject = getHighlighterScript();
        console.log(`   - Script length:`, scriptToInject.length, 'characters');

        webviewEl.executeJavaScript(scriptToInject)
            .then((result: any) => {
                console.log(`✅ Highlighter script executed for tab ${tabId}`);
                console.log(`   - Execution result:`, result);
                highlighterInjected.current.add(tabId);
                injectingTabs.current.delete(tabId); // 注入完了
                
                // 注入が成功したか確認
                webviewEl.executeJavaScript('typeof window.__elementHighlighter')
                    .then((type: string) => {
                        console.log(`   - window.__elementHighlighter type:`, type);
                        
                        if (type === 'undefined') {
                            console.error(`❌ Highlighter object not found after injection for tab ${tabId}`);
                            // 注入失敗として扱う
                            highlighterInjected.current.delete(tabId);
                            return;
                        }
                        
                        // Refから最新の値を再度取得（非同期処理のため）
                        const latestMode = highlighterModeRef.current;
                        
                        // 現在のモードを再適用（ページ遷移後も状態を保持）
                        if (latestMode !== 'off') {
                            console.log(`🔄 [injectHighlighterScript] Will restore mode to '${latestMode}' for tab ${tabId}`);
                            // 少し遅延させてDOMが完全に準備されるのを待つ
                            setTimeout(() => {
                                console.log(`⏰ [injectHighlighterScript] Timeout fired, applying mode '${latestMode}' for tab ${tabId}`);
                                changeHighlighterModeForWebview(webviewEl, latestMode);
                            }, 200);
                        } else {
                            console.log(`ℹ️ [injectHighlighterScript] Mode is 'off', not restoring for tab ${tabId}`);
                        }
                    })
                    .catch((err: any) => {
                        console.error(`❌ Failed to verify highlighter for tab ${tabId}:`, err);
                        highlighterInjected.current.delete(tabId);
                    });
            })
            .catch((err: any) => {
                console.error(`❌ Failed to inject highlighter for tab ${tabId}:`, err);
                console.error(`   - Error details:`, err.message, err.stack);
                injectingTabs.current.delete(tabId); // エラー時もクリーンアップ
                highlighterInjected.current.delete(tabId); // 失敗したので削除
            });
    };

    // 特定のwebviewのハイライターモードを変更
    const changeHighlighterModeForWebview = (webviewEl: any, mode: HighlighterMode) => {
        if (!webviewEl) {
            console.error('❌ [changeHighlighterModeForWebview] webviewEl is null/undefined');
            return;
        }

        console.log(`📤 [changeHighlighterModeForWebview] Sending mode '${mode}' to webview`);

        const script = `
            (function() {
                console.log('📡 [WEBVIEW] Received mode change request:', '${mode}');
                console.log('   - window.__elementHighlighter exists:', !!window.__elementHighlighter);
                console.log('   - document.readyState:', document.readyState);
                console.log('   - Timestamp:', new Date().toISOString());
                
                if (window.__elementHighlighter) {
                    console.log('   - Current mode before change:', window.__elementHighlighter.mode);
                    window.__elementHighlighter.setMode('${mode}');
                    console.log('   - Current mode after change:', window.__elementHighlighter.mode);
                    
                    // モードが正しく設定されたか確認
                    if (window.__elementHighlighter.mode === '${mode}') {
                        console.log('✅ [WEBVIEW] Mode successfully set to:', '${mode}');
                    } else {
                        console.error('❌ [WEBVIEW] Mode mismatch! Expected: ${mode}, Got:', window.__elementHighlighter.mode);
                    }
                } else {
                    console.error('❌ [WEBVIEW] window.__elementHighlighter is not available!');
                    console.log('   - Available window properties:', Object.keys(window).filter(k => k.includes('highlighter')));
                }
            })();
        `;

        webviewEl.executeJavaScript(script)
            .then(() => {
                console.log(`✅ [changeHighlighterModeForWebview] Script executed successfully for mode '${mode}'`);
            })
            .catch((err: any) => {
                console.error(`❌ [changeHighlighterModeForWebview] Script execution failed:`, err);
            });
    };

    // アクティブなwebviewのハイライターモードを変更
    const changeHighlighterMode = (mode: HighlighterMode) => {
        console.log(`🎨 [changeHighlighterMode] Changing mode to '${mode}'`);
        setHighlighterMode(mode);
        
        // すべてのタブに現在のモードを適用（注入済みのタブのみ）
        const injectedTabs = Array.from(highlighterInjected.current);
        console.log(`   - Injected tabs:`, injectedTabs);
        console.log(`   - webviewRefs keys:`, Object.keys(webviewRefs.current));
        
        Object.entries(webviewRefs.current).forEach(([tabIdStr, webviewEl]) => {
            const tabId = parseInt(tabIdStr);
            console.log(`   - Checking tab ${tabId}:`, {
                hasWebview: !!webviewEl,
                isInjected: highlighterInjected.current.has(tabId)
            });
            
            if (webviewEl && highlighterInjected.current.has(tabId)) {
                console.log(`   ✅ Applying mode '${mode}' to tab ${tabId}`);
                changeHighlighterModeForWebview(webviewEl, mode);
            } else if (webviewEl && !highlighterInjected.current.has(tabId)) {
                console.log(`   ⚠️ Tab ${tabId} has webview but not injected yet`);
            } else {
                console.log(`   ❌ Tab ${tabId} has no webview`);
            }
        });
        
        console.log(`🎨 Highlighter mode changed to '${mode}' for all tabs`);
    };

    // webview参照を設定するメソッドを外部に公開するために返す
    const setWebviewRef = (tabId: number, webviewEl: any) => {
        if (webviewEl) {
            webviewRefs.current[tabId] = webviewEl;
        }
    };

    // タブを削除する際のクリーンアップ
    const cleanupTab = (tabId: number) => {
        highlighterInjected.current.delete(tabId);
        injectingTabs.current.delete(tabId); // 注入中フラグもクリーンアップ
        delete webviewRefs.current[tabId];
    };

    return {
        highlighterMode,
        changeHighlighterMode,
        injectHighlighterScript,
        highlighterInjected,
    };
}