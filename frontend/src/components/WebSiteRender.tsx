import { useState, useEffect, useRef } from 'react';

interface WebSiteRenderProps {
    url: string;
    width?: number | string;
    /**
     * Callback invoked when the displayed URL changes (e.g., hyperlink navigation).
     */
    onUrlChange?: (url: string) => void;
    /**
     * Callback invoked when the underlying webview element is ready.
     */
    onWebviewReady?: (ref: any) => void;
    height?: number | string;
    isActive?: boolean;
    className?: string;
}

export function WebSiteRender({ url, width = 800, height = 600, isActive = true, className, onUrlChange, onWebviewReady }: WebSiteRenderProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Track the URL currently displayed in the webview
    const [currentUrl, setCurrentUrl] = useState(url);
    const webviewRef = useRef<any>(null); // Type check for webview element is tricky in React

    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;

        // Notify parent when the webview is ready (after dom-ready)
        const handleDomReady = () => {
            if (onWebviewReady) onWebviewReady(webview);
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
        // Listen for navigation events to keep currentUrl in sync
        const handleNavigate = (e: any) => {
            setCurrentUrl(e.url);
            if (onUrlChange) onUrlChange(e.url);
        };
        const handleNewWindow = (e: any) => {
            // Prevent Electron from opening a new external window
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            // Load the URL in the same webview and update state
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
    }, []);

    // Update webview src when url prop changes
    useEffect(() => {
        const webview = webviewRef.current;
        if (!webview) return;
        // Reset loading and error states
        setIsLoading(true);
        setError(null);
        // Compute finalUrl again (same logic as below)
        let newUrl = url;
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            newUrl = 'https://' + url;
        }
        webview.src = newUrl;
        setCurrentUrl(newUrl);
    }, [url]);

    if (!isActive) return null;

    // Compute the URL for the initial load (used for the webview src attribute)
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
            {/* Display the current URL above the webview */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '4px 8px',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: '12px',
                zIndex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>{currentUrl}</div>
            {/* 
        webviewTag must be enabled in main process webPreferences. 
        Note: style needs to be fully defined for the webview to take up space.
      */}
            <webview
                ref={webviewRef}
                src={finalUrl}
                style={{ width: '100%', height: '100%', display: 'inline-flex' }}
                allowpopups
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
