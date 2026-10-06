import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search, BookOpen, Bookmark, Copy, Share2, X, ArrowLeft,
  Loader2, History, Layers, BookMarked,
  RefreshCw, Grid3X3, List, Star, ChevronRight, Sparkles,
  Hash, AlignLeft, Globe, Lightbulb, RotateCcw, Check,
} from 'lucide-react'
import {
  SURAHS, fetchAyah, fetchSurah, searchQuran, fetchTafsir,
  type SurahMeta, type Ayah, type SearchResult,
} from '../lib/quranApi'

// ─── Types ────────────────────────────────────────────────────────────────────
type Panel = 'home' | 'surah-list' | 'surah-reader' | 'ayah-detail' | 'search' | 'topic' | 'compare' | 'bookmarks' | 'word-search'

interface BookmarkedAyah {
  surah: number; ayah: number; arabic: string
  translation: string; reference: string; savedAt: number
}
interface HistoryItem {
  label: string; panel: Panel; surah?: number; ayah?: number
  query?: string; timestamp: number
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const BM_KEY = 'qr_bookmarks_v2'
const HX_KEY = 'qr_history_v2'
const load = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback } catch { return fallback }
}
const save = (key: string, val: unknown) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch { /**/ } }

// ─── AI helper ────────────────────────────────────────────────────────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string

async function askAI(prompt: string, onChunk: (t: string) => void): Promise<void> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: 'You are an expert Islamic scholar and Quranic researcher. Always cite Quran verses as [Quran X:Y]. Never fabricate verses or Hadith. Be accurate, scholarly, and concise.' },
        { role: 'user', content: prompt },
      ],
      stream: true, max_tokens: 1800, temperature: 0.25,
    }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const reader = res.body?.getReader()
  if (!reader) return
  const dec = new TextDecoder()
  let acc = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of dec.decode(value, { stream: true }).split('\n')) {
      const t = line.replace(/^data: /, '').trim()
      if (!t || t === '[DONE]') continue
      try { const d = JSON.parse(t).choices?.[0]?.delta?.content ?? ''; if (d) { acc += d; onChunk(acc) } } catch { /**/ }
    }
  }
}

// ─── Render citations ─────────────────────────────────────────────────────────
function Citations({ text }: { text: string }) {
  const parts = text.split(/(\[Quran \d+:\d+\])/g)
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/\[Quran (\d+):(\d+)\]/)
        if (m) return (
          <a key={i} href={`https://quran.com/${m[1]}/${m[2]}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold mx-0.5 transition-all"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
            {p}
          </a>
        )
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// ─── Ayah block ───────────────────────────────────────────────────────────────
function AyahBlock({
  surahN, ayahN, arabic, translation, reference, compact = false,
  onResearch, onBookmark, bookmarked,
}: {
  surahN: number; ayahN: number; arabic: string; translation: string
  reference: string; compact?: boolean; onResearch?: () => void
  onBookmark?: () => void; bookmarked?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(`${arabic}\n\n${translation}\n— ${reference}`)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid var(--border)' }}>
        <a href={`https://quran.com/${surahN}/${ayahN}`} target="_blank" rel="noopener noreferrer"
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
          {reference}
        </a>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {SURAHS[surahN - 1]?.englishName} · {SURAHS[surahN - 1]?.revelationType}
        </span>
      </div>
      {/* Arabic */}
      <div className="px-5 py-5" style={{ direction: 'rtl' }}>
        <p className={`leading-loose text-center ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}
          style={{ fontFamily: "'Uthmanic','Scheherazade New','Amiri',serif", color: 'var(--text-primary)', lineHeight: 2.4 }}>
          {arabic}
          <span className="mx-2 text-base" style={{ color: 'var(--accent)' }}>﴿{ayahN}﴾</span>
        </p>
      </div>
      {/* Translation */}
      <div className="px-5 pb-2" style={{ borderTop: '1px solid var(--border)' }}>
        <p className={`leading-relaxed pt-3 ${compact ? 'text-xs' : 'text-sm'}`}
          style={{ color: 'var(--text-secondary)' }}>
          {translation}
        </p>
        <p className="text-[10px] mt-1 pb-3" style={{ color: 'var(--text-muted)' }}>— Sahih International</p>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 flex-wrap"
        style={{ borderTop: '1px solid var(--border)' }}>
        {onResearch && (
          <button onClick={onResearch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            <BookOpen size={10} /> Research
          </button>
        )}
        <button onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all"
          style={{ background: 'var(--bg-hover)', color: copied ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {onBookmark && (
          <button onClick={onBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-all"
            style={{
              background: bookmarked ? 'var(--accent-subtle)' : 'var(--bg-hover)',
              color: bookmarked ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${bookmarked ? 'var(--accent-border)' : 'var(--border)'}`,
            }}>
          <Bookmark size={10} fill={bookmarked ? 'currentColor' : 'none'} />
            {bookmarked ? 'Saved' : 'Save'}
          </button>
        )}
        <a href={`https://quran.com/${surahN}/${ayahN}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] ml-auto transition-all"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
          <Share2 size={10} /> quran.com ↗
        </a>
      </div>
    </div>
  )
}

// ─── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({ icon, label, active, badge, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-150 relative group"
      style={{
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent-border)' : 'transparent'}`,
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: 'var(--accent)' }} />}
      <span className="shrink-0" style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1 text-left text-xs">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: 'var(--accent)', color: '#fff' }}>{badge}</span>
      )}
    </button>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  )
}

