import { ChatRoom } from '../components/ChatRoom'
import { Link } from 'react-router-dom'

function ChatPage() {
    return (
        <div className="chat-page">
            <div className="chat-header">
                <Link to="/" className="back-link">← ホームに戻る</Link>
                <h1>チャットルーム</h1>
            </div>
            <ChatRoom />
        </div>
    )
}

export default ChatPage