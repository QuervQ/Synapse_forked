import { useEffect } from 'react';
import { Link } from 'react-router-dom'

export default function HomePage() {
    useEffect(() => {
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
    }, []);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1e1e1e',
            color: '#d4d4d4',
            margin: 0,
            padding: 0
        }}>
            <div style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
                <h1 style={{
                    fontSize: '3em',
                    marginBottom: '20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Synapse
                </h1>
                <Link to="/chat" className="btn-primary" style={{ marginRight: '20px' }}>
                    チャットルームに入る
                </Link>
                <Link to="/browser" className="btn-primary">
                    ブラウザを開く
                </Link>
            </div>
        </div>
    )
}