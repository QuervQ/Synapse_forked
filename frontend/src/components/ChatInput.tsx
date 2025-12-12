import { useState } from 'react'

interface Props {
    onSend: (userName: string, content: string) => void
}

export function ChatInput({ onSend }: Props) {
    const [userName, setUserName] = useState('')
    const [content, setContent] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (userName.trim() && content.trim()) {
            onSend(userName, content)
            setContent('')
        }
    }

    return (
        <form onSubmit={handleSubmit} className="chat-input">
            <input
                type="text"
                placeholder="名前"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
            />
            <input
                type="text"
                placeholder="メッセージを入力..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
            />
            <button type="submit">送信</button>
        </form>
    )
}