import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import NotFound from './pages/NotFound'
import { CursorOverlay } from './components/CursorOverlay'

import BrowserPage from './pages/BrowserPage'

function App() {
    return (
        <>
            <CursorOverlay />
            <Routes>
                {/* ホームページ */}
                <Route path="/" element={<HomePage />} />

                {/* チャットページ */}
                <Route path="/chat" element={<ChatPage />} />

                {/* ブラウザページ */}
                <Route path="/browser" element={<BrowserPage />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </>
    )
}

export default App