import { Link } from 'react-router-dom'

function NotFound() {
    return (
        <div className="not-found">
            <h1>404</h1>
            <p>ページが見つかりません</p>
            <Link to="/" className="btn-primary">
                ホームに戻る
            </Link>
        </div>
    )
}

export default NotFound