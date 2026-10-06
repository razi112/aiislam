import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, BookOpen, ChevronRight, ChevronDown, Star, Copy, Share2,
  Bookmark, X, ArrowLeft, Loader2, History, Layers,
  BookMarked, MessageSquare, RefreshCw, List, Grid3X3,
} from 'lucide-react'
import {
  SURAHS, fetchAyah, fetchSurah, searchQuran, fetchTafsir,
  type SurahMeta, type Ayah, type SearchResult, type TafsirEntry,
} from '../lib/quranApi'

// ── Types ─────────────────────────────────────────────────────────────────────
type View = 'home' | 'surah-list' | 'surah-reader' | 'ayah-detail' | 'search-results' | 'topic-research' | 'compare' | 'bookmarks'

interface BookmarkedAyah {
  surah: number
  ayah: number
  arabic: string
  translation: string
  reference: string
  collection?: string
  savedAt: number
}

interface ResearchHistory {
  query: string
  type: 'search' | 'topic' | 'ayah'
  timestamp: number
}

// ── Local storage ─────────────────────────────────────────────────────────────
const BM_KEY = 'quran_bookmarks'
const HIST_KEY = 'quran_history'

function loadBookmarks(): BookmarkedAyah[] {
  try { return JSON.parse(localStorage.getItem(BM_KEY) ?? '[]') } catch { return [] }
}
function saveBookmarks(bms: BookmarkedAyah[]) {
  try { localStorage.setItem(BM_KEY, JSON.stringify(bms)) } catch { /* ignore */ }
}
function loadHistory(): ResearchHistory[] {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]') } catch { return [] }
}
function addToHistory(h: ResearchHistory) {
  const existing = loadHistory().filter(e => e.query !== h.query)
  saveHistory([h, ...existing].slice(0, 20))
}
function saveHistory(hs: ResearchHistory[]) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(hs)) } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string

async function askAI(prompt: string, onChunk?: (t: string) => void): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: `You are an Islamic research assistant specializing in Quranic studies.
Always cite exact Quran references in the format [Quran SURAH:AYAH].
Never fabricate Quranic verses or hadith.
If you cannot verify a reference, say so.
Be concise, accurate, and scholarly.`,
        },
        { role: 'user', content: prompt },
      ],
      stream: !!onChunk,
      max_tokens: 1500,
      temperature: 0.3,
    }),
  })

  if (!res.ok) throw new Error(`AI request failed (${res.status})`)

  if (!onChunk) {
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  // Streaming
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No body')
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value, { stream: true }).split('\n')) {
      const t = line.replace(/^data: /, '').trim()
      if (!t || t === '[DONE]') continue
      try {
        const delta = JSON.parse(t).choices?.[0]?.delta?.content ?? ''
        if (delta) { full += delta; onChunk(full) }
      } catch { /* skip */ }
    }
  }
  return full
}

// Render citation tags as links
function renderWithCitations(text: string) {
  const parts = text.split(/(\[Quran \d+:\d+\])/g)
  return parts.map((part, i) => {
    const m = part.match(/\[Quran (\d+):(\d+)\]/)
    if (m) {
      const url = `https://quran.com/${m[1]}/${m[2]}`
      return (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold transition-all"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SurahCard({ surah, onClick }: { surah: SurahMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl transition-all duration-150 group active:scale-[0.98]"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}
    >
      <div className="flex items-start gap-3">
        {/* Number badge */}
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
          {surah.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{surah.englishName}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{surah.englishNameTranslation}</p>
            </div>
            <p className="text-lg font-arabic shrink-0" style={{ color: 'var(--accent)', fontFamily: "'Amiri', serif", direction: 'rtl' }}>
              {surah.arabicName}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {surah.numberOfAyahs} Ayahs
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: surah.revelationType === 'Meccan' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                color: surah.revelationType === 'Meccan' ? '#f59e0b' : '#3b82f6',
                border: `1px solid ${surah.revelationType === 'Meccan' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`,
              }}>
              {surah.revelationType}
            </span>
          </div>
          <p className="text-[11px] mt-1.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{surah.description}</p>
        </div>
        <ChevronRight size={14} className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} />
      </div>
    </button>
  )
}

