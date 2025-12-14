// frontend/src/hooks/useHighlighter.ts

import { useEffect, useRef, useState } from 'react';
import { getHighlighterScript } from '../utils/highlighter-script';

export type HighlighterMode = 'element' | 'detail' | 'off';

interface UseHighlighterOptions {
    activeTabId: number;
    enabled?: boolean;
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
export function useHighlighter({ activeTabId, enabled = true }: UseHighlighterOptions): UseHighlighterReturn {
    const [highlighterMode, setHighlighterMode] = useState<HighlighterMode>('off');
    const highlighterInjected = useRef<Set<number>>(new Set());
    const webviewRefs = useRef<{ [key: number]: any }>({});

    // ハイライタースクリプトを注入
    const injectHighlighterScript = (webviewEl: any, tabId: number) => {
        if (!webviewEl || highlighterInjected.current.has(tabId) || !enabled) return;

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

    // webview参照を設定するメソッドを外部に公開するために返す
    const setWebviewRef = (tabId: number, webviewEl: any) => {
        if (webviewEl) {
            webviewRefs.current[tabId] = webviewEl;
        }
    };

    // タブを削除する際のクリーンアップ
    const cleanupTab = (tabId: number) => {
        highlighterInjected.current.delete(tabId);
        delete webviewRefs.current[tabId];
    };

    // キーボードショートカット
    useEffect(() => {
        if (!enabled) return;

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
            // Escape: ハイライトをクリアして無効化
            else if (e.code === 'Escape' && highlighterMode !== 'off') {
                e.preventDefault();
                setHighlighterMode('off');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [highlighterMode, activeTabId, enabled]);

    return {
        highlighterMode,
        changeHighlighterMode,
        injectHighlighterScript,
        highlighterInjected,
    };
}