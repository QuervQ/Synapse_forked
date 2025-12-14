// frontend/src/components/HighlighterControls.tsx

import { HighlighterMode } from '../hooks/useHighlighter';

interface HighlighterControlsProps {
    mode: HighlighterMode;
    onModeChange: (mode: HighlighterMode) => void;
}

export function HighlighterControls({ mode, onModeChange }: HighlighterControlsProps) {
    return (
        <div style={{ 
            marginLeft: 'auto', 
            display: 'flex', 
            gap: '4px',
            borderLeft: '1px solid #999',
            paddingLeft: '10px'
        }}>
            <button
                onClick={() => onModeChange(mode === 'element' ? 'off' : 'element')}
                style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    background: mode === 'element' ? '#4285f4' : '#fff',
                    color: mode === 'element' ? 'white' : 'black',
                    border: '1px solid #999',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: mode === 'element' ? 'bold' : 'normal'
                }}
                title="要素選択モード (Ctrl+Shift+C)"
            >
                🔍 要素選択
            </button>
            <button
                onClick={() => onModeChange(mode === 'detail' ? 'off' : 'detail')}
                style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    background: mode === 'detail' ? '#fbbc04' : '#fff',
                    color: 'black',
                    border: '1px solid #999',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: mode === 'detail' ? 'bold' : 'normal'
                }}
                title="詳細選択モード (Ctrl+Shift+D)"
            >
                ✏️ 詳細選択
            </button>
            {mode !== 'off' && (
                <button
                    onClick={() => onModeChange('off')}
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
    );
}