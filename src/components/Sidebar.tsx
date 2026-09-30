import { useState, useRef, useEffect } from 'react'
import { Plus, MessageSquare, Pencil, Trash2, Settings, X, LogIn, ChevronLeft, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Chat } from '../hooks/useChat'
import { useAuth, GUEST_MESSAGE_LIMIT } from '../context/AuthContext'
import AccountModal from './AccountModal'

interface Props {
  chats: Chat[]
  activeChatId: string | null
  collapsed: boolean
  onToggle: () => void
  onNewChat: () => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onRenameChat: (id: string, title: string) => void
  onOpenSettings: () => void
}

export default function Sidebar({
  chats, activeChatId, collapsed, onToggle, onNewChat,
  onSelectChat, onDeleteChat, onRenameChat, onOpenSettings,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)
  const { user, isGuest, guestMessageCount } = useAuth()
  const navigate = useNavigate()

  const name: string = user?.displayName ?? 'Account'
  const avatar: string | null = user?.photoURL ?? null
  const email: string = user?.email ?? ''
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus()
  }, [editingId])

  const startEdit = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(chat.id)
    setEditValue(chat.title)
  }

  const commitEdit = (id: string) => {
    if (editValue.trim()) onRenameChat(id, editValue.trim())
    setEditingId(null)
  }

  return (
    <aside
      className={`sidebar-transition flex flex-col h-full shrink-0 ${collapsed ? 'w-0 overflow-hidden' : 'w-[260px]'}`}
      style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)' }}
    >
      {/* ── Inner wrapper — only visible when expanded ── */}
      <div className="flex flex-col h-full" style={{ minWidth: 260 }}>

        {/* ── Header: brand + collapse ── */}
        <div
          className="flex items-center justify-between px-4 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-subtle)' }}
            >
              <Sparkles size={15} color="#fff" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>AI Islam</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Islamic Guidance</p>
            </div>
          </div>

          {/* Collapse button */}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-all"
            title="Collapse sidebar"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* ── New Chat button ── */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            onClick={onNewChat}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              boxShadow: '0 2px 12px var(--accent-subtle)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New Chat</span>
          </button>
        </div>

        {/* ── Chat history ── */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {chats.length > 0 && (
            <p
              className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Recents
            </p>
          )}

          {chats.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
              <MessageSquare size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No chats yet. Start a new one!</p>
            </div>
          )}

          <div className="space-y-0.5">
            {chats.map((chat) => {
              const isActive = activeChatId === chat.id
              const isHovered = hoveredId === chat.id
              return (
                <div
                  key={chat.id}
                  className="group relative flex items-center rounded-lg cursor-pointer transition-all duration-150"
                  style={{
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    setHoveredId(chat.id)
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={e => {
                    setHoveredId(null)
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                  onClick={() => onSelectChat(chat.id)}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ background: 'var(--accent)' }}
                    />
                  )}

                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pl-3 pr-2 py-2.5">
                    <MessageSquare
                      size={13}
                      className="shrink-0"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', opacity: isActive ? 1 : 0.7 }}
                    />

                    {editingId === chat.id ? (
                      <input
                        ref={editRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(chat.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 text-sm rounded-md px-1.5 py-0.5 outline-none"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--accent)',
                        }}
                      />
                    ) : (
                      <span
                        className="text-xs flex-1 truncate"
                        style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {chat.title}
                      </span>
                    )}
                  </div>

                  {/* Action buttons — show on hover, hide on edit */}
                  {isHovered && editingId !== chat.id && (
                    <div className="flex items-center gap-0.5 pr-2 shrink-0">
                      <button
                        onClick={(e) => startEdit(chat, e)}
                        title="Rename"
                        className="p-1 rounded-md transition-all"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id) }}
                        title="Delete"
                        className="p-1 rounded-md transition-all"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.1)'
                          e.currentTarget.style.color = '#f87171'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 px-3 py-3 space-y-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* Settings row */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <Settings size={14} className="shrink-0" />
            <span className="text-xs">Settings</span>
          </button>

          {/* User / Guest card */}
          {isGuest ? (
            /* Guest sign-in card */
            <div
              className="rounded-xl p-3 flex flex-col gap-2.5"
              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Guest mode</p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                >
                  {guestMessageCount}/{GUEST_MESSAGE_LIMIT}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(guestMessageCount / GUEST_MESSAGE_LIMIT) * 100}%`,
                    background: guestMessageCount >= GUEST_MESSAGE_LIMIT ? '#f87171' : 'var(--accent)',
                  }}
                />
              </div>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'var(--accent)', color: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <LogIn size={12} />
                Sign in for unlimited
              </button>
            </div>
          ) : (
            /* Logged-in user card */
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-150 text-left"
              style={{ border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Avatar */}
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                  style={{ border: '1.5px solid var(--border)' }}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  {initials}
                </div>
              )}

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
                {email && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{email}</p>
                )}
              </div>

              {/* Chevron / close hint */}
              <X size={11} style={{ color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }} />
            </button>
          )}
        </div>
      </div>

      {!isGuest && accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </aside>
  )
}