function AyahCard({
  surahNumber, ayahNumber, arabic, translation, reference,
  onOpen, onBookmark, isBookmarked,
}: {
  surahNumber: number; ayahNumber: number; arabic: string; translation: string; reference: string;
  onOpen?: () => void; onBookmark?: () => void; isBookmarked?: boolean;
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(`${arabic}\n\n${translation}\n\n— ${reference}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      {/* Reference header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
          {reference}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {SURAHS[surahNumber - 1]?.englishName ?? ''}
        </span>
      </div>
      {/* Arabic text */}
      <div className="px-5 py-5 text-center" style={{ direction: 'rtl' }}>
        <p className="leading-loose text-xl sm:text-2xl" style={{
          fontFamily: "'Uthmanic', 'Scheherazade New', 'Amiri', serif",
          color: 'var(--text-primary)',
          lineHeight: '2.2',
        }}>
          {arabic}
          <span className="mr-2 text-base" style={{ color: 'var(--accent)' }}>
            ﴿{ayahNumber}﴾
          </span>
        </p>
      </div>
      {/* Translation */}
      <div className="px-5 pb-4" style={{ direction: 'ltr' }}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {translation}
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>— Sahih International</p>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--border)' }}>
        {onOpen && (
          <button onClick={onOpen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            <BookOpen size={11} /> Research
          </button>
        )}
        <button onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ background: 'var(--bg-hover)', color: copied ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
        </button>
        {onBookmark && (
          <button onClick={onBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              background: isBookmarked ? 'var(--accent-subtle)' : 'var(--bg-hover)',
              color: isBookmarked ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${isBookmarked ? 'var(--accent-border)' : 'var(--border)'}`,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = isBookmarked ? 'var(--accent-border)' : 'var(--border)'}>
            <Bookmark size={11} fill={isBookmarked ? 'currentColor' : 'none'} />
            {isBookmarked ? 'Saved' : 'Save'}
          </button>
        )}
        <a href={`https://quran.com/${surahNumber}/${ayahNumber}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ml-auto"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
          <Share2 size={11} /> quran.com
        </a>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QuranResearch() {
  const [view, setView] = useState<View>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [surahFilter, setSurahFilter] = useState('')
  const [revelationFilter, setRevelationFilter] = useState<'All' | 'Meccan' | 'Medinan'>('All')
  const [surahViewGrid, setSurahViewGrid] = useState(false)

  // Selected Surah reader
  const [activeSurah, setActiveSurah] = useState<SurahMeta | null>(null)
  const [surahContent, setSurahContent] = useState<{ arabic: string[]; english: string[] } | null>(null)
  const [surahLoading, setSurahLoading] = useState(false)
  const [surahResearch, setSurahResearch] = useState('')
  const [surahResearching, setSurahResearching] = useState(false)

  // Ayah detail
  const [selectedAyah, setSelectedAyah] = useState<Ayah | null>(null)
  const [ayahLoading, setAyahLoading] = useState(false)
  const [tafsir, setTafsir] = useState<TafsirEntry[]>([])
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [aiExplanation, setAiExplanation] = useState('')
  const [aiExplaining, setAiExplaining] = useState(false)
  const [relatedAyahs, setRelatedAyahs] = useState<SearchResult[]>([])

  // Direct Ayah lookup
  const [lookupSurah, setLookupSurah] = useState('')
  const [lookupAyah, setLookupAyah] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  // Topic research
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResult, setTopicResult] = useState('')
  const [topicSearching, setTopicSearching] = useState(false)
  const [topicAyahs, setTopicAyahs] = useState<SearchResult[]>([])

  // Compare
  const [compareList, setCompareList] = useState<Ayah[]>([])

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<BookmarkedAyah[]>(loadBookmarks)
  const [researchHistory, setResearchHistory] = useState<ResearchHistory[]>(loadHistory)
  const [historyOpen, setHistoryOpen] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync bookmarks to storage
  useEffect(() => { saveBookmarks(bookmarks) }, [bookmarks])

  function isBookmarked(s: number, a: number) {
    return bookmarks.some(b => b.surah === s && b.ayah === a)
  }

  function toggleBookmark(ayah: Ayah) {
    if (isBookmarked(ayah.surahNumber, ayah.ayahNumber)) {
      setBookmarks(prev => prev.filter(b => !(b.surah === ayah.surahNumber && b.ayah === ayah.ayahNumber)))
    } else {
      setBookmarks(prev => [...prev, {
        surah: ayah.surahNumber, ayah: ayah.ayahNumber,
        arabic: ayah.arabic, translation: ayah.englishTranslation,
        reference: ayah.reference, savedAt: Date.now(),
      }])
    }
  }

  // Search the Quran
  const handleSearch = useCallback(async (q?: string) => {
    const query = (q ?? searchQuery).trim()
    if (!query) return
    setSearching(true)
    setView('search-results')
    addToHistory({ query, type: 'search', timestamp: Date.now() })
    setResearchHistory(loadHistory())
    try {
      const results = await searchQuran(query)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  // Open a surah
  async function openSurah(surah: SurahMeta) {
    setActiveSurah(surah)
    setSurahContent(null)
    setSurahLoading(true)
    setSurahResearch('')
    setView('surah-reader')
    try {
      const content = await fetchSurah(surah.number)
      setSurahContent(content)
    } catch {
      setSurahContent(null)
    } finally {
      setSurahLoading(false)
    }
  }

  // Open an ayah for detail
  async function openAyahDetail(surahNum: number, ayahNum: number) {
    setSelectedAyah(null)
    setTafsir([])
    setAiExplanation('')
    setRelatedAyahs([])
    setAyahLoading(true)
    setView('ayah-detail')
    addToHistory({ query: `Quran ${surahNum}:${ayahNum}`, type: 'ayah', timestamp: Date.now() })
    setResearchHistory(loadHistory())

    try {
      const ayah = await fetchAyah(surahNum, ayahNum)
      setSelectedAyah(ayah)

      if (ayah) {
        // Fetch tafsir in background
        setTafsirLoading(true)
        fetchTafsir(surahNum, ayahNum).then(t => { setTafsir(t); setTafsirLoading(false) }).catch(() => setTafsirLoading(false))

        // Search for related ayahs
        const surahMeta = SURAHS[surahNum - 1]
        searchQuran(surahMeta?.englishNameTranslation ?? '').then(r => setRelatedAyahs(r.slice(0, 5))).catch(() => {})
      }
    } finally {
      setAyahLoading(false)
    }
  }

  async function getAIExplanation() {
    if (!selectedAyah || aiExplaining) return
    setAiExplaining(true)
    setAiExplanation('')
    try {
      await askAI(
        `Provide a brief scholarly explanation of ${selectedAyah.reference}:
"${selectedAyah.englishTranslation}"

Include: the context of this verse, its main theme, and related Quranic concepts. Cite other related verses using [Quran X:Y] format. Keep it concise (3-4 paragraphs).`,
        (t) => setAiExplanation(t)
      )
    } catch {
      setAiExplanation('Unable to generate explanation at this time.')
    } finally {
      setAiExplaining(false)
    }
  }

  // Direct lookup
  async function handleLookup() {
    const s = parseInt(lookupSurah)
    const a = parseInt(lookupAyah)
    if (!s || !a || s < 1 || s > 114) return
    const meta = SURAHS[s - 1]
    if (!meta || a < 1 || a > meta.numberOfAyahs) return
    setLookupLoading(true)
    await openAyahDetail(s, a)
    setLookupLoading(false)
  }

  // Topic research
  async function handleTopicResearch() {
    const q = topicQuery.trim()
    if (!q || topicSearching) return
    setTopicSearching(true)
    setTopicResult('')
    setTopicAyahs([])
    setView('topic-research')
    addToHistory({ query: q, type: 'topic', timestamp: Date.now() })
    setResearchHistory(loadHistory())

    try {
      // Run AI and search in parallel
      const [aiResult, ayahResults] = await Promise.all([
        askAI(`Research question: "${q}"
Provide a comprehensive Quranic research response including:
1. Direct answer with relevant Ayah citations [Quran X:Y]
2. Key themes from the Quran on this topic
3. Multiple relevant verses (cite each one)
4. Brief contextual notes
Be scholarly and accurate. Do not fabricate verses.`),
        searchQuran(q),
      ])
      setTopicResult(aiResult)
      setTopicAyahs(ayahResults.slice(0, 8))
    } catch {
      setTopicResult('Unable to research this topic at this time. Please try again.')
    } finally {
      setTopicSearching(false)
    }
  }

  // Research a Surah with AI
  async function researchSurah() {
    if (!activeSurah || surahResearching) return
    setSurahResearching(true)
    setSurahResearch('')
    try {
      await askAI(
        `Provide a scholarly research summary of Surah ${activeSurah.englishName} (${activeSurah.arabicName}), Surah ${activeSurah.number}:
- Main themes and key messages
- Historical/revelation context (Meccan/Medinan)
- Important Ayahs with citations [Quran ${activeSurah.number}:X]
- Key concepts and lessons
- Related Surahs
Keep it academic and accurate.`,
        (t) => setSurahResearch(t)
      )
    } catch {
      setSurahResearch('Unable to research this Surah at this time.')
    } finally {
      setSurahResearching(false)
    }
  }

  // Surah list filtering
  const filteredSurahs = SURAHS.filter(s => {
    const q = surahFilter.toLowerCase()
    const matchesSearch = !q || s.englishName.toLowerCase().includes(q)
      || s.arabicName.includes(q) || String(s.number).includes(q)
      || s.englishNameTranslation.toLowerCase().includes(q)
    const matchesRev = revelationFilter === 'All' || s.revelationType === revelationFilter
    return matchesSearch && matchesRev
  })

  // ── Render helpers ──────────────────────────────────────────────────────────

  const headerStyle = {
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  }

  const SUGGESTED_TOPICS = [
    'Patience (Sabr)', 'Prayer (Salah)', 'Forgiveness', 'Parents',
    'Jannah', 'Tawheed', 'Knowledge', 'Charity (Sadaqah)',
    'Gratitude (Shukr)', 'Prophet Musa', 'Day of Judgment', 'Tawakkul',
  ]

  // ── VIEWS ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── Global search bar (always visible) ── */}
      <div className="shrink-0 px-4 py-3" style={headerStyle}>
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          {/* Back button when not on home */}
          {view !== 'home' && (
            <button onClick={() => setView('home')}
              className="shrink-0 p-2 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <ArrowLeft size={16} />
            </button>
          )}

          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
            <Search size={15} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search the Quran — Surah, Ayah, topic, Arabic, English, Malayalam..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>

          <button onClick={() => handleSearch()}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Search
          </button>

          {/* History toggle */}
          <button onClick={() => setHistoryOpen(!historyOpen)}
            className="shrink-0 p-2 rounded-lg transition-all relative"
            style={{ color: researchHistory.length ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="Research History"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <History size={15} />
            {researchHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}>{researchHistory.length > 9 ? '9+' : researchHistory.length}</span>
            )}
          </button>
        </div>

        {/* History dropdown */}
        {historyOpen && researchHistory.length > 0 && (
          <div className="max-w-3xl mx-auto mt-2 rounded-xl overflow-hidden shadow-xl z-10 relative"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Recent Research</span>
              <button onClick={() => { saveHistory([]); setResearchHistory([]) }}
                className="text-xs" style={{ color: 'var(--text-muted)' }}>Clear all</button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {researchHistory.map((h, i) => (
                <button key={i} onClick={() => {
                  setHistoryOpen(false)
                  if (h.type === 'topic') { setTopicQuery(h.query); setView('topic-research'); }
                  else { setSearchQuery(h.query); handleSearch(h.query) }
                }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-all"
                  style={{ borderBottom: i < researchHistory.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <History size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{h.query}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 capitalize"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{h.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══════════════════════════════════ HOME ═══════════════════════════════════ */}
        {view === 'home' && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">

            {/* Hero */}
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
                <BookOpen size={24} style={{ color: 'var(--accent)' }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Quran Research</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Explore Ayahs, Surahs, Tafsir, themes and Quranic references
              </p>
            </div>

            {/* Quick Access Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <List size={18} />, label: 'Surah Explorer', view: 'surah-list' as View, color: '#16a34a' },
                { icon: <Search size={18} />, label: 'Topic Research', view: 'topic-research' as View, color: '#0ea5e9' },
                { icon: <Layers size={18} />, label: 'Compare Ayahs', view: 'compare' as View, color: '#8b5cf6' },
                { icon: <BookMarked size={18} />, label: 'My Bookmarks', view: 'bookmarks' as View, color: '#f59e0b' },
              ].map(item => (
                <button key={item.label} onClick={() => setView(item.view)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all active:scale-95"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = item.color + '55'; e.currentTarget.style.background = item.color + '11' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}>
                  <div className="p-2 rounded-lg" style={{ background: item.color + '22', color: item.color }}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-medium text-center" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Ayah Lookup */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BookOpen size={15} style={{ color: 'var(--accent)' }} />
                Ayah Lookup
              </h2>
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Surah (1–114)</label>
                  <select value={lookupSurah} onChange={e => setLookupSurah(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">Select Surah</option>
                    {SURAHS.map(s => (
                      <option key={s.number} value={s.number}>{s.number}. {s.englishName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Ayah Number</label>
                  <input type="number" min={1} value={lookupAyah}
                    onChange={e => setLookupAyah(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLookup()}
                    placeholder="e.g. 255"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <button onClick={handleLookup} disabled={lookupLoading || !lookupSurah || !lookupAyah}
                  className="px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  onMouseEnter={e => !lookupLoading && (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : 'Research'}
                </button>
              </div>
            </div>

            {/* Suggested Topics */}
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <MessageSquare size={15} style={{ color: 'var(--accent)' }} />
                Research by Topic
              </h2>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map(t => (
                  <button key={t} onClick={() => { setTopicQuery(t); handleTopicResearch() }}
                    className="px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Surahs */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Star size={15} style={{ color: 'var(--accent)' }} />
                  Featured Surahs
                </h2>
                <button onClick={() => setView('surah-list')}
                  className="text-xs transition-all flex items-center gap-1"
                  style={{ color: 'var(--accent)' }}>
                  View all 114 <ChevronRight size={12} />
                </button>
              </div>
              <div className="grid gap-2">
                {[1, 36, 55, 67, 112].map(n => {
                  const s = SURAHS[n - 1]
                  return <SurahCard key={n} surah={s} onClick={() => openSurah(s)} />
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ SURAH LIST ═══════════════════════════════════ */}
        {view === 'surah-list' && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>114 Surahs</h2>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <button onClick={() => setSurahViewGrid(!surahViewGrid)}
                  className="p-2 rounded-lg transition-all"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {surahViewGrid ? <List size={14} /> : <Grid3X3 size={14} />}
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[160px] flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <Search size={13} style={{ color: 'var(--text-muted)' }} />
                <input value={surahFilter} onChange={e => setSurahFilter(e.target.value)}
                  placeholder="Filter surahs..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }} />
              </div>
              {(['All', 'Meccan', 'Medinan'] as const).map(r => (
                <button key={r} onClick={() => setRevelationFilter(r)}
                  className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: revelationFilter === r ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: revelationFilter === r ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${revelationFilter === r ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  {r}
                </button>
              ))}
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filteredSurahs.length} Surahs</p>

            {/* Surah grid/list */}
            <div className={surahViewGrid ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
              {filteredSurahs.map(s => (
                surahViewGrid ? (
                  <button key={s.number} onClick={() => openSurah(s)}
                    className="p-3 rounded-xl text-left transition-all active:scale-95"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{s.number}</span>
                      <p className="text-sm" style={{ fontFamily: "'Amiri', serif", color: 'var(--accent)', direction: 'rtl' }}>{s.arabicName}</p>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.englishName}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.numberOfAyahs} Ayahs · {s.revelationType}</p>
                  </button>
                ) : (
                  <SurahCard key={s.number} surah={s} onClick={() => openSurah(s)} />
                )
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ SURAH READER ═══════════════════════════════════ */}
        {view === 'surah-reader' && activeSurah && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
            {/* Surah header */}
            <div className="rounded-2xl p-5 text-center"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-3xl mb-1" style={{ fontFamily: "'Amiri', serif", color: 'var(--accent)', direction: 'rtl' }}>
                {activeSurah.arabicName}
              </p>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{activeSurah.englishName}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{activeSurah.englishNameTranslation}</p>
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                  Surah {activeSurah.number}
                </span>
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {activeSurah.numberOfAyahs} Ayahs
                </span>
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{
                    background: activeSurah.revelationType === 'Meccan' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                    color: activeSurah.revelationType === 'Meccan' ? '#f59e0b' : '#3b82f6',
                    border: `1px solid ${activeSurah.revelationType === 'Meccan' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`,
                  }}>{activeSurah.revelationType}</span>
              </div>
              <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{activeSurah.description}</p>
            </div>

            {/* Research This Surah */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <button onClick={researchSurah}
                className="flex items-center justify-between w-full px-4 py-3 transition-all"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Research This Surah</span>
                </div>
                {surahResearching ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
              </button>
              {(surahResearch || surahResearching) && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {surahResearching && !surahResearch && (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Researching…</span>
                    </div>
                  )}
                  {surahResearch && (
                    <div className="prose-sm mt-3 text-sm leading-relaxed space-y-2" style={{ color: 'var(--text-secondary)' }}>
                      <div className="text-xs font-semibold px-2 py-1 rounded mb-3 inline-block"
                        style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                        ✦ AI Explanation — Not a scholarly Tafsir
                      </div>
                      {surahResearch.split('\n').filter(Boolean).map((p, i) => (
                        <p key={i}>{renderWithCitations(p)}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bismillah (except Surah 9) */}
            {activeSurah.number !== 9 && (
              <p className="text-center text-2xl py-4" style={{ fontFamily: "'Amiri', serif", color: 'var(--accent)', direction: 'rtl', lineHeight: 2 }}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </p>
            )}

            {/* Ayahs */}
            {surahLoading ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Surah…</span>
              </div>
            ) : surahContent ? (
              <div className="space-y-4">
                {surahContent.arabic.map((arabicText, i) => (
                  <div key={i} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    {/* Ayah number badge */}
                    <div className="flex items-center justify-between px-4 py-2"
                      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                        Quran {activeSurah.number}:{i + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openAyahDetail(activeSurah.number, i + 1)}
                          className="p-1.5 rounded-lg text-xs transition-all flex items-center gap-1"
                          style={{ color: 'var(--text-muted)' }}
                          title="Research this Ayah"
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                          <BookOpen size={11} />
                        </button>
                        <button onClick={() => {
                          const bm: BookmarkedAyah = {
                            surah: activeSurah.number, ayah: i + 1,
                            arabic: arabicText, translation: surahContent.english[i] ?? '',
                            reference: `Quran ${activeSurah.number}:${i + 1}`, savedAt: Date.now(),
                          }
                          if (isBookmarked(activeSurah.number, i + 1)) {
                            setBookmarks(prev => prev.filter(b => !(b.surah === activeSurah.number && b.ayah === i + 1)))
                          } else {
                            setBookmarks(prev => [...prev, bm])
                          }
                        }}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: isBookmarked(activeSurah.number, i + 1) ? 'var(--accent)' : 'var(--text-muted)' }}
                          title="Bookmark"
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <Bookmark size={11} fill={isBookmarked(activeSurah.number, i + 1) ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                    {/* Arabic */}
                    <div className="px-5 py-4 text-center" style={{ direction: 'rtl' }}>
                      <p className="leading-loose text-xl" style={{
                        fontFamily: "'Uthmanic', 'Scheherazade New', 'Amiri', serif",
                        color: 'var(--text-primary)', lineHeight: '2.2',
                      }}>
                        {arabicText}
                        <span className="mr-2 text-base" style={{ color: 'var(--accent)' }}>﴿{i + 1}﴾</span>
                      </p>
                    </div>
                    {/* Translation */}
                    <div className="px-5 pb-4" style={{ direction: 'ltr' }}>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {surahContent.english[i]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Unable to load Surah content. Please check your connection.
                </p>
                <button onClick={() => openSurah(activeSurah)}
                  className="mt-3 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm transition-all"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                  <RefreshCw size={13} /> Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ AYAH DETAIL ═══════════════════════════════════ */}
        {view === 'ayah-detail' && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

            {ayahLoading ? (
              <div className="flex items-center justify-center gap-2 py-20">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Loading Ayah…</span>
              </div>
            ) : selectedAyah ? (
              <>
                {/* Main Ayah Card */}
                <AyahCard
                  surahNumber={selectedAyah.surahNumber}
                  ayahNumber={selectedAyah.ayahNumber}
                  arabic={selectedAyah.arabic}
                  translation={selectedAyah.englishTranslation}
                  reference={selectedAyah.reference}
                  onBookmark={() => toggleBookmark(selectedAyah)}
                  isBookmarked={isBookmarked(selectedAyah.surahNumber, selectedAyah.ayahNumber)}
                />

                {/* Surah context */}
                <div className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <BookOpen size={14} style={{ color: 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Part of</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {SURAHS[selectedAyah.surahNumber - 1]?.englishName} — {SURAHS[selectedAyah.surahNumber - 1]?.englishNameTranslation}
                    </p>
                  </div>
                  <button onClick={() => openSurah(SURAHS[selectedAyah.surahNumber - 1])}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                    Open Surah
                  </button>
                </div>

                {/* Compare toggle */}
                <button
                  onClick={() => {
                    if (selectedAyah && !compareList.find(a => a.surahNumber === selectedAyah.surahNumber && a.ayahNumber === selectedAyah.ayahNumber)) {
                      if (compareList.length < 4) setCompareList(prev => [...prev, selectedAyah])
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <Layers size={13} style={{ color: 'var(--accent)' }} />
                  Add to Compare ({compareList.length}/4)
                </button>

                {/* Tafsir */}
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <BookMarked size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tafsir</span>
                  </div>
                  <div className="p-4">
                    {tafsirLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Tafsir…</span>
                      </div>
                    ) : tafsir.length > 0 ? (
                      tafsir.map((t, i) => (
                        <div key={i}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
                              {t.source}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.scholar}</span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t.text}</p>
                          <a href={`https://quran.com/${selectedAyah.surahNumber}/${selectedAyah.ayahNumber}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs mt-2 inline-flex items-center gap-1 transition-all"
                            style={{ color: 'var(--accent)' }}>
                            Read full Tafsir on quran.com ↗
                          </a>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Tafsir not available for this Ayah from the current source. Visit{' '}
                        <a href={`https://quran.com/${selectedAyah.surahNumber}/${selectedAyah.ayahNumber}`}
                          target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>quran.com</a> for full Tafsir.
                      </p>
                    )}
                  </div>
                </div>

                {/* AI Explanation */}
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: aiExplanation || aiExplaining ? '1px solid var(--border)' : 'none' }}>
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Explanation</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                        Not Tafsir
                      </span>
                    </div>
                    {!aiExplanation && !aiExplaining && (
                      <button onClick={getAIExplanation}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        Generate
                      </button>
                    )}
                    {aiExplaining && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />}
                  </div>
                  {(aiExplanation || aiExplaining) && (
                    <div className="p-4">
                      {aiExplaining && !aiExplanation && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
                          Generating explanation…
                        </div>
                      )}
                      {aiExplanation && (
                        <div className="text-sm leading-relaxed space-y-2" style={{ color: 'var(--text-secondary)' }}>
                          {aiExplanation.split('\n').filter(Boolean).map((p, i) => (
                            <p key={i}>{renderWithCitations(p)}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Related Ayahs */}
                {relatedAyahs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <ChevronRight size={14} style={{ color: 'var(--accent)' }} />
                      Related Ayahs
                    </h3>
                    <div className="space-y-2">
                      {relatedAyahs.map((r, i) => (
                        <button key={i} onClick={() => openAyahDetail(r.surahNumber, r.ayahNumber)}
                          className="w-full text-left p-3 rounded-xl transition-all"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)' }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                              {r.translation.slice(0, 100)}{r.translation.length > 100 ? '…' : ''}
                            </p>
                            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                              {r.reference}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Unable to load this Ayah. Please try again.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ SEARCH RESULTS ═══════════════════════════════════ */}
        {view === 'search-results' && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Search Results{searchQuery ? ` for "${searchQuery}"` : ''}
              </h2>
              {!searching && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{searchResults.length} results</span>
              )}
            </div>

            {searching ? (
              <div className="flex items-center justify-center gap-2 py-16">
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Searching Quran…</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-16">
                <Search size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No results found. Try a different search term.</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {['Patience', 'Prayer', 'Forgiveness', 'Allah'].map(s => (
                    <button key={s} onClick={() => { setSearchQuery(s); handleSearch(s) }}
                      className="px-3 py-1.5 rounded-lg text-xs transition-all"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((r, i) => (
                  <AyahCard key={i}
                    surahNumber={r.surahNumber}
                    ayahNumber={r.ayahNumber}
                    arabic={r.arabic}
                    translation={r.translation}
                    reference={r.reference}
                    onOpen={() => openAyahDetail(r.surahNumber, r.ayahNumber)}
                    onBookmark={() => {
                      const fake: Ayah = { surahNumber: r.surahNumber, ayahNumber: r.ayahNumber, arabic: r.arabic, transliteration: '', englishTranslation: r.translation, malayalamTranslation: '', reference: r.reference }
                      toggleBookmark(fake)
                    }}
                    isBookmarked={isBookmarked(r.surahNumber, r.ayahNumber)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ TOPIC RESEARCH ═══════════════════════════════════ */}
        {view === 'topic-research' && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Search size={18} style={{ color: 'var(--accent)' }} />
              Topic Research
            </h2>

            {/* Topic input */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ask a Quran research question or enter a topic</p>
              <div className="flex gap-2">
                <input value={topicQuery}
                  onChange={e => setTopicQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTopicResearch()}
                  placeholder="e.g. What does the Quran say about patience?"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <button onClick={handleTopicResearch} disabled={topicSearching || !topicQuery.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {topicSearching ? <Loader2 size={14} className="animate-spin" /> : 'Research'}
                </button>
              </div>

              {/* Suggested */}
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTED_TOPICS.slice(0, 8).map(t => (
                  <button key={t} onClick={() => { setTopicQuery(t); handleTopicResearch() }}
                    className="px-2.5 py-1 rounded-lg text-[11px] transition-all"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent-border)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {topicSearching && !topicResult && (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Researching the Quran…</span>
              </div>
            )}

            {/* AI Research Result */}
            {topicResult && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="px-4 py-3 flex items-center gap-2"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                  <MessageSquare size={13} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quran Research: {topicQuery}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: 'rgba(234,179,8,0.1)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                    AI Explanation
                  </span>
                </div>
                <div className="p-4 text-sm leading-relaxed space-y-2" style={{ color: 'var(--text-secondary)' }}>
                  {topicResult.split('\n').filter(Boolean).map((p, i) => (
                    <p key={i}>{renderWithCitations(p)}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Ayah results */}
            {topicAyahs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Relevant Ayahs
                </h3>
                <div className="space-y-3">
                  {topicAyahs.map((r, i) => (
                    <AyahCard key={i}
                      surahNumber={r.surahNumber} ayahNumber={r.ayahNumber}
                      arabic={r.arabic} translation={r.translation} reference={r.reference}
                      onOpen={() => openAyahDetail(r.surahNumber, r.ayahNumber)}
                      onBookmark={() => {
                        const fake: Ayah = { surahNumber: r.surahNumber, ayahNumber: r.ayahNumber, arabic: r.arabic, transliteration: '', englishTranslation: r.translation, malayalamTranslation: '', reference: r.reference }
                        toggleBookmark(fake)
                      }}
                      isBookmarked={isBookmarked(r.surahNumber, r.ayahNumber)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ COMPARE ═══════════════════════════════════ */}
        {view === 'compare' && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Layers size={18} style={{ color: 'var(--accent)' }} />
                Compare Ayahs
              </h2>
              {compareList.length > 0 && (
                <button onClick={() => setCompareList([])}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Clear all
                </button>
              )}
            </div>

            {compareList.length === 0 ? (
              <div className="text-center py-12 rounded-2xl"
                style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)' }}>
                <Layers size={32} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No Ayahs selected for comparison</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Open any Ayah and click "Add to Compare" — up to 4 Ayahs
                </p>
                <button onClick={() => setView('surah-list')}
                  className="mt-4 px-4 py-2 rounded-lg text-sm transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  Browse Surahs
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {compareList.map((a, i) => (
                  <div key={i} className="rounded-xl overflow-hidden relative"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-border)' }}>
                    <button onClick={() => setCompareList(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-3 right-3 p-1 rounded-lg transition-all z-10"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                      <X size={12} />
                    </button>
                    <div className="flex items-center gap-2 px-4 py-2.5"
                      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                      <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)', color: '#fff' }}>{i + 1}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{a.reference}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{SURAHS[a.surahNumber - 1]?.englishName}</span>
                    </div>
                    <div className="px-5 py-4 text-center" style={{ direction: 'rtl' }}>
                      <p className="text-xl leading-loose" style={{
                        fontFamily: "'Uthmanic', 'Scheherazade New', 'Amiri', serif",
                        color: 'var(--text-primary)', lineHeight: '2.2',
                      }}>
                        {a.arabic}
                      </p>
                    </div>
                    <div className="px-5 pb-4" style={{ direction: 'ltr' }}>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.englishTranslation}</p>
                    </div>
                  </div>
                ))}
                {compareList.length < 4 && (
                  <button onClick={() => setView('surah-list')}
                    className="w-full py-4 rounded-xl text-sm transition-all"
                    style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)', color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    + Add another Ayah ({compareList.length}/4)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ BOOKMARKS ═══════════════════════════════════ */}
        {view === 'bookmarks' && (
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BookMarked size={18} style={{ color: 'var(--accent)' }} />
                My Bookmarks
              </h2>
              {bookmarks.length > 0 && (
                <button onClick={() => setBookmarks([])}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Clear all
                </button>
              )}
            </div>

            {bookmarks.length === 0 ? (
              <div className="text-center py-16 rounded-2xl"
                style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--border)' }}>
                <Bookmark size={32} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No bookmarks yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Bookmark Ayahs while reading or researching</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...bookmarks].reverse().map((b, i) => (
                  <AyahCard key={i}
                    surahNumber={b.surah} ayahNumber={b.ayah}
                    arabic={b.arabic} translation={b.translation} reference={b.reference}
                    onOpen={() => openAyahDetail(b.surah, b.ayah)}
                    onBookmark={() => setBookmarks(prev => prev.filter(bm => !(bm.surah === b.surah && bm.ayah === b.ayah)))}
                    isBookmarked={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