// ─── AI Divider ───────────────────────────────────────────────────────────────
function AiLabel() {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <Sparkles size={11} style={{ color: '#eab308', flexShrink: 0 }} />
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#eab308' }}>AI Explanation — Not a scholarly Tafsir</span>
    </div>
  )
}

// ─── Pill filter ─────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-secondary)',
        color: active ? '#fff' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      }}>
      {label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function QuranResearch() {
  const [panel, setPanel] = useState<Panel>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile

  // Search
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Surah list
  const [surahFilter, setSurahFilter] = useState('')
  const [revFilter, setRevFilter] = useState<'All' | 'Meccan' | 'Medinan'>('All')
  const [surahGrid, setSurahGrid] = useState(true)

  // Surah reader
  const [activeSurah, setActiveSurah] = useState<SurahMeta | null>(null)
  const [surahData, setSurahData] = useState<{ arabic: string[]; english: string[] } | null>(null)
  const [surahLoading, setSurahLoading] = useState(false)
  const [surahAI, setSurahAI] = useState(''); const [surahAILoading, setSurahAILoading] = useState(false)

  // Ayah detail
  const [selAyah, setSelAyah] = useState<Ayah | null>(null)
  const [ayahLoading, setAyahLoading] = useState(false)
  const [tafsirText, setTafsirText] = useState(''); const [tafsirLoading, setTafsirLoading] = useState(false)
  const [ayahAI, setAyahAI] = useState(''); const [ayahAILoading, setAyahAILoading] = useState(false)
  const [relatedResults, setRelatedResults] = useState<SearchResult[]>([])
  const [ayahTab, setAyahTab] = useState<'tafsir' | 'ai' | 'related'>('tafsir')

  // Direct lookup
  const [lkSurah, setLkSurah] = useState(''); const [lkAyah, setLkAyah] = useState('')
  const [lkLoading, setLkLoading] = useState(false)

  // Topic
  const [topicQ, setTopicQ] = useState('')
  const [topicAI, setTopicAI] = useState(''); const [topicLoading, setTopicLoading] = useState(false)
  const [topicAyahs, setTopicAyahs] = useState<SearchResult[]>([])

  // Compare
  const [compareList, setCompareList] = useState<Ayah[]>([])

  // Word search
  const [wordQ, setWordQ] = useState('')
  const [wordResults, setWordResults] = useState<SearchResult[]>([])
  const [wordLoading, setWordLoading] = useState(false)

  // Bookmarks & History
  const [bookmarks, setBookmarks] = useState<BookmarkedAyah[]>(() => load(BM_KEY, []))
  const [history, setHistory] = useState<HistoryItem[]>(() => load(HX_KEY, []))
  const [historyOpen, setHistoryOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { save(BM_KEY, bookmarks) }, [bookmarks])
  useEffect(() => { save(HX_KEY, history) }, [history])

  const isBm = (s: number, a: number) => bookmarks.some(b => b.surah === s && b.ayah === a)

  function pushHistory(item: HistoryItem) {
    setHistory(prev => [item, ...prev.filter(h => h.label !== item.label)].slice(0, 25))
  }

  function toggleBm(a: { surahNumber: number; ayahNumber: number; arabic: string; englishTranslation: string; reference: string }) {
    if (isBm(a.surahNumber, a.ayahNumber)) {
      setBookmarks(prev => prev.filter(b => !(b.surah === a.surahNumber && b.ayah === a.ayahNumber)))
    } else {
      setBookmarks(prev => [...prev, { surah: a.surahNumber, ayah: a.ayahNumber, arabic: a.arabic, translation: a.englishTranslation, reference: a.reference, savedAt: Date.now() }])
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q?: string) => {
    const query = (q ?? searchQ).trim()
    if (!query) return
    setSearching(true); setPanel('search'); setSearchResults([])
    pushHistory({ label: query, panel: 'search', query, timestamp: Date.now() })
    try { setSearchResults(await searchQuran(query)) } finally { setSearching(false) }
  }, [searchQ])

  // ── Open Surah ─────────────────────────────────────────────────────────────
  async function openSurah(s: SurahMeta) {
    setActiveSurah(s); setSurahData(null); setSurahLoading(true)
    setSurahAI(''); setPanel('surah-reader')
    pushHistory({ label: `${s.englishName} (${s.number})`, panel: 'surah-reader', surah: s.number, timestamp: Date.now() })
    try { setSurahData(await fetchSurah(s.number)) } finally { setSurahLoading(false) }
  }

  // ── Open Ayah detail ───────────────────────────────────────────────────────
  async function openAyah(surahN: number, ayahN: number) {
    setSelAyah(null); setTafsirText(''); setAyahAI(''); setRelatedResults([])
    setAyahLoading(true); setAyahTab('tafsir'); setPanel('ayah-detail')
    pushHistory({ label: `Quran ${surahN}:${ayahN}`, panel: 'ayah-detail', surah: surahN, ayah: ayahN, timestamp: Date.now() })
    try {
      const ayah = await fetchAyah(surahN, ayahN)
      setSelAyah(ayah)
      if (ayah) {
        setTafsirLoading(true)
        fetchTafsir(surahN, ayahN).then(t => { setTafsirText(t[0]?.text ?? ''); setTafsirLoading(false) }).catch(() => setTafsirLoading(false))
        searchQuran(SURAHS[surahN - 1]?.englishNameTranslation ?? '').then(r => setRelatedResults(r.slice(0, 6))).catch(() => {})
      }
    } finally { setAyahLoading(false) }
  }

  // ── AI Ayah explanation ────────────────────────────────────────────────────
  async function explainAyah() {
    if (!selAyah || ayahAILoading) return
    setAyahAILoading(true); setAyahAI('')
    try {
      await askAI(`Provide a concise scholarly explanation of ${selAyah.reference}: "${selAyah.englishTranslation}". Include: context, main theme, key lessons, and related Quranic concepts with citations [Quran X:Y]. 3-4 paragraphs.`, t => setAyahAI(t))
    } finally { setAyahAILoading(false) }
  }

  // ── Surah AI research ──────────────────────────────────────────────────────
  async function researchSurah() {
    if (!activeSurah || surahAILoading) return
    setSurahAILoading(true); setSurahAI('')
    try {
      await askAI(`Scholarly summary of Surah ${activeSurah.englishName} (${activeSurah.arabicName}), Surah ${activeSurah.number}: main themes, important Ayahs with [Quran ${activeSurah.number}:X] citations, Meccan/Medinan context, and key concepts.`, t => setSurahAI(t))
    } finally { setSurahAILoading(false) }
  }

  // ── Topic research ─────────────────────────────────────────────────────────
  async function doTopic() {
    const q = topicQ.trim(); if (!q || topicLoading) return
    setTopicLoading(true); setTopicAI(''); setTopicAyahs([])
    pushHistory({ label: q, panel: 'topic', query: q, timestamp: Date.now() })
    try {
      const [ayahs] = await Promise.all([
        searchQuran(q),
        askAI(`Comprehensive Quranic research on "${q}": direct answer with [Quran X:Y] citations, key themes, multiple relevant verses, context. Be scholarly and accurate.`, t => setTopicAI(t)),
      ])
      setTopicAyahs(ayahs.slice(0, 8))
    } finally { setTopicLoading(false) }
  }

  // ── Word search ────────────────────────────────────────────────────────────
  async function doWordSearch() {
    const q = wordQ.trim(); if (!q || wordLoading) return
    setWordLoading(true); setWordResults([])
    try { setWordResults(await searchQuran(q)) } finally { setWordLoading(false) }
  }

  // ── Direct lookup ──────────────────────────────────────────────────────────
  async function doLookup() {
    const s = parseInt(lkSurah), a = parseInt(lkAyah)
    if (!s || !a || s < 1 || s > 114) return
    if (a < 1 || a > (SURAHS[s - 1]?.numberOfAyahs ?? 999)) return
    setLkLoading(true)
    await openAyah(s, a)
    setLkLoading(false)
  }

  const filteredSurahs = SURAHS.filter(s => {
    const q = surahFilter.toLowerCase()
    return (!q || s.englishName.toLowerCase().includes(q) || s.arabicName.includes(q) || String(s.number).includes(q))
      && (revFilter === 'All' || s.revelationType === revFilter)
  })

  const TOPICS = ['Patience (Sabr)', 'Prayer (Salah)', 'Forgiveness', 'Tawakkul', 'Jannah', 'Tawheed',
    'Knowledge', 'Gratitude (Shukr)', 'Parents', 'Justice', 'Prophet Musa', 'Day of Judgment',
    'Charity', 'Ramadan', 'Marriage', 'Death & Akhirah']

  // ─── Sidebar nav config ─────────────────────────────────────────────────────
  const NAV = [
    { panel: 'home' as Panel, icon: <Star size={14} />, label: 'Overview' },
    { panel: 'surah-list' as Panel, icon: <List size={14} />, label: 'Surah Explorer' },
    { panel: 'search' as Panel, icon: <Search size={14} />, label: 'Quran Search' },
    { panel: 'topic' as Panel, icon: <Lightbulb size={14} />, label: 'Topic Research' },
    { panel: 'word-search' as Panel, icon: <Hash size={14} />, label: 'Word Search' },
    { panel: 'compare' as Panel, icon: <Layers size={14} />, label: 'Compare Ayahs', badge: compareList.length || undefined },
    { panel: 'bookmarks' as Panel, icon: <BookMarked size={14} />, label: 'Bookmarks', badge: bookmarks.length || undefined },
  ]

  // ─── Layout shell ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      <style>{`
        .qr-scrollbar::-webkit-scrollbar { width: 4px; }
        .qr-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .qr-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        .qr-panel-enter { animation: qrFadeUp 0.22s cubic-bezier(0.34,1.2,0.64,1) both; }
        @keyframes qrFadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .qr-card { transition: border-color 0.15s, background 0.15s; }
        .qr-card:hover { border-color: var(--accent-border) !important; background: var(--bg-hover) !important; }
      `}</style>

      {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════════ */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 md:hidden bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        fixed md:relative z-30 md:z-auto
        flex flex-col shrink-0 h-full w-[220px]
        transition-transform duration-250
      `} style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
            <BookOpen size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Quran Research</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Islamic Study Library</p>
          </div>
          <button className="ml-auto md:hidden p-1" onClick={() => setSidebarOpen(false)}
            style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto qr-scrollbar px-2 py-3 space-y-0.5">
          <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Explore</p>
          {NAV.map(n => (
            <NavItem key={n.panel} icon={n.icon} label={n.label} active={panel === n.panel}
              badge={n.badge} onClick={() => { setPanel(n.panel); setSidebarOpen(false) }} />
          ))}

          {/* History */}
          {history.length > 0 && (
            <div className="pt-4">
              <button onClick={() => setHistoryOpen(v => !v)}
                className="flex items-center justify-between w-full px-3 pb-1">
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Recent</p>
                <History size={10} style={{ color: 'var(--text-muted)' }} />
              </button>
              {historyOpen && history.slice(0, 8).map((h, i) => (
                <button key={i} onClick={() => {
                  setSidebarOpen(false)
                  if (h.panel === 'ayah-detail' && h.surah && h.ayah) openAyah(h.surah, h.ayah)
                  else if (h.panel === 'surah-reader' && h.surah) openSurah(SURAHS[h.surah - 1])
                  else if (h.panel === 'search' && h.query) { setSearchQ(h.query); doSearch(h.query) }
                  else if (h.panel === 'topic' && h.query) { setTopicQ(h.query); setPanel('topic') }
                  else setPanel(h.panel)
                }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg transition-all text-left"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)', opacity: 0.6 }} />
                  <span className="text-[11px] truncate">{h.label}</span>
                </button>
              ))}
              {historyOpen && history.length > 0 && (
                <button onClick={() => { setHistory([]); setHistoryOpen(false) }}
                  className="flex items-center gap-1.5 w-full px-3 py-1 mt-1 text-[10px] transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <RotateCcw size={9} /> Clear history
                </button>
              )}
            </div>
          )}
        </nav>

        {/* Stats footer */}
        <div className="px-3 py-3 shrink-0 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Bookmarks</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>{bookmarks.length}</span>
          </div>
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Compare</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>{compareList.length}/4</span>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══════════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {/* Mobile menu */}
          <button onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <List size={14} />
          </button>

          {/* Search bar */}
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
            <Search size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search Quran — Surah, Ayah, topic, Arabic, English…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }} />
            {searchQ && <button onClick={() => setSearchQ('')} style={{ color: 'var(--text-muted)' }}><X size={12} /></button>}
          </div>
          <button onClick={() => doSearch()}
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Search
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto qr-scrollbar">

          {/* ──────────────────── HOME / OVERVIEW ──────────────────── */}
          {panel === 'home' && (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 qr-panel-enter">

              {/* Hero banner */}
              <div className="relative rounded-2xl overflow-hidden px-6 py-7"
                style={{ background: 'linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg-secondary) 100%)', border: '1px solid var(--accent-border)' }}>
                <div className="absolute right-4 top-4 opacity-10 text-7xl select-none" style={{ fontFamily: 'serif' }}>ق</div>
                <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Quran Research Library</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Explore, study and research the Holy Quran with verified sources and AI-assisted insights.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    { label: '114 Surahs', p: 'surah-list' as Panel },
                    { label: '6,236 Ayahs', p: 'search' as Panel },
                    { label: 'Tafsir Ibn Kathir', p: 'ayah-detail' as Panel },
                    { label: 'AI Research', p: 'topic' as Panel },
                  ].map(b => (
                    <button key={b.label} onClick={() => setPanel(b.p)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)' }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bismillah */}
              <div className="text-center py-3 rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-2xl" style={{ fontFamily: "'Amiri',serif", color: 'var(--accent)', direction: 'rtl', lineHeight: 2 }}>
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>In the name of Allah, the Most Gracious, the Most Merciful</p>
              </div>

              {/* Quick tools */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Quick Tools</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { icon: <List size={16} />, label: 'Surah Explorer', sub: '114 Chapters', p: 'surah-list' as Panel, c: 'var(--accent)' },
                    { icon: <Search size={16} />, label: 'Quran Search', sub: 'Arabic, English, topic', p: 'search' as Panel, c: '#3b82f6' },
                    { icon: <Lightbulb size={16} />, label: 'Topic Research', sub: 'AI-powered', p: 'topic' as Panel, c: '#f59e0b' },
                    { icon: <Hash size={16} />, label: 'Word Search', sub: 'Find any word', p: 'word-search' as Panel, c: '#10b981' },
                    { icon: <Layers size={16} />, label: 'Compare Ayahs', sub: 'Up to 4 Ayahs', p: 'compare' as Panel, c: '#8b5cf6' },
                    { icon: <BookMarked size={16} />, label: 'My Bookmarks', sub: `${bookmarks.length} saved`, p: 'bookmarks' as Panel, c: '#ef4444' },
                  ].map(t => (
                    <button key={t.label} onClick={() => setPanel(t.p)}
                      className="flex flex-col gap-2 p-4 rounded-2xl text-left transition-all active:scale-95"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = t.c + '44'; e.currentTarget.style.background = t.c + '0d' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: t.c + '1a', color: t.c }}>
                        {t.icon}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ayah Lookup */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Direct Ayah Lookup</p>
                <div className="flex gap-2 flex-wrap">
                  <select value={lkSurah} onChange={e => setLkSurah(e.target.value)}
                    className="flex-1 min-w-[130px] px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">Select Surah…</option>
                    {SURAHS.map(s => <option key={s.number} value={s.number}>{s.number}. {s.englishName} ({s.numberOfAyahs} Ayahs)</option>)}
                  </select>
                  <input type="number" min={1} value={lkAyah} onChange={e => setLkAyah(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLookup()}
                    placeholder="Ayah number"
                    className="w-28 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <button onClick={doLookup} disabled={lkLoading || !lkSurah || !lkAyah}
                    className="px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {lkLoading ? <Loader2 size={14} className="animate-spin" /> : 'Go'}
                  </button>
                </div>
              </div>

              {/* Featured Surahs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Featured Surahs</p>
                  <button onClick={() => setPanel('surah-list')}
                    className="text-xs flex items-center gap-1 transition-all"
                    style={{ color: 'var(--accent)' }}>
                    All 114 <ChevronRight size={11} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[1, 18, 36, 55, 67, 112].map(n => {
                    const s = SURAHS[n - 1]
                    return (
                      <button key={n} onClick={() => openSurah(s)}
                        className="qr-card p-3 rounded-xl text-left"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{n}</span>
                          <span className="text-base" style={{ fontFamily: 'Amiri,serif', color: 'var(--accent)', direction: 'rtl' }}>{s.arabicName}</span>
                        </div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.englishName}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.numberOfAyahs} Ayahs · {s.revelationType}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────── SURAH LIST ──────────────────── */}
          {panel === 'surah-list' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 qr-panel-enter">
              <SectionHead title="Surah Explorer" subtitle="Browse all 114 chapters of the Holy Quran" />

              {/* Filters row */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <Search size={12} style={{ color: 'var(--text-muted)' }} />
                  <input value={surahFilter} onChange={e => setSurahFilter(e.target.value)}
                    placeholder="Filter by name or number…"
                    className="flex-1 bg-transparent outline-none text-xs"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
                {(['All', 'Meccan', 'Medinan'] as const).map(r => (
                  <Pill key={r} label={r} active={revFilter === r} onClick={() => setRevFilter(r)} />
                ))}
                <button onClick={() => setSurahGrid(!surahGrid)}
                  className="p-2 rounded-xl transition-all"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {surahGrid ? <List size={13} /> : <Grid3X3 size={13} />}
                </button>
              </div>

              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{filteredSurahs.length} Surahs</p>

              {/* Grid view */}
              {surahGrid ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredSurahs.map(s => (
                    <button key={s.number} onClick={() => openSurah(s)}
                      className="qr-card p-3.5 rounded-xl text-left"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{s.number}</span>
                        <span className="text-lg leading-none" style={{ fontFamily: 'Amiri,serif', color: 'var(--accent)', direction: 'rtl' }}>{s.arabicName}</span>
                      </div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.englishName}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.englishNameTranslation}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {s.numberOfAyahs} Ayahs
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: s.revelationType === 'Meccan' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                            color: s.revelationType === 'Meccan' ? '#f59e0b' : '#3b82f6',
                          }}>
                          {s.revelationType}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                // List view
                <div className="space-y-1.5">
                  {filteredSurahs.map(s => (
                    <button key={s.number} onClick={() => openSurah(s)}
                      className="qr-card flex items-center gap-3 w-full p-3.5 rounded-xl text-left"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{s.number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.englishName}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.englishNameTranslation} · {s.numberOfAyahs} Ayahs · {s.revelationType}</p>
                      </div>
                      <p className="text-xl shrink-0" style={{ fontFamily: 'Amiri,serif', color: 'var(--accent)', direction: 'rtl' }}>{s.arabicName}</p>
                      <ChevronRight size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────── SURAH READER ──────────────────── */}
          {panel === 'surah-reader' && activeSurah && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 qr-panel-enter">
              {/* Back */}
              <button onClick={() => setPanel('surah-list')}
                className="flex items-center gap-1.5 text-xs transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <ArrowLeft size={13} /> Back to Surahs
              </button>

              {/* Header card */}
              <div className="rounded-2xl p-5 text-center relative overflow-hidden"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
                <div className="absolute inset-0 opacity-5 flex items-center justify-center text-[160px] select-none" style={{ fontFamily: 'serif', color: 'var(--accent)' }}>
                  {activeSurah.arabicName[0]}
                </div>
                <p className="relative text-4xl mb-2" style={{ fontFamily: 'Amiri,serif', color: 'var(--accent)', direction: 'rtl', lineHeight: 1.5 }}>
                  {activeSurah.arabicName}
                </p>
                <h2 className="relative text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{activeSurah.englishName}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{activeSurah.englishNameTranslation}</p>
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {[
                    { label: `Surah ${activeSurah.number}`, c: 'var(--accent)' },
                    { label: `${activeSurah.numberOfAyahs} Ayahs`, c: 'var(--text-muted)' },
                    { label: activeSurah.revelationType, c: activeSurah.revelationType === 'Meccan' ? '#f59e0b' : '#3b82f6' },
                  ].map(b => (
                    <span key={b.label} className="text-xs px-3 py-1 rounded-full"
                      style={{ background: b.c + '18', color: b.c, border: `1px solid ${b.c}33` }}>{b.label}</span>
                  ))}
                </div>
                <p className="relative text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{activeSurah.description}</p>
              </div>

              {/* AI Research accordion */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <button onClick={surahAI || surahAILoading ? () => setSurahAI('') : researchSurah}
                  className="flex items-center justify-between w-full px-4 py-3 transition-all"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Surah Research</span>
                  </div>
                  {surahAILoading ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                      {surahAI ? 'Hide' : 'Generate'}
                    </span>}
                </button>
                {surahAI && (
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <AiLabel />
                    <div className="text-sm leading-relaxed space-y-2 mt-2" style={{ color: 'var(--text-secondary)' }}>
                      {surahAI.split('\n').filter(Boolean).map((p, i) => <p key={i}><Citations text={p} /></p>)}
                    </div>
                  </div>
                )}
              </div>

              {/* Bismillah */}
              {activeSurah.number !== 9 && (
                <p className="text-center py-3 text-2xl" style={{ fontFamily: 'Amiri,serif', color: 'var(--accent)', direction: 'rtl', lineHeight: 2 }}>
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </p>
              )}

              {/* Ayahs */}
              {surahLoading ? (
                <div className="flex items-center justify-center gap-2 py-16">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Loading Surah…</span>
                </div>
              ) : surahData ? (
                <div className="space-y-3">
                  {surahData.arabic.map((ar, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between px-4 py-2"
                        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                          {activeSurah.number}:{i + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openAyah(activeSurah.number, i + 1)} title="Research"
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                            <BookOpen size={11} />
                          </button>
                          <button onClick={() => {
                            const bm = { surah: activeSurah.number, ayah: i + 1, arabic: ar, translation: surahData.english[i] ?? '', reference: `Quran ${activeSurah.number}:${i + 1}`, savedAt: Date.now() }
                            isBm(activeSurah.number, i + 1)
                              ? setBookmarks(prev => prev.filter(b => !(b.surah === activeSurah.number && b.ayah === i + 1)))
                              : setBookmarks(prev => [...prev, bm])
                          }} title="Bookmark"
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: isBm(activeSurah.number, i + 1) ? 'var(--accent)' : 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <Bookmark size={11} fill={isBm(activeSurah.number, i + 1) ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>
                      <div className="px-5 py-4 text-center" style={{ direction: 'rtl' }}>
                        <p className="text-xl leading-loose" style={{ fontFamily: 'Uthmanic,Scheherazade New,Amiri,serif', color: 'var(--text-primary)', lineHeight: 2.3 }}>
                          {ar}<span className="mx-2 text-sm" style={{ color: 'var(--accent)' }}>﴿{i + 1}﴾</span>
                        </p>
                      </div>
                      <div className="px-5 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                        <p className="text-sm leading-relaxed pt-3" style={{ color: 'var(--text-secondary)' }}>{surahData.english[i]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Failed to load Surah. Check your connection.</p>
                  <button onClick={() => openSurah(activeSurah)}
                    className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                    <RefreshCw size={13} /> Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────── AYAH DETAIL ──────────────────── */}
          {panel === 'ayah-detail' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 qr-panel-enter">
              <button onClick={() => setPanel('home')}
                className="flex items-center gap-1.5 text-xs transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <ArrowLeft size={13} /> Back
              </button>

              {ayahLoading ? (
                <div className="flex items-center justify-center gap-2 py-20">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Loading Ayah…</span>
                </div>
              ) : selAyah ? (
                <>
                  <AyahBlock
                    surahN={selAyah.surahNumber} ayahN={selAyah.ayahNumber}
                    arabic={selAyah.arabic} translation={selAyah.englishTranslation} reference={selAyah.reference}
                    onBookmark={() => toggleBm(selAyah)} bookmarked={isBm(selAyah.surahNumber, selAyah.ayahNumber)}
                  />

                  {/* Quick actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => openSurah(SURAHS[selAyah.surahNumber - 1])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <BookOpen size={11} /> Open Full Surah
                    </button>
                    <button onClick={() => {
                      if (!compareList.find(a => a.surahNumber === selAyah.surahNumber && a.ayahNumber === selAyah.ayahNumber) && compareList.length < 4) {
                        setCompareList(prev => [...prev, selAyah])
                      }
                    }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <Layers size={11} /> Add to Compare
                    </button>
                  </div>

                  {/* Tab bar */}
                  <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    {(['tafsir', 'ai', 'related'] as const).map(t => (
                      <button key={t} onClick={() => { setAyahTab(t); if (t === 'ai' && !ayahAI && !ayahAILoading) explainAyah() }}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all"
                        style={{
                          background: ayahTab === t ? 'var(--accent)' : 'transparent',
                          color: ayahTab === t ? '#fff' : 'var(--text-muted)',
                        }}>
                        {t === 'tafsir' ? 'Tafsir' : t === 'ai' ? '✦ AI Explanation' : 'Related Ayahs'}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', minHeight: 120 }}>
                    {ayahTab === 'tafsir' && (
                      tafsirLoading ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Tafsir…</span>
                        </div>
                      ) : tafsirText ? (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                              style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
                              Tafsir Ibn Kathir
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ibn Kathir (rahimahullah)</span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{tafsirText}</p>
                          <a href={`https://quran.com/${selAyah.surahNumber}/${selAyah.ayahNumber}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs mt-3 transition-all"
                            style={{ color: 'var(--accent)' }}>
                            <Globe size={11} /> Read full Tafsir on quran.com ↗
                          </a>
                        </>
                      ) : (
                        <div>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tafsir not available from current source.</p>
                          <a href={`https://quran.com/${selAyah.surahNumber}/${selAyah.ayahNumber}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs mt-2 inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                            <Globe size={11} /> View on quran.com ↗
                          </a>
                        </div>
                      )
                    )}
                    {ayahTab === 'ai' && (
                      ayahAILoading && !ayahAI ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Generating explanation…</span>
                        </div>
                      ) : ayahAI ? (
                        <>
                          <AiLabel />
                          <div className="text-sm leading-relaxed space-y-2 mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {ayahAI.split('\n').filter(Boolean).map((p, i) => <p key={i}><Citations text={p} /></p>)}
                          </div>
                        </>
                      ) : (
                        <button onClick={explainAyah}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                          style={{ background: 'var(--accent)', color: '#fff' }}>
                          <Sparkles size={13} /> Generate AI Explanation
                        </button>
                      )
                    )}
                    {ayahTab === 'related' && (
                      relatedResults.length > 0 ? (
                        <div className="space-y-2">
                          {relatedResults.map((r, i) => (
                            <button key={i} onClick={() => openAyah(r.surahNumber, r.ayahNumber)}
                              className="qr-card flex items-start gap-3 w-full p-3 rounded-xl text-left"
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5"
                                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{r.reference}</span>
                              <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                                {r.translation.slice(0, 120)}{r.translation.length > 120 ? '…' : ''}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading related Ayahs…</p>
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Failed to load Ayah. Please try again.</p>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────── SEARCH RESULTS ──────────────────── */}
          {panel === 'search' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 qr-panel-enter">
              <SectionHead title="Quran Search" subtitle="Search by keyword, topic, Arabic text or Ayah reference" />
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <Search size={13} style={{ color: 'var(--text-muted)' }} />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doSearch()}
                    placeholder="Search…" autoFocus
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
                <button onClick={() => doSearch()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}>Search</button>
              </div>
              {/* Suggested */}
              <div className="flex flex-wrap gap-1.5">
                {['Patience', 'Prayer', 'Forgiveness', 'Tawakkul', 'Jannah', 'Zakat', 'Musa', 'Ibrahim'].map(s => (
                  <button key={s} onClick={() => { setSearchQ(s); doSearch(s) }}
                    className="px-2.5 py-1 rounded-full text-[11px] transition-all"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    {s}
                  </button>
                ))}
              </div>

              {searching ? (
                <div className="flex items-center justify-center gap-2 py-14">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Searching Quran…</span>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{searchResults.length} results</p>
                  <div className="space-y-3">
                    {searchResults.map((r, i) => (
                      <AyahBlock key={i} compact surahN={r.surahNumber} ayahN={r.ayahNumber}
                        arabic={r.arabic} translation={r.translation} reference={r.reference}
                        onResearch={() => openAyah(r.surahNumber, r.ayahNumber)}
                        onBookmark={() => toggleBm({ surahNumber: r.surahNumber, ayahNumber: r.ayahNumber, arabic: r.arabic, englishTranslation: r.translation, reference: r.reference })}
                        bookmarked={isBm(r.surahNumber, r.ayahNumber)}
                      />
                    ))}
                  </div>
                </>
              ) : searchQ && !searching ? (
                <div className="text-center py-12">
                  <Search size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results for "{searchQ}"</p>
                </div>
              ) : null}
            </div>
          )}

          {/* ──────────────────── TOPIC RESEARCH ──────────────────── */}
          {panel === 'topic' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 qr-panel-enter">
              <SectionHead title="Topic Research" subtitle="AI-powered Quranic research on any Islamic topic" />

              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                  <input value={topicQ} onChange={e => setTopicQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doTopic()}
                    placeholder="e.g. What does the Quran say about patience?"
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  <button onClick={doTopic} disabled={topicLoading || !topicQ.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {topicLoading ? <Loader2 size={14} className="animate-spin" /> : 'Research'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map(t => (
                    <button key={t} onClick={() => { setTopicQ(t); doTopic() }}
                      className="px-2.5 py-1 rounded-full text-[11px] transition-all"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {topicLoading && !topicAI && (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Researching the Quran…</span>
                </div>
              )}

              {topicAI && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
                    <Sparkles size={13} style={{ color: 'var(--accent)' }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{topicQ}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                      AI Explanation
                    </span>
                  </div>
                  <div className="p-4 text-sm leading-relaxed space-y-2" style={{ color: 'var(--text-secondary)' }}>
                    {topicAI.split('\n').filter(Boolean).map((p, i) => <p key={i}><Citations text={p} /></p>)}
                  </div>
                </div>
              )}

              {topicAyahs.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Relevant Ayahs</p>
                  <div className="space-y-3">
                    {topicAyahs.map((r, i) => (
                      <AyahBlock key={i} compact surahN={r.surahNumber} ayahN={r.ayahNumber}
                        arabic={r.arabic} translation={r.translation} reference={r.reference}
                        onResearch={() => openAyah(r.surahNumber, r.ayahNumber)}
                        onBookmark={() => toggleBm({ surahNumber: r.surahNumber, ayahNumber: r.ayahNumber, arabic: r.arabic, englishTranslation: r.translation, reference: r.reference })}
                        bookmarked={isBm(r.surahNumber, r.ayahNumber)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────────────── WORD SEARCH ──────────────────── */}
          {panel === 'word-search' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-5 qr-panel-enter">
              <SectionHead title="Word Search" subtitle="Find every occurrence of a word or phrase in the Quran" />
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                  <input value={wordQ} onChange={e => setWordQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doWordSearch()}
                    placeholder="e.g. صبر  or  mercy  or  sabr"
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)', textAlign: 'right', direction: 'auto' as any }} />
                  <button onClick={doWordSearch} disabled={wordLoading || !wordQ.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {wordLoading ? <Loader2 size={14} className="animate-spin" /> : 'Find'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['صبر', 'رحمة', 'الله', 'نور', 'Mercy', 'Light', 'Peace', 'Truth'].map(w => (
                    <button key={w} onClick={() => { setWordQ(w); doWordSearch() }}
                      className="px-2.5 py-1 rounded-full text-[11px] transition-all"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {wordLoading ? (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Searching…</span>
                </div>
              ) : wordResults.length > 0 ? (
                <>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{wordResults.length} occurrences found for "{wordQ}"</p>
                  <div className="space-y-3">
                    {wordResults.map((r, i) => (
                      <AyahBlock key={i} compact surahN={r.surahNumber} ayahN={r.ayahNumber}
                        arabic={r.arabic} translation={r.translation} reference={r.reference}
                        onResearch={() => openAyah(r.surahNumber, r.ayahNumber)}
                        onBookmark={() => toggleBm({ surahNumber: r.surahNumber, ayahNumber: r.ayahNumber, arabic: r.arabic, englishTranslation: r.translation, reference: r.reference })}
                        bookmarked={isBm(r.surahNumber, r.ayahNumber)}
                      />
                    ))}
                  </div>
                </>
              ) : wordQ && !wordLoading ? (
                <div className="text-center py-10">
                  <AlignLeft size={28} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results found for "{wordQ}"</p>
                </div>
              ) : null}
            </div>
          )}

          {/* ──────────────────── COMPARE ──────────────────── */}
          {panel === 'compare' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 qr-panel-enter">
              <div className="flex items-center justify-between">
                <SectionHead title="Compare Ayahs" subtitle="Side-by-side comparison of up to 4 Ayahs" />
                {compareList.length > 0 && (
                  <button onClick={() => setCompareList([])}
                    className="text-xs px-3 py-1.5 rounded-lg mb-5"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Clear all
                  </button>
                )}
              </div>

              {compareList.length === 0 ? (
                <div className="rounded-2xl p-8 text-center"
                  style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)' }}>
                  <Layers size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No Ayahs selected</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Open any Ayah and click "Add to Compare"</p>
                  <button onClick={() => setPanel('surah-list')}
                    className="mt-4 px-4 py-2 rounded-xl text-sm"
                    style={{ background: 'var(--accent)', color: '#fff' }}>Browse Surahs</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {compareList.map((a, i) => (
                    <div key={i} className="relative">
                      <button onClick={() => setCompareList(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg transition-all"
                        style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                        <X size={12} />
                      </button>
                      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--accent-border)' }}>
                        <div className="flex items-center gap-2 px-4 py-2.5"
                          style={{ background: 'var(--accent-subtle)', borderBottom: '1px solid var(--accent-border)' }}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                            style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                          <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{a.reference}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{SURAHS[a.surahNumber - 1]?.englishName}</span>
                        </div>
                        <div className="px-5 py-4 text-center" style={{ background: 'var(--bg-secondary)', direction: 'rtl' }}>
                          <p className="text-xl leading-loose" style={{ fontFamily: 'Uthmanic,Scheherazade New,Amiri,serif', color: 'var(--text-primary)', lineHeight: 2.3 }}>
                            {a.arabic}
                          </p>
                        </div>
                        <div className="px-5 pb-4" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                          <p className="text-sm leading-relaxed pt-3" style={{ color: 'var(--text-secondary)' }}>{a.englishTranslation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {compareList.length < 4 && (
                    <button onClick={() => setPanel('surah-list')}
                      className="w-full py-4 rounded-2xl text-sm transition-all"
                      style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                      + Add Ayah ({compareList.length}/4)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────── BOOKMARKS ──────────────────── */}
          {panel === 'bookmarks' && (
            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 qr-panel-enter">
              <div className="flex items-center justify-between">
                <SectionHead title="Bookmarks" subtitle={`${bookmarks.length} saved Ayahs`} />
                {bookmarks.length > 0 && (
                  <button onClick={() => setBookmarks([])}
                    className="text-xs px-3 py-1.5 rounded-lg mb-5"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Clear all
                  </button>
                )}
              </div>
              {bookmarks.length === 0 ? (
                <div className="rounded-2xl p-8 text-center"
                  style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)' }}>
                  <Bookmark size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No bookmarks yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Tap the bookmark icon on any Ayah to save it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...bookmarks].reverse().map((b, i) => (
                    <AyahBlock key={i} compact surahN={b.surah} ayahN={b.ayah}
                      arabic={b.arabic} translation={b.translation} reference={b.reference}
                      onResearch={() => openAyah(b.surah, b.ayah)}
                      onBookmark={() => setBookmarks(prev => prev.filter(bm => !(bm.surah === b.surah && bm.ayah === b.ayah)))}
                      bookmarked={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
