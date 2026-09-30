import { useState, useEffect, useRef } from 'react'
import { X, Sun, Moon, Monitor, Trash2, ChevronRight, Camera, Loader, Mail, Pencil, Check, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

interface Props {
  onClose: () => void
  onClearChats: () => void
}

type Section = 'Profile' | 'General' | 'Personalization' | 'AI Behavior' | 'Data Controls'

const SECTIONS: Section[] = ['Profile', 'General', 'Personalization', 'AI Behavior', 'Data Controls']

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative rounded-full transition-colors duration-200 focus:outline-none shrink-0"
      style={{ height: '22px', width: '40px', background: enabled ? 'var(--text-primary)' : 'var(--bg-hover)', border: '1px solid var(--border)' }}
    >
      <span
        className="absolute top-0.5 rounded-full transition-transform duration-200"
        style={{
          width: '16px', height: '16px',
          left: '2px',
          background: enabled ? 'var(--bg-primary)' : 'var(--text-muted)',
          transform: enabled ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

function SectionHeading({ title }: { title: string }) {
  return <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>{title}</p>
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 last:border-0" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SegmentedControl({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: 'var(--bg-hover)' }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
          style={value === o
            ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' }
            : { color: 'var(--text-muted)' }
          }
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export default function SettingsModal({ onClose, onClearChats }: Props) {
  const [visible, setVisible] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('General')
  const [contentKey, setContentKey] = useState(0)

  const { theme, contrast, accent, setTheme, setContrast, setAccent } = useTheme()
  const { user, isGuest, saveDisplayName, savePhotoURL } = useAuth()
  const navigate = useNavigate()

  // profile state — derive from Firebase user (displayName / photoURL)
  const storedName = user?.displayName ?? 'User'
  const [displayName, setDisplayName] = useState(storedName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.photoURL ?? null)
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileOk, setProfileOk] = useState('')
  const [profileErr, setProfileErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // keep avatar in sync if Firebase user object updates
  useEffect(() => {
    const url = user?.photoURL ?? null
    setAvatarUrl(url)
  }, [user?.photoURL])

  // keep name in sync
  useEffect(() => {
    setDisplayName(user?.displayName ?? 'User')
  }, [user?.displayName])

  function showProfileOk(msg: string) { setProfileOk(msg); setTimeout(() => setProfileOk(''), 3000) }
  function showProfileErr(msg: string) { setProfileErr(msg); setTimeout(() => setProfileErr(''), 5000) }

  async function saveName() {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed === (user?.displayName ?? 'User')) { setEditingName(false); return }
    setSavingName(true)
    try {
      await saveDisplayName(trimmed)
      setEditingName(false)
      showProfileOk('Name updated.')
    } catch (err: unknown) {
      showProfileErr(err instanceof Error ? err.message : 'Failed to update name.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { showProfileErr('Please select an image file.'); return }
    if (fileRef.current) fileRef.current.value = ''
    setUploadingAvatar(true)

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file)
    setAvatarUrl(localPreview)

    try {
      // Convert to base64 and store as Firebase photoURL
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await savePhotoURL(base64)
      setAvatarUrl(base64)
      showProfileOk('Photo updated.')
    } catch (err: unknown) {
      showProfileErr(err instanceof Error ? err.message : 'Failed to upload photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const email = user?.email ?? ''
  const provider: string = user?.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email'
  // personalization
  const [aboutYou, setAboutYou] = useState('')
  const [responseStyle, setResponseStylePref] = useState('')
  // ai behavior
  const [style, setStyle] = useState('Default')
  const [length, setLength] = useState('Medium')
  // data controls
  const [chatHistory, setChatHistory] = useState(true)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  const switchSection = (s: Section) => {
    if (s === activeSection) return
    setContentKey((k) => k + 1)
    setActiveSection(s)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-250 ${
        visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`w-full max-w-2xl max-h-[92vh] border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-250 mx-3 sm:mx-4 ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* Sidebar nav — horizontal scroll on mobile, vertical on sm+ */}
          <nav className="sm:w-44 shrink-0 py-2 sm:py-3 px-2 flex sm:flex-col flex-row overflow-x-auto gap-0.5 sm:space-y-0.5 pb-1 sm:pb-3" style={{ borderBottom: '1px solid var(--border)' }} >
            <style>{`.settings-nav { border-bottom: 1px solid var(--border); } @media (min-width: 640px) { .settings-nav { border-bottom: none; border-right: 1px solid var(--border); } }`}</style>
            <div className="settings-nav flex sm:flex-col flex-row gap-0.5 w-full">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => switchSection(s)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 whitespace-nowrap sm:w-full"
                style={{
                  background: activeSection === s ? 'var(--bg-hover)' : 'transparent',
                  color: activeSection === s ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
                onMouseEnter={e => { if (activeSection !== s) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (activeSection !== s) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{s}</span>
                {activeSection === s && <ChevronRight size={13} className="hidden sm:block" style={{ color: 'var(--text-muted)' }} />}
              </button>
            ))}
            </div>
          </nav>

          {/* Content */}
          <div
            key={contentKey}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 min-h-[300px] sm:min-h-0"
            style={{ animation: 'settingsFadeIn 0.18s ease forwards' }}
          >
            {activeSection === 'Profile' && (
              <div>
                <SectionHeading title="Profile" />

                {isGuest ? (
                  /* Guest — no account to show */
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: 'var(--accent-subtle)' }}
                    >
                      <LogIn size={22} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                        You're browsing as a guest
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Sign up for free to save your chat history, sync across devices, and get unlimited messages.
                      </p>
                    </div>
                    <div className="flex gap-2 w-full max-w-xs">
                      <button
                        onClick={() => { handleClose(); navigate('/login') }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 14px var(--accent-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                      >
                        Sign up free
                      </button>
                      <button
                        onClick={() => { handleClose(); navigate('/login') }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-muted)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        Sign in
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2 mb-6">
                  <div
                    className="relative group cursor-pointer avatar-pop"
                    onClick={() => fileRef.current?.click()}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover" style={{ border: '2px solid var(--border)' }} />
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white select-none" style={{ background: 'var(--accent)' }}>
                        {initials}
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.5)' }}>
                      {uploadingAvatar ? <Loader size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)', border: '2px solid var(--bg-secondary)' }}>
                      {uploadingAvatar ? <Loader size={10} className="text-white animate-spin" /> : <Camera size={10} className="text-white" />}
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Click to change photo</p>
                </div>

                {/* Display name */}
                <div className="modal-row mb-4" style={{ animationDelay: '0.08s' }}>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Display name</label>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setDisplayName(storedName); setEditingName(false) } }}
                        autoFocus
                        className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={saveName} disabled={savingName} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)', color: '#fff' }}>
                        {savingName ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
                      <button onClick={() => setEditingName(true)} className="p-1 rounded-md transition-all" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="modal-row" style={{ animationDelay: '0.14s' }}>
                  <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                    <Mail size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{email}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize shrink-0" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {provider}
                    </span>
                  </div>
                </div>

                {profileOk && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>{profileOk}</p>}
                {profileErr && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>{profileErr}</p>}
                  </>
                )}
              </div>
            )}

            {activeSection === 'General' && (
              <div>
                <SectionHeading title="Appearance" />
                <Row label="Theme" sub="Choose your preferred appearance">
                  <div className="flex items-center gap-1.5 rounded-lg p-0.5" style={{ background: 'var(--bg-hover)' }}>
                    {(['Light', 'Dark', 'System'] as const).map((t) => {
                      const Icon = t === 'Light' ? Sun : t === 'Dark' ? Moon : Monitor
                      return (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          title={t}
                          className="p-1.5 rounded-md transition-all duration-150"
                          style={theme === t
                            ? { background: 'var(--text-primary)', color: 'var(--bg-primary)' }
                            : { color: 'var(--text-muted)' }
                          }
                        >
                          <Icon size={14} />
                        </button>
                      )
                    })}
                  </div>
                </Row>
                <Row label="Contrast" sub="Adjust interface contrast level">
                  <SegmentedControl
                    options={['Default', 'High']}
                    value={contrast}
                    onChange={(v) => setContrast(v as 'Default' | 'High')}
                  />
                </Row>
                <Row label="Accent color" sub="Highlight color used across the UI">
                  <div className="flex items-center gap-2">
                    {['#16a34a', '#d4a017', '#2563eb', '#059669', '#dc2626', '#d97706', '#ffffff'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setAccent(c)}
                        title={c}
                        className="w-5 h-5 rounded-full transition-all duration-150 hover:scale-110"
                        style={{
                          background: c,
                          outline: accent === c ? `2px solid ${c}` : '2px solid transparent',
                          outlineOffset: '2px',
                          border: c === '#ffffff' ? '1px solid rgba(255,255,255,0.2)' : 'none',
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      title="Custom color"
                      className="w-5 h-5 rounded-full cursor-pointer bg-transparent border-0 p-0 opacity-40 hover:opacity-80 transition-opacity"
                      style={{ appearance: 'none' }}
                    />
                  </div>
                </Row>

                <div className="mt-2 pt-2">
                  <SectionHeading title="General" />
                  <Row label="Clear all chats" sub="Permanently delete your chat history">
                    <button
                      onClick={() => { onClearChats(); handleClose() }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/30 transition-all"
                    >
                      <Trash2 size={12} />
                      Clear chats
                    </button>
                  </Row>
                </div>
              </div>
            )}

            {activeSection === 'Personalization' && (
              <div>
                <SectionHeading title="Personalization" />
                <div className="space-y-4">
                  <div>
                    <p className="text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>What would you like the AI to know about you?</p>
                    <textarea
                      value={aboutYou}
                      onChange={(e) => setAboutYou(e.target.value)}
                      placeholder="e.g. I'm a software engineer who prefers concise answers..."
                      rows={4}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-colors leading-relaxed"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <p className="text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>How would you like the AI to respond?</p>
                    <textarea
                      value={responseStyle}
                      onChange={(e) => setResponseStylePref(e.target.value)}
                      placeholder="e.g. Be direct, use bullet points, avoid jargon..."
                      rows={4}
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none transition-colors leading-relaxed"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'AI Behavior' && (
              <div>
                <SectionHeading title="AI Behavior" />
                <Row label="Response style" sub="Tone used in AI replies">
                  <SegmentedControl
                    options={['Default', 'Professional', 'Casual']}
                    value={style}
                    onChange={setStyle}
                  />
                </Row>
                <Row label="Response length" sub="How detailed should replies be">
                  <SegmentedControl
                    options={['Short', 'Medium', 'Long']}
                    value={length}
                    onChange={setLength}
                  />
                </Row>
              </div>
            )}

            {activeSection === 'Data Controls' && (
              <div>
                <SectionHeading title="Data Controls" />
                <Row
                  label="Chat history & training"
                  sub="Allow chats to improve future models"
                >
                  <Toggle enabled={chatHistory} onChange={setChatHistory} />
                </Row>
                <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Delete all data</p>
                  <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    This will permanently delete all your conversations, settings, and personalization data. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => { onClearChats(); handleClose() }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-red-400/80 hover:text-red-400 bg-red-500/[0.06] hover:bg-red-500/10 border border-red-500/15 hover:border-red-500/25 transition-all"
                  >
                    <Trash2 size={14} />
                    Delete all data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
