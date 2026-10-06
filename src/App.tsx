import { useState, useEffect } from 'react'
import { PanelLeft, BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import SettingsModal from './components/SettingsModal'
import QuranResearch from './pages/QuranResearch'
import { useChat } from './hooks/useChat'
import { GUEST_MESSAGE_LIMIT } from './context/AuthContext'

type ActiveView = 'chat' | 'quran'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeView, setActiveView] = useState<ActiveView>('chat')
  const navigate = useNavigate()

  // 🔥 PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [canInstall, setCanInstall] = useState(false)

  const {
    chats, activeChat, activeChatId, isTyping, streamingContent, streamingThinking,
    setActiveChatId, createChat, deleteChat, renameChat,
    sendMessage, regenerate, editMessage, clearAllChats, stopGeneration,
    isGuest, guestMessageCount, guestLimitReached,
  } = useChat()

  // Redirect to login when guest limit is reached
  useEffect(() => {
    if (!guestLimitReached) return
    const timer = setTimeout(() => navigate('/login'), 800)
    return () => clearTimeout(timer)
  }, [guestLimitReached, navigate])

  // 🔥 Capture install event
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // 🔥 Install function
  const installApp = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choiceResult = await deferredPrompt.userChoice
    if (choiceResult.outcome === 'accepted') console.log('Installed 🎉')
    setDeferredPrompt(null)
    setCanInstall(false)
  }

  return (
    <div className="flex min-h-screen w-full text-app" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── Sidebar — hidden entirely for guests ── */}
      {!isGuest && (
        <>
          {/* Mobile overlay */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/50 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* Sidebar — desktop */}
          <div className="relative hidden md:flex sticky top-0 h-screen self-start">
            <Sidebar
              chats={chats}
              activeChatId={activeChatId}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              onNewChat={() => { createChat(); setActiveView('chat') }}
              onSelectChat={(id) => { setActiveChatId(id); setActiveView('chat') }}
              onDeleteChat={deleteChat}
              onRenameChat={renameChat}
              onOpenSettings={() => setSettingsOpen(true)}
              activeView={activeView}
              onQuranResearch={() => setActiveView('quran')}
            />
          </div>

          {/* Sidebar — mobile drawer */}
          <div
            className={`fixed inset-y-0 left-0 z-30 md:hidden sidebar-transition ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar
              chats={chats}
              activeChatId={activeChatId}
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
              onNewChat={() => { createChat(); setMobileSidebarOpen(false); setActiveView('chat') }}
              onSelectChat={(id) => { setActiveChatId(id); setMobileSidebarOpen(false); setActiveView('chat') }}
              onDeleteChat={deleteChat}
              onRenameChat={renameChat}
              onOpenSettings={() => { setSettingsOpen(true); setMobileSidebarOpen(false) }}
              activeView={activeView}
              onQuranResearch={() => { setActiveView('quran'); setMobileSidebarOpen(false) }}
            />
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-screen">

        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>

          {/* Mobile menu toggle — only for logged-in users */}
          {!isGuest && (
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <PanelLeft size={18} />
            </button>
          )}

          {/* Collapsed sidebar toggle — only for logged-in users */}
          {!isGuest && sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="hidden md:flex p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <PanelLeft size={18} />
            </button>
          )}

          {/* Title / Guest badge */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {activeView === 'quran' ? (
              <div className="flex items-center gap-2">
                <BookOpen size={15} style={{ color: 'var(--accent)' }} />
                <h1 className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                  Quran Research
                </h1>
              </div>
            ) : (
              <h1 className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                {isGuest ? 'AI Islam' : (activeChat?.title ?? 'AI Islam')}
              </h1>
            )}
            {isGuest && (
              <span
                className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
              >
                Guest · {guestMessageCount}/{GUEST_MESSAGE_LIMIT}
              </span>
            )}
          </div>

          {/* Guest — sign in button in header */}
          {isGuest && (
            <button
              onClick={() => navigate('/login')}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 10px var(--accent-subtle)' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              Sign in
            </button>
          )}

          {/* 🔥 Install Button */}
          {canInstall && (
            <button
              onClick={installApp}
              className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              Install ⚡
            </button>
          )}
        </header>

        {/* Main content — Chat or Quran Research */}
        {activeView === 'quran' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <QuranResearch />
          </div>
        ) : (
          <ChatArea
            chat={activeChat}
            isTyping={isTyping}
            streamingContent={streamingContent}
            streamingThinking={streamingThinking}
            onSend={sendMessage}
            onStop={stopGeneration}
            onRegenerate={regenerate}
            onEditMessage={editMessage}
          />
        )}
      </div>

      {/* Settings modal — only for logged-in users */}
      {!isGuest && settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onClearChats={clearAllChats}
        />
      )}

      {/* Guest limit reached — brief overlay before redirect */}
      {isGuest && guestLimitReached && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-6 flex flex-col items-center gap-4 text-center"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--accent-subtle)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="var(--accent)"/>
                <circle cx="17.5" cy="5.5" r="1.5" fill="var(--accent)"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                You've used all {GUEST_MESSAGE_LIMIT} free messages
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Taking you to sign in…
              </p>
            </div>
            {/* Animated progress bar */}
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: 'var(--accent)',
                  animation: 'guestRedirect 0.8s linear forwards',
                }}
              />
            </div>
            <style>{`
              @keyframes guestRedirect {
                from { width: 0% }
                to   { width: 100% }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  )
}
