import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ThumbsUp, ThumbsDown, Share, RefreshCw, MoreHorizontal, Code2, Download, Share2, Pencil, ChevronDown, Brain } from 'lucide-react'
import type { Message } from '../hooks/useChat'
import CanvasPanel from './CanvasPanel'

interface Props {
  message: Message
  isStreaming?: boolean
  isLast?: boolean
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  disabled?: boolean
  streamingThinking?: string
}

// Renders streaming text with smooth token-by-token animation + live cursor
function StreamingText({ content }: { content: string }) {
  // Split into tokens: words + whitespace preserved
  const tokens = content.split(/(\s+)/)
  const prevLenRef = useRef(0)
  const currentLen = tokens.length

  useEffect(() => { prevLenRef.current = currentLen })
  const prevLen = prevLenRef.current

  return (
    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
      {tokens.map((token, i) => (
        <span
          key={i}
          className={i >= prevLen ? 'sw-token' : ''}
          style={i >= prevLen ? { animationDelay: `${(i - prevLen) * 12}ms` } : {}}
        >
          {token}
        </span>
      ))}
      {/* Live cursor */}
      <span className="sw-cursor" aria-hidden="true" />
    </span>
  )
}

// ── Quran & Hadith Citation Parser ───────────────────────────────────────────
// Matches: [Quran 2:255]  [Bukhari 1:1]  [Muslim 4:1234]  etc.
const HADITH_COLLECTIONS: Record<string, string> = {
  bukhari:  'bukhari',
  muslim:   'muslim',
  tirmidhi: 'tirmidhi',
  abudawud: 'abudawud',
  ibnmajah: 'ibnmajah',
  nasai:    'nasai',
  muwatta:  'malik',
  riyadh:   'riyadussalihin',
}

function buildQuranUrl(surah: string, ayah: string) {
  return `https://quran.com/${surah}/${ayah}`
}
function buildHadithUrl(collection: string, book: string, number: string) {
  const key = HADITH_COLLECTIONS[collection.toLowerCase()] ?? collection.toLowerCase()
  return `https://sunnah.com/${key}:${book}:${number}`
}

interface CitationToken {
  type: 'text' | 'quran' | 'hadith'
  text: string
  url?: string
  label?: string
}

function parseCitations(content: string): CitationToken[] {
  const tokens: CitationToken[] = []
  // Combined regex — order matters: quran first, then hadith
  const combined = new RegExp(
    `(\\[Quran\\s+(\\d+):(\\d+)\\])|(\\[(Bukhari|Muslim|Tirmidhi|AbuDawud|IbnMajah|Nasai|Muwatta|Riyadh)\\s+(\\d+):(\\d+)\\])`,
    'gi'
  )
  let last = 0
  let match: RegExpExecArray | null
  while ((match = combined.exec(content)) !== null) {
    if (match.index > last) tokens.push({ type: 'text', text: content.slice(last, match.index) })
    if (match[1]) {
      // Quran
      tokens.push({ type: 'quran', text: match[1], url: buildQuranUrl(match[2], match[3]), label: `Quran ${match[2]}:${match[3]}` })
    } else if (match[4]) {
      // Hadith
      tokens.push({ type: 'hadith', text: match[4], url: buildHadithUrl(match[5], match[6], match[7]), label: `${match[5]} ${match[6]}:${match[7]}` })
    }
    last = match.index + match[0].length
  }
  if (last < content.length) tokens.push({ type: 'text', text: content.slice(last) })
  return tokens
}

function CitationLink({ token }: { token: CitationToken }) {
  if (token.type === 'text') return <>{token.text}</>
  const isQuran = token.type === 'quran'
  return (
    <>
      <style>{`
        .citation-link {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 7px 1px 5px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.18s ease;
          vertical-align: middle;
          margin: 0 2px;
          white-space: nowrap;
        }
        .citation-quran {
          background: rgba(212, 160, 23, 0.12);
          border: 1px solid rgba(212, 160, 23, 0.35);
          color: #d4a017;
        }
        .citation-quran:hover {
          background: rgba(212, 160, 23, 0.22);
          border-color: rgba(212, 160, 23, 0.6);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(212, 160, 23, 0.2);
        }
        .citation-hadith {
          background: var(--accent-subtle);
          border: 1px solid var(--accent-border);
          color: var(--accent);
        }
        .citation-hadith:hover {
          background: rgba(22, 163, 74, 0.18);
          border-color: var(--accent);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(22, 163, 74, 0.2);
        }
        .citation-icon {
          font-size: 10px;
          opacity: 0.8;
        }
      `}</style>
      <a
        href={token.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`citation-link ${isQuran ? 'citation-quran' : 'citation-hadith'}`}
        title={`Open ${token.label} on ${isQuran ? 'quran.com' : 'sunnah.com'}`}
      >
        <span className="citation-icon">{isQuran ? '📖' : '📜'}</span>
        {token.label}
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.6, flexShrink: 0 }}>
          <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>
    </>
  )
}

// Wraps a ReactMarkdown text node and injects citation links
function CitationText({ children }: { children: React.ReactNode }) {
  if (typeof children !== 'string') return <>{children}</>
  const tokens = parseCitations(children)
  if (tokens.length === 1 && tokens[0].type === 'text') return <>{children}</>
  return <>{tokens.map((t, i) => <CitationLink key={i} token={t} />)}</>
}

function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3" style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <style>{`
        @keyframes thinkSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes thinkPulseRing {
          0%   { transform: scale(0.85); opacity: 0.6; }
          50%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.6; }
        }
        @keyframes thinkShimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', fontSize: '12px' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      >
        {/* Animated icon */}
        <span style={{ position: 'relative', width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isStreaming && !open ? (
            <>
              {/* Spinning ring */}
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid transparent',
                borderTopColor: 'var(--accent)',
                borderRightColor: 'var(--accent)',
                animation: 'thinkSpin 0.9s linear infinite',
              }} />
              {/* Pulsing center dot */}
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'thinkPulseRing 1.2s ease-in-out infinite',
              }} />
            </>
          ) : (
            <Brain size={13} style={{ color: 'var(--accent)' }} />
          )}
        </span>

        {/* Label */}
        <span style={{ flex: 1, fontWeight: 500 }}>
          {isStreaming ? (
            <span style={{
              background: 'linear-gradient(90deg, var(--text-muted) 25%, var(--accent) 50%, var(--text-muted) 75%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'thinkShimmer 2s linear infinite',
            }}>
              Thinking…
            </span>
          ) : (
            'Thought process'
          )}
        </span>

        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>
      <div style={{
        maxHeight: open ? '400px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div className="px-3 py-2 overflow-y-auto" style={{ maxHeight: '400px', background: 'var(--bg-secondary)' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {thinking}
          </p>
        </div>
      </div>
    </div>
  )
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const isDark = document.documentElement.classList.contains('light-theme') === false

  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block rounded-lg overflow-hidden my-3" style={{ border: '1px solid var(--border)' }}>
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{language || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        customStyle={{ margin: 0, fontSize: '13px', lineHeight: '1.6', padding: '16px' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

function PollinationsImage({ src }: { src: string; index?: number }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [imgSrc, setImgSrc] = useState(src)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-retry up to 3 times with increasing delay
  const handleError = () => {
    if (retryCount < 3) {
      const delay = (retryCount + 1) * 4000
      retryTimerRef.current = setTimeout(() => {
        setRetryCount((c) => c + 1)
        // Bust cache by appending a new seed param
        const base = src.replace(/&seed=\d+/, '')
        setImgSrc(`${base}&seed=${Date.now()}`)
      }, delay)
    } else {
      setStatus('error')
    }
  }

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current) }
  }, [])

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleShare = async () => {
    try {
      // Fetch image as blob for native share
      const res = await fetch(src)
      const blob = await res.blob()
      const file = new File([blob], 'minnal-ai-image.png', { type: blob.type })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Generated by AI Islam' })
      } else if (navigator.share) {
        await navigator.share({ url: src, title: 'Generated by AI Islam' })
      } else {
        await navigator.clipboard.writeText(src)
      }
    } catch { /* user cancelled or not supported */ }
  }

  const handleDownload = async () => {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `minnal-ai-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  const imgBtn = 'w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90'
  const imgBtnStyle = { background: 'rgba(30,30,30,0.75)', backdropFilter: 'blur(6px)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }

  return (
    <div className="relative group inline-block">
      {status === 'loading' && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center gap-3 text-xs"
          style={{
            width: 'min(320px, 70vw)', height: 'min(320px, 70vw)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          {/* Spinner */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {retryCount > 0 ? `Retrying… (${retryCount}/3)` : 'Generating image…'}
          </span>
        </div>
      )}
      <img
        src={imgSrc}
        alt="Generated image"
        className="rounded-2xl object-cover"
        style={{
          maxWidth: 'min(320px, 70vw)', maxHeight: 'min(320px, 70vw)',
          border: '1px solid var(--border)',
          display: status === 'loaded' ? 'block' : 'none',
        }}
        onLoad={() => setStatus('loaded')}
        onError={handleError}
      />
      {status === 'error' && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center gap-3 text-xs"
          style={{ width: 'min(320px, 70vw)', height: 160, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>Failed to load image</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setStatus('loading')
                setRetryCount(0)
                const base = src.replace(/&seed=\d+/, '')
                setImgSrc(`${base}&seed=${Date.now()}`)
              }}
              style={{
                fontSize: '11px', fontWeight: 600, padding: '5px 12px',
                borderRadius: '8px', background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <a href={src} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '11px' }}>Open in browser</a>
          </div>
        </div>
      )}
      {status === 'loaded' && (
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Share */}
          <button onClick={handleShare} title="Share" className={imgBtn} style={imgBtnStyle}>
            <Share2 size={16} />
          </button>
          {/* Copy image */}
          <button onClick={handleCopy} title={copied ? 'Copied!' : 'Copy image'} className={imgBtn} style={imgBtnStyle}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          {/* Download */}
          <button onClick={handleDownload} title="Download" className={imgBtn} style={imgBtnStyle}>
            <Download size={16} />
          </button>
        </div>
      )}
    </div>
  )
}


function ActionBtn({ onClick, title, active, disabled, children }: {
  onClick: () => void
  title: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-75 active:brightness-125"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-hover)' : 'transparent',
        transition: 'transform 0.1s ease, background 0.15s ease, filter 0.1s ease',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

export default function MessageBubble({ message, isStreaming, isLast, onRegenerate, onEdit, disabled, streamingThinking }: Props) {
  const isUser = message.role === 'user'
  const [liked, setLiked] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const [userCopied, setUserCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const editRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus()
      editRef.current.style.height = 'auto'
      editRef.current.style.height = editRef.current.scrollHeight + 'px'
    }
  }, [isEditing])

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyUserMessage = () => {
    navigator.clipboard.writeText(message.content)
    setUserCopied(true)
    setTimeout(() => setUserCopied(false), 2000)
  }

  const shareMessage = () => {
    navigator.clipboard.writeText(message.content)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  const submitEdit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(trimmed)
    }
    setIsEditing(false)
  }

  if (isUser) {
    return (
      <div className="flex justify-end px-3 sm:px-4 py-2 message-fade-in max-w-3xl mx-auto w-full">
      <div className="group flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[75%]">
          {/* Bubble */}
          <div
            className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed flex flex-col gap-2 w-full"
            style={{ background: 'var(--bubble-user)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.images.map((img, i) => (
                  <img
                    key={i}
                    src={`data:${img.mimeType};base64,${img.base64}`}
                    alt=""
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover"
                    style={{ border: '1px solid var(--border)' }}
                  />
                ))}
              </div>
            )}
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={e => {
                    setEditValue(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
                    if (e.key === 'Escape') { setIsEditing(false); setEditValue(message.content) }
                  }}
                  rows={1}
                  className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed overflow-hidden"
                  style={{ color: 'var(--text-primary)', caretColor: 'var(--accent)', borderBottom: '1px solid var(--accent-border)', paddingBottom: '4px' }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setIsEditing(false); setEditValue(message.content) }}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEdit}
                    className="text-xs px-3 py-1 rounded-lg font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              message.content && <span>{message.content}</span>
            )}
          </div>

          {/* Action buttons — shown on hover */}
          {!isEditing && message.content && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 msg-user-actions">
              <ActionBtn onClick={copyUserMessage} title={userCopied ? 'Copied!' : 'Copy'} active={userCopied}>
                {userCopied ? <Check size={12} /> : <Copy size={12} />}
              </ActionBtn>
              {onEdit && (
                <ActionBtn onClick={() => { setIsEditing(true); setEditValue(message.content) }} title="Edit message">
                  <Pencil size={12} />
                </ActionBtn>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="flex items-start px-3 sm:px-4 py-2 message-fade-in max-w-3xl mx-auto w-full">
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-relaxed${isStreaming ? ' streaming-bubble rounded-xl px-3 py-2 -mx-3 -my-2' : ''}`}
          style={isStreaming ? { border: '1px solid var(--accent-border)', background: 'transparent' } : {}}
        >
        {message.generatedImages && message.generatedImages.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-2">
            {message.generatedImages.map((img, i) => {
              const src = img.mimeType === 'url' ? img.base64 : `data:${img.mimeType};base64,${img.base64}`
              return (
                <PollinationsImage key={i} src={src} index={i} />
              )
            })}
          </div>
        )}
        {(message.thinking || (isStreaming && streamingThinking)) && (
          <ThinkingBlock
            thinking={message.thinking ?? streamingThinking ?? ''}
            isStreaming={isStreaming && !message.thinking}
          />
        )}
        {message.content && (
          isStreaming
            ? <StreamingText content={message.content} />
            : <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
            code({ className, children }) {
              const match = /language-(\w+)/.exec(className || '')
              if (className?.includes('language-') && match) {
                return <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
              }
              return (
                <code
                  className="rounded px-1.5 py-0.5 text-[13px] font-mono"
                  style={{ background: 'var(--bg-hover)', color: 'var(--accent)', border: '1px solid var(--border)' }}
                >
                  {children}
                </code>
              )
            },
            p({ children }) {
              return <p className="mb-3 last:mb-0" style={{ color: 'var(--text-primary)' }}><CitationText>{children as any}</CitationText></p>
            },
            ul({ children }) {
              return <ul className="list-disc list-inside mb-3 space-y-1" style={{ color: 'var(--text-secondary)' }}>{children}</ul>
            },
            ol({ children }) {
              return <ol className="list-decimal list-inside mb-3 space-y-1" style={{ color: 'var(--text-secondary)' }}>{children}</ol>
            },
            li({ children }) {
              return <li style={{ color: 'var(--text-secondary)' }}><CitationText>{children as any}</CitationText></li>
            },
            strong({ children }) {
              return <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>
            },
            h1({ children }) {
              return <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h1>
            },
            h2({ children }) {
              return <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h2>
            },
            h3({ children }) {
              return <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h3>
            },
            blockquote({ children }) {
              return (
                <blockquote
                  className="pl-3 italic my-2"
                  style={{ borderLeft: '2px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  <CitationText>{children as any}</CitationText>
                </blockquote>
              )
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
        )}
        </div>

        {/* Canvas output card */}
        {message.canvasHtml && (
          <div style={{
            marginTop: '8px', borderRadius: '14px', overflow: 'hidden',
            border: '1px solid var(--border)', background: 'var(--bg-hover)',
          }}>
            {/* Mini preview */}
            <div style={{ height: '180px', background: '#fff', pointerEvents: 'none', overflow: 'hidden' }}>
              <iframe
                srcDoc={message.canvasHtml}
                sandbox="allow-scripts allow-same-origin"
                style={{ width: '133%', height: '133%', border: 'none', transform: 'scale(0.75)', transformOrigin: 'top left' }}
                title="Canvas preview"
              />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={13} /> Canvas
              </span>
              <button
                onClick={() => setCanvasOpen(true)}
                style={{
                  fontSize: '12px', fontWeight: 600, padding: '5px 14px',
                  borderRadius: '8px', background: 'var(--accent)', color: '#fff',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Open
              </button>
            </div>
          </div>
        )}

        {/* Action bar — shown on last AI message when not streaming */}
        {!isStreaming && isLast && (
          <div className="flex items-center gap-0.5 mt-2 msg-actions">
            {/* Copy */}
            <ActionBtn onClick={copyMessage} title="Copy" active={copied}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </ActionBtn>
            {/* Like */}
            <ActionBtn onClick={() => setLiked(liked === 'up' ? null : 'up')} title="Good response" active={liked === 'up'}>
              <ThumbsUp size={13} />
            </ActionBtn>
            {/* Dislike */}
            <ActionBtn onClick={() => setLiked(liked === 'down' ? null : 'down')} title="Bad response" active={liked === 'down'}>
              <ThumbsDown size={13} />
            </ActionBtn>
            {/* Share */}
            <ActionBtn onClick={shareMessage} title={shared ? 'Copied to clipboard' : 'Share'} active={shared}>
              <Share size={13} />
            </ActionBtn>
            {/* Regenerate */}
            {onRegenerate && (
              <ActionBtn onClick={onRegenerate} title="Regenerate" disabled={disabled}>
                <RefreshCw size={13} />
              </ActionBtn>
            )}
            {/* More */}
            <ActionBtn onClick={() => {}} title="More">
              <MoreHorizontal size={13} />
            </ActionBtn>
          </div>
        )}
      </div>
    </div>

    {canvasOpen && message.canvasHtml && (
      <CanvasPanel
        html={message.canvasHtml}
        onClose={() => setCanvasOpen(false)}
        onRegenerate={onRegenerate}
      />
    )}
    </>
  )
}
