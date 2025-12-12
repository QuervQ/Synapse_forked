import { Message } from '../types/message'

interface Props {
    message: Message
}

export function ChatMessage({ message }: Props) {
    return (
        <div className="message">
            <strong>{message.user_name}</strong>
            <span className="time">
                {new Date(message.created_at).toLocaleTimeString()}
            </span>
            <p>{message.content}</p>
        </div>
    )
}