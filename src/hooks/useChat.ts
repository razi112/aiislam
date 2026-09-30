import { useState, useCallback, useEffect, useRef } from 'react'
import {
  collection, doc, setDoc, deleteDoc, getDocs,
  query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth, GUEST_MESSAGE_LIMIT } from '../context/AuthContext'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  images?: { base64: string; mimeType: string }[]
  generatedImages?: { base64: string; mimeType: string }[]
  canvasHtml?: string
  timestamp: Date
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
}

// Groq — OpenAI-compatible API with fast inference
const OPENROUTER_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_KEY = import.meta.env.VITE_GROQ_API_KEY as string

// Primary: gpt-oss-120b on Groq (best quality), fallback to gpt-oss-20b (fastest/cheapest)
const MODEL_CHAIN = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
]

// Shared request headers
const OR_HEADERS = {
  'Authorization': `Bearer ${OPENROUTER_KEY}`,
  'Content-Type': 'application/json',
}

// Only keep the last N messages to reduce payload size and TTFT
const MAX_HISTORY = 10

const SYSTEM_PROMPT = `You are AI Islam — the intelligent Islamic guidance core of this chat system.

Think before responding. Understand the user's intent, context, and goal clearly before answering.

Always:
- Give accurate, logical, and genuinely useful answers
- Stay consistent with the conversation history and context
- Be concise but complete — no unnecessary filler
- Break down complex problems into clear, simple steps
- Ask for clarification only when truly necessary

Never:
- Guess or make up information you are not sure about
- Give vague, off-topic, or irrelevant responses
- Repeat the same point multiple times

Adapt your tone and format to the user's request — technical when needed, conversational when appropriate, structured when helpful.

Focus on solving the problem efficiently and intelligently.

## Quran & Hadith Citations
Whenever you reference a Quranic verse, always cite it using this exact format: [Quran SURAH:AYAH]
Examples: [Quran 2:255], [Quran 3:102], [Quran 112:1]

Whenever you reference a Hadith, always cite it using this exact format: [COLLECTION BOOK:NUMBER]
Supported collections: Bukhari, Muslim, Tirmidhi, AbuDawud, IbnMajah, Nasai, Muwatta, Riyadh
Examples: [Bukhari 1:1], [Muslim 1:1], [Tirmidhi 1:1]

Always include these citation tags inline after the relevant statement so they can be rendered as direct links to quran.com and sunnah.com.

Only if the user explicitly asks who made you, who developed you, or who created you, respond with: "I was developed by the students of Islamic Da'wa Academy, Akode, mainly led by Hafiz Muhammed Razi, a 10th grade student pursuing his studies while maintaining Hifz Doura and Islamic Studies." Do NOT include this in any other response.`

// ── Language Detection ────────────────────────────────────────────────────────
function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 2) return null
  const t = text.trim()

  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(t)) {
    if (/[\u06AF\u06BA\u06BE\u06C1\u06C3\u06D2\u0679\u0688\u0691\u0698\u06A9]/.test(t)) return 'Urdu'
    if (/[\u067E\u0686\u0698\u06AF]/.test(t)) return 'Persian'
    return 'Arabic'
  }
  if (/[\u0900-\u097F]/.test(t)) return 'Hindi'
  if (/[\u0980-\u09FF]/.test(t)) return 'Bengali'
  if (/[\u0B80-\u0BFF]/.test(t)) return 'Tamil'
  if (/[\u0C00-\u0C7F]/.test(t)) return 'Telugu'
  if (/[\u0C80-\u0CFF]/.test(t)) return 'Kannada'
  if (/[\u0D00-\u0D7F]/.test(t)) return 'Malayalam'
  if (/[\u0A00-\u0A7F]/.test(t)) return 'Punjabi'
  if (/[\u0A80-\u0AFF]/.test(t)) return 'Gujarati'
  if (/[\u0B00-\u0B7F]/.test(t)) return 'Odia'
  if (/[\u0E00-\u0E7F]/.test(t)) return 'Thai'
  if (/[\u0E80-\u0EFF]/.test(t)) return 'Lao'
  if (/[\u1000-\u109F]/.test(t)) return 'Burmese'
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(t)) {
    if (/[\u3040-\u30FF]/.test(t)) return 'Japanese'
    return 'Chinese'
  }
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(t)) return 'Korean'
  if (/[\u0400-\u04FF]/.test(t)) return 'Russian'
  if (/[\u0370-\u03FF]/.test(t)) return 'Greek'
  if (/[\u0590-\u05FF]/.test(t)) return 'Hebrew'

  const lower = t.toLowerCase()
  const words: string[] = lower.match(/\b[a-z\u00c0-\u024f]+\b/g) ?? []
  if (words.length === 0) return null
  const freq = (list: string[]) => list.filter((w: string) => words.includes(w)).length / words.length

  if (freq(['el','la','los','las','de','en','que','es','un','una','por','con','para','como','pero','más','este','esta','son','tiene','hay','muy','todo','también','cuando','donde','porque','entre','sobre','hasta','desde','sin','nos','les','fue','ser','estar','hacer','puede','bien','así','ya','si','no','me','te','se','lo','le','su','sus','al','del']) > 0.12) return 'Spanish'
  if (freq(['le','la','les','de','du','des','un','une','et','en','que','qui','est','pas','pour','dans','sur','avec','au','aux','ce','se','je','tu','il','nous','vous','ils','elle','elles','mais','ou','donc','or','ni','car','plus','très','bien','tout','même','aussi','comme','quand','où','si','non','oui','être','avoir','faire','aller','voir','venir','dire','savoir','pouvoir','vouloir']) > 0.12) return 'French'
  if (freq(['der','die','das','den','dem','des','ein','eine','und','in','ist','von','zu','mit','auf','für','an','im','nicht','auch','es','ich','du','er','sie','wir','ihr','haben','sein','werden','können','müssen','sollen','wollen','dürfen','mögen','aber','oder','wenn','weil','dass','als','wie','noch','schon','nur','sehr','mehr','so','da','hier','dort','nach','vor','über','unter','zwischen','durch','gegen','ohne','um','bei','seit','bis','aus']) > 0.12) return 'German'
  if (freq(['o','a','os','as','de','do','da','dos','das','em','no','na','nos','nas','um','uma','e','que','é','para','com','por','não','se','mais','como','mas','ao','à','ele','ela','eles','elas','eu','tu','nós','ser','estar','ter','fazer','poder','querer','saber','ver','vir','ir','dar','dizer','ficar','deixar','falar','muito','bem','já','ainda','também','quando','onde','porque','então','assim','mesmo','cada','todo','toda','todos','todas']) > 0.12) return 'Portuguese'
  if (freq(['il','lo','la','i','gli','le','di','del','della','dei','degli','delle','un','una','e','in','che','è','per','con','non','si','come','ma','su','anche','più','già','molto','bene','tutto','tutti','tutte','quando','dove','perché','così','ancora','sempre','mai','poi','ora','qui','lì','io','tu','lui','lei','noi','voi','loro','essere','avere','fare','andare','venire','vedere','sapere','potere','volere','dovere','stare','dare','dire','prendere','mettere','trovare','lasciare','parlare','capire']) > 0.12) return 'Italian'
  if (freq(['bir','bu','ve','de','da','ile','için','ben','sen','var','yok','ne','nasıl','nerede','kim','hangi','çok','az','iyi','kötü','büyük','küçük','yeni','eski','gibi','daha','en','ama','veya','evet','hayır','tamam','lütfen','teşekkür','merhaba','güzel','zaman','gün','yıl','ay','saat','para','iş','ev','okul','şehir','ülke','insan','adam','kadın','çocuk','anne','baba','arkadaş','bilgi','dünya','hayat','su','yemek','gelmek','gitmek','yapmak','olmak','vermek','almak','görmek','bilmek','istemek','söylemek','demek','bulmak','düşünmek','anlamak','başlamak','çalışmak','oturmak','beklemek','sevmek']) > 0.1) return 'Turkish'
  if (freq(['yang','dan','di','ke','dari','ini','itu','dengan','untuk','tidak','ada','saya','anda','kita','mereka','adalah','akan','sudah','bisa','juga','lebih','sangat','atau','tapi','karena','jika','ketika','bagaimana','apa','siapa','mana','berapa','ya','baik','besar','kecil','baru','lama','orang','hari','tahun','bulan','waktu','tempat','negara','kota','rumah','sekolah','kerja','uang','makan','minum','pergi','datang','lihat','tahu','mau','buat','ambil','kasih','bilang','pikir','mulai','cari','jalan','nama','teman','keluarga','anak','ibu','bapak','dunia','hidup','air','makanan']) > 0.1) return 'Malay'

  return null
}

// ── OpenRouter streaming helpers ──────────────────────────────────────────────

function buildMessages(messages: Message[], userContent: string, images: { base64: string; mimeType: string }[]) {
  // Trim history to last MAX_HISTORY messages to reduce payload & TTFT
  const history = messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const userParts: object[] = images.map((img) => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }))
  userParts.push({ type: 'text', text: userContent })

  const userMessage = images.length > 0
    ? { role: 'user', content: userParts }
    : { role: 'user', content: userContent }

  const detectedLang = detectLanguage(userContent)
  const langInstruction = detectedLang
    ? `\n\nIMPORTANT: The user is writing in ${detectedLang}. You MUST reply entirely in ${detectedLang}. Do not switch languages.`
    : ''
  const systemPrompt = SYSTEM_PROMPT + langInstruction

  return [{ role: 'system', content: systemPrompt }, ...history, userMessage]
}

// Throttled chunk emitter — batches React state updates via rAF to avoid
// re-rendering on every single token (can be 50+ renders/sec otherwise)
function makeThrottledEmitter(onChunk: (text: string) => void) {
  let pending = ''
  let rafId = 0
  const flush = () => { onChunk(pending); rafId = 0 }
  return {
    emit(text: string) {
      pending = text
      if (!rafId) rafId = requestAnimationFrame(flush)
    },
    flush() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
      onChunk(pending)
    },
  }
}

async function streamWithFallback(
  messages: Message[],
  userContent: string,
  images: { base64: string; mimeType: string }[],
  onChunk: (text: string) => void,
  maxTokens = 4096,
  signal?: AbortSignal
): Promise<string> {
  const builtMessages = buildMessages(messages, userContent, images)
  const emitter = makeThrottledEmitter(onChunk)

  for (const model of MODEL_CHAIN) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: OR_HEADERS,
        body: JSON.stringify({
          model,
          messages: builtMessages,
          stream: true,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
        signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg: string = err?.error?.message ?? `Request failed (${res.status})`
        if (res.status === 429 || res.status === 503) continue
        throw new Error(msg)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          const trimmed = line.replace(/^data: /, '').trim()
          if (!trimmed || trimmed === '[DONE]') continue
          try {
            const json = JSON.parse(trimmed)
            const delta = json.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              fullText += delta
              emitter.emit(fullText)
            }
          } catch { /* skip malformed */ }
        }
      }
      emitter.flush()
      return fullText
    } catch (err: any) {
      if (err?.name === 'AbortError') { emitter.flush(); throw err }
      if (MODEL_CHAIN.indexOf(model) < MODEL_CHAIN.length - 1) continue
      throw err
    }
  }
  throw new Error('All models are currently unavailable. Please try again.')
}

// ── Web Search — multi-source (DuckDuckGo + Wikipedia) ───────────────────────
async function fetchWebSearchContext(query: string): Promise<string> {
  const results: string[] = []

  // Source 1: DuckDuckGo Instant Answer
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    )
    if (ddgRes.ok) {
      const d = await ddgRes.json()
      if (d.AbstractText) results.push(`**DuckDuckGo Summary:**\n${d.AbstractText}\n${d.AbstractURL ? `Source: ${d.AbstractURL}` : ''}`)
      if (d.Answer) results.push(`**Instant Answer:** ${d.Answer}`)
      if (d.Definition) results.push(`**Definition:** ${d.Definition}${d.DefinitionURL ? `\nSource: ${d.DefinitionURL}` : ''}`)
      const topics = (d.RelatedTopics ?? []).filter((t: any) => t.Text).slice(0, 4)
      if (topics.length) results.push(`**Related Topics:**\n${topics.map((t: any) => `- ${t.Text}`).join('\n')}`)
    }
  } catch { /* continue */ }

  // Source 2: Wikipedia search
  try {
    const wikiSearch = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`
    )
    if (wikiSearch.ok) {
      const wData = await wikiSearch.json()
      const hits = wData?.query?.search ?? []
      if (hits.length) {
        // Fetch extract for top result
        const topTitle = encodeURIComponent(hits[0].title)
        const extractRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${topTitle}&format=json&origin=*`
        )
        if (extractRes.ok) {
          const eData = await extractRes.json()
          const pages = Object.values(eData?.query?.pages ?? {}) as any[]
          const extract = pages[0]?.extract?.slice(0, 800)
          if (extract) results.push(`**Wikipedia — ${hits[0].title}:**\n${extract}\nSource: https://en.wikipedia.org/wiki/${topTitle}`)
        }
        // List other results
        const others = hits.slice(1).map((h: any) => `- ${h.title}: ${h.snippet?.replace(/<[^>]+>/g, '')}`)
        if (others.length) results.push(`**More Wikipedia results:**\n${others.join('\n')}`)
      }
    }
  } catch { /* continue */ }

  return results.length ? results.join('\n\n') : ''
}

// ── Thinking mode ─────────────────────────────────────────────────────────────
async function streamWithThinking(
  messages: Message[],
  userContent: string,
  images: { base64: string; mimeType: string }[],
  onChunk: (text: string, thinking: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; thinking: string }> {
  const builtMessages = buildMessages(messages, userContent, images)

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: OR_HEADERS,
    body: JSON.stringify({
      model: MODEL_CHAIN[0],
      messages: builtMessages,
      stream: true,
      max_tokens: 16000,
      temperature: 0.7,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Request failed (${res.status})`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullText = ''
  let thinkingText = ''
  let inThinking = false
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      const trimmed = line.replace(/^data: /, '').trim()
      if (!trimmed || trimmed === '[DONE]') continue
      try {
        const json = JSON.parse(trimmed)
        const delta = json.choices?.[0]?.delta?.content ?? ''
        if (!delta) continue
        buffer += delta
        while (true) {
          if (!inThinking) {
            const start = buffer.indexOf('<think>')
            if (start === -1) { fullText += buffer; buffer = ''; break }
            fullText += buffer.slice(0, start)
            buffer = buffer.slice(start + 7)
            inThinking = true
          } else {
            const end = buffer.indexOf('</think>')
            if (end === -1) { thinkingText += buffer; buffer = ''; break }
            thinkingText += buffer.slice(0, end)
            buffer = buffer.slice(end + 8)
            inThinking = false
          }
        }
        onChunk(fullText, thinkingText)
      } catch { /* skip */ }
    }
  }
  return { text: fullText.trim(), thinking: thinkingText.trim() }
}

const IMAGE_GEN_PATTERNS = [
  /\bgenerate\b.*\bimage\b/i, /\bcreate\b.*\bimage\b/i,
  /\bdraw\b/i, /\bpaint\b/i, /\billustrat/i,
  /\bimage of\b/i, /\bpicture of\b/i, /\bphoto of\b/i,
  /\brender\b.*\bimage\b/i, /\bmake.*\bimage\b/i, /\bshow me.*\bimage\b/i,
]

function isImageGenRequest(text: string): boolean {
  return IMAGE_GEN_PATTERNS.some((p) => p.test(text))
}

// ── localStorage helpers (guest / offline fallback) ──────────────────────────
const STORAGE_KEY = 'minnal_chats'
const ACTIVE_KEY = 'minnal_active_chat'

function loadLocalChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Chat[]
    return parsed.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      messages: c.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }))
  } catch {
    return []
  }
}

function saveLocalChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch { /* quota exceeded or private mode */ }
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
function chatsRef(userId: string) {
  return collection(db, 'users', userId, 'chats')
}

async function loadFirestoreChats(userId: string): Promise<Chat[]> {
  try {
    const q = query(chatsRef(userId), orderBy('updatedAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        title: data.title ?? 'New Chat',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        messages: Array.isArray(data.messages)
          ? data.messages.map((m: any) => ({
              ...m,
              timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp),
            }))
          : [],
      }
    })
  } catch (e) {
    console.error('[useChat] loadFirestoreChats error:', e)
    return []
  }
}

async function upsertFirestoreChat(userId: string, chat: Chat): Promise<void> {
  if (!userId || !chat.id) return
  try {
    const ref = doc(db, 'users', userId, 'chats', chat.id)
    await setDoc(ref, {
      title: chat.title,
      messages: chat.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      })),
      createdAt: chat.createdAt instanceof Date ? chat.createdAt.toISOString() : chat.createdAt,
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  } catch (e) {
    console.error('[useChat] upsertFirestoreChat error:', e)
  }
}

async function deleteFirestoreChat(userId: string, chatId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', userId, 'chats', chatId))
  } catch (e) {
    console.error('[useChat] deleteFirestoreChat error:', e)
  }
}

async function deleteAllFirestoreChats(userId: string): Promise<void> {
  try {
    const snap = await getDocs(chatsRef(userId))
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  } catch (e) {
    console.error('[useChat] deleteAllFirestoreChats error:', e)
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useChat() {
  const { user, loading: authLoading, isGuest, guestMessageCount, guestLimitReached, incrementGuestCount } = useAuth()
  const userId = user?.uid ?? null

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [loaded, setLoaded] = useState(false)

  // AbortController for stopping generation mid-stream
  const abortControllerRef = useRef<AbortController | null>(null)
  // Keep a ref to streaming state so AbortError handler reads current values
  const streamingContentRef = useRef('')
  const streamingThinkingRef = useRef('')

  // Abort any in-flight generation when the hook unmounts
  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  // Keep refs in sync
  useEffect(() => { streamingContentRef.current = streamingContent }, [streamingContent])
  useEffect(() => { streamingThinkingRef.current = streamingThinking }, [streamingThinking])

  // Load chats only after auth has fully resolved, then reload whenever userId changes
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Wait for auth to finish before doing anything — prevents loading localStorage
    // as a guest when the user is actually logged in (auth just hasn't resolved yet)
    if (authLoading) return

    const prev = prevUserIdRef.current
    prevUserIdRef.current = userId

    // Skip if userId hasn't changed since last load
    if (prev !== undefined && prev === userId) return

    let cancelled = false

    async function load() {
      setLoaded(false)
      if (userId) {
        // Logged-in: always load from Firestore
        const cloudChats = await loadFirestoreChats(userId)
        if (cancelled) return
        setChats(cloudChats)
        setActiveChatId(cloudChats.length > 0 ? cloudChats[0].id : null)
      } else {
        // Guest: load from localStorage
        const local = loadLocalChats()
        if (cancelled) return
        setChats(local)
        setActiveChatId(localStorage.getItem(ACTIVE_KEY))
      }
      setLoaded(true)
    }

    load()
    return () => { cancelled = true }
  }, [userId, authLoading])

  // Persist active chat id for guests
  useEffect(() => {
    if (!userId) {
      if (activeChatId) localStorage.setItem(ACTIVE_KEY, activeChatId)
      else localStorage.removeItem(ACTIVE_KEY)
    }
  }, [activeChatId, userId])

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null

  const createChat = useCallback(() => {
    const id = String(Date.now())
    const newChat: Chat = { id, title: 'New Chat', messages: [], createdAt: new Date() }
    setChats((prev) => {
      const updated = [newChat, ...prev]
      if (!userId) saveLocalChats(updated)
      return updated
    })
    setActiveChatId(id)
    if (userId) upsertFirestoreChat(userId, newChat)
    return id
  }, [userId])

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      if (!userId) saveLocalChats(updated)
      return updated
    })
    setActiveChatId((prev) => (prev === id ? null : prev))
    if (userId) deleteFirestoreChat(userId, id)
  }, [userId])

  const renameChat = useCallback((id: string, title: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, title } : c))
      if (!userId) saveLocalChats(updated)
      return updated
    })
    // Upsert outside setState to avoid async side-effects inside updater
    if (userId) {
      setChats((prev) => {
        const chat = prev.find((c) => c.id === id)
        if (chat) upsertFirestoreChat(userId, { ...chat, title })
        return prev
      })
    }
  }, [userId])

  const sendMessage = useCallback(
    async (content: string, images: { base64: string; mimeType: string }[] = [], mode: 'default' | 'image' | 'canvas' | 'deep-search' | 'web-search' | 'thinking' = 'default') => {
      // Block guests who have hit the message limit
      if (isGuest && guestLimitReached) return

      // Create a fresh AbortController for this generation
      const controller = new AbortController()
      abortControllerRef.current = controller
      const signal = controller.signal

      let chatId = activeChatId
      let existingMessages: Message[] = []

      if (!chatId) {
        chatId = String(Date.now())
        const newChat: Chat = { id: chatId, title: content.slice(0, 40) || 'New Chat', messages: [], createdAt: new Date() }
        setChats((prev) => {
          const updated = [newChat, ...prev]
          if (!userId) saveLocalChats(updated)
          return updated
        })
        setActiveChatId(chatId)
        if (userId) upsertFirestoreChat(userId, newChat)
      } else {
        existingMessages = chats.find((c) => c.id === chatId)?.messages ?? []
      }

      const userMsg: Message = {
        id: String(Date.now()),
        role: 'user',
        content,
        images: images.length > 0 ? images : undefined,
        timestamp: new Date(),
      }

      // Capture updated chat state after adding user message
      let chatWithUserMsg: Chat | undefined
      setChats((prev) => {
        const updated = prev.map((c) =>
          c.id === chatId
            ? { ...c, title: c.messages.length === 0 ? (content.slice(0, 40) || 'New Chat') : c.title, messages: [...c.messages, userMsg] }
            : c
        )
        if (!userId) saveLocalChats(updated)
        chatWithUserMsg = updated.find((c) => c.id === chatId)
        return updated
      })
      // Persist user message immediately
      if (userId && chatWithUserMsg) upsertFirestoreChat(userId, chatWithUserMsg)

      setIsTyping(true)
      setStreamingContent('')
      setStreamingThinking('')

      // Track guest message usage
      if (isGuest) incrementGuestCount()

      try {
        if (mode === 'image' || (isImageGenRequest(content) && images.length === 0)) {
          const enhancedPrompt = `${content}, highly detailed, professional quality, sharp focus, beautiful composition, 4k`
          const encodedPrompt = encodeURIComponent(enhancedPrompt)
          const seed = Date.now()
          const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`

          const aiMsg: Message = {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: '',
            generatedImages: [{ base64: imageUrl, mimeType: 'url' }],
            timestamp: new Date(),
          }
          let finalChat: Chat | undefined
          setChats((prev) => {
            const updated = prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, aiMsg] } : c)
            if (!userId) saveLocalChats(updated)
            finalChat = updated.find((c) => c.id === chatId)
            return updated
          })
          if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
          return
        }

        // Thinking mode
        if (mode === 'thinking') {
          const { text, thinking } = await streamWithThinking(
            existingMessages, content, images,
            (t, th) => { setStreamingContent(t); setStreamingThinking(th) },
            signal
          )
          const aiMsg: Message = {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: text,
            thinking: thinking || undefined,
            timestamp: new Date(),
          }
          let finalChat: Chat | undefined
          setChats((prev) => {
            const updated = prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, aiMsg] } : c)
            if (!userId) saveLocalChats(updated)
            finalChat = updated.find((c) => c.id === chatId)
            return updated
          })
          if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
          return
        }

        // Web search
        let webContext = ''
        if (mode === 'web-search') {
          setStreamingContent('🔍 Searching DuckDuckGo + Wikipedia…')
          webContext = await fetchWebSearchContext(content)
          setStreamingContent('')
        }

        const effectiveContent = mode === 'deep-search'
          ? `You are an expert deep research analyst. The user wants a thorough, well-structured research report.

TASK: ${content}

Produce a comprehensive response with ALL of the following sections (use markdown headers):
## Overview
A concise summary of the topic.

## Key Facts & Details
Bullet-pointed facts, data, and specifics.

## In-Depth Analysis
Detailed explanation covering multiple angles, causes, effects, or components.

## Different Perspectives
Present 2-3 different viewpoints or approaches if applicable.

## Practical Implications / Use Cases
Real-world applications or relevance.

## Summary & Conclusion
Wrap up with key takeaways.

Be thorough, accurate, and cite any well-known sources where relevant. Use clear markdown formatting throughout.`

          : mode === 'canvas'
          ? `You are an expert frontend web developer. Build exactly what the user describes.

REQUIREMENTS:
- Return ONLY a single complete self-contained HTML file
- Embed ALL CSS in a <style> tag and ALL JS in a <script> tag
- Use modern, beautiful design with smooth animations
- Make it fully responsive (mobile-friendly)
- Use CDN links for any libraries (Tailwind, Chart.js, etc.) if needed
- NO explanations outside the HTML — start with <!DOCTYPE html>
- Make it visually impressive and fully functional

User request: ${content}`

          : mode === 'web-search'
          ? webContext
            ? `You are a helpful AI with access to real-time web search results.

USER QUERY: "${content}"

SEARCH RESULTS FROM THE WEB:
${webContext}

INSTRUCTIONS:
- Answer the user's query using the search results above as your primary source
- Synthesize information from multiple sources where available
- Be specific, accurate, and cite sources with links where provided
- If the search results are incomplete, supplement with your knowledge but clearly indicate what is from search vs your training
- Format your response clearly with headers if the answer is complex
- Always mention the sources at the end`
            : `The user searched for: "${content}"\n\nWeb search returned no results. Answer based on your training knowledge and clearly note that live search was unavailable.`

          : content

        const fullText = await streamWithFallback(
          existingMessages,
          effectiveContent,
          images,
          setStreamingContent,
          mode === 'deep-search' || mode === 'canvas' ? 8192 : 4096,
          signal
        )

        const htmlMatch = fullText.match(/<!DOCTYPE html[\s\S]*<\/html>/i)
        const canvasHtml = mode === 'canvas' && htmlMatch ? htmlMatch[0] : undefined

        const aiMsg: Message = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: canvasHtml ? '' : fullText,
          canvasHtml,
          timestamp: new Date(),
        }

        let finalChat: Chat | undefined
        setChats((prev) => {
          const updated = prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, aiMsg] } : c)
          if (!userId) saveLocalChats(updated)
          finalChat = updated.find((c) => c.id === chatId)
          return updated
        })
        if (userId && finalChat) upsertFirestoreChat(userId, finalChat)

      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          // Use refs to get current streaming values (avoids stale closure)
          const partialContent = streamingContentRef.current
          const partialThinking = streamingThinkingRef.current
          if (partialContent || partialThinking) {
            const aiMsg: Message = {
              id: String(Date.now() + 1),
              role: 'assistant',
              content: partialContent,
              thinking: partialThinking || undefined,
              timestamp: new Date(),
            }
            let finalChat: Chat | undefined
            setChats((prev) => {
              const updated = prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, aiMsg] } : c)
              if (!userId) saveLocalChats(updated)
              finalChat = updated.find((c) => c.id === chatId)
              return updated
            })
            if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
          }
          return
        }
        const errorMsg: Message = {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Failed to get response. Check your API key.'}`,
          timestamp: new Date(),
        }
        let finalChat: Chat | undefined
        setChats((prev) => {
          const updated = prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, errorMsg] } : c)
          if (!userId) saveLocalChats(updated)
          finalChat = updated.find((c) => c.id === chatId)
          return updated
        })
        if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
      } finally {
        abortControllerRef.current = null
        setIsTyping(false)
        setStreamingContent('')
        setStreamingThinking('')
      }
    },
    [activeChatId, chats, userId]
  )

  const regenerate = useCallback(async () => {
    if (!activeChatId) return
    const chat = chats.find((c) => c.id === activeChatId)
    if (!chat || chat.messages.length < 2) return

    const messagesWithoutLast = chat.messages.slice(0, -1)
    const lastUserMsg = messagesWithoutLast[messagesWithoutLast.length - 1]
    if (!lastUserMsg || lastUserMsg.role !== 'user') return

    setChats((prev) => {
      const updated = prev.map((c) => c.id === activeChatId ? { ...c, messages: messagesWithoutLast } : c)
      if (!userId) saveLocalChats(updated)
      return updated
    })
    setIsTyping(true)
    setStreamingContent('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const history = messagesWithoutLast.slice(0, -1)
      const fullText = await streamWithFallback(history, lastUserMsg.content, lastUserMsg.images ?? [], setStreamingContent, 4096, controller.signal)
      const aiMsg: Message = { id: String(Date.now()), role: 'assistant', content: fullText, timestamp: new Date() }
      let finalChat: Chat | undefined
      setChats((prev) => {
        const updated = prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, aiMsg] } : c)
        if (!userId) saveLocalChats(updated)
        finalChat = updated.find((c) => c.id === activeChatId)
        return updated
      })
      if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      const errorMsg: Message = {
        id: String(Date.now()),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Regeneration failed.'}`,
        timestamp: new Date(),
      }
      let finalChat: Chat | undefined
      setChats((prev) => {
        const updated = prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, errorMsg] } : c)
        if (!userId) saveLocalChats(updated)
        finalChat = updated.find((c) => c.id === activeChatId)
        return updated
      })
      if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
    } finally {
      abortControllerRef.current = null
      setIsTyping(false)
      setStreamingContent('')
    }
  }, [activeChatId, chats, userId])

  // Edit a user message: truncate history to that point and resend
  const editMessage = useCallback(async (messageIndex: number, newContent: string) => {
    if (!activeChatId) return
    const chat = chats.find((c) => c.id === activeChatId)
    if (!chat) return

    const historyBefore = chat.messages.slice(0, messageIndex)
    const originalMsg = chat.messages[messageIndex]
    const updatedUserMsg: Message = { ...originalMsg, content: newContent, id: String(Date.now()) }
    const truncated = [...historyBefore, updatedUserMsg]

    setChats((prev) => {
      const updated = prev.map((c) => c.id === activeChatId ? { ...c, messages: truncated } : c)
      if (!userId) saveLocalChats(updated)
      return updated
    })

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsTyping(true)
    setStreamingContent('')

    try {
      const fullText = await streamWithFallback(historyBefore, newContent, originalMsg.images ?? [], setStreamingContent, 4096, controller.signal)
      const aiMsg: Message = { id: String(Date.now() + 1), role: 'assistant', content: fullText, timestamp: new Date() }
      let finalChat: Chat | undefined
      setChats((prev) => {
        const updated = prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, aiMsg] } : c)
        if (!userId) saveLocalChats(updated)
        finalChat = updated.find((c) => c.id === activeChatId)
        return updated
      })
      if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get response.'}`,
        timestamp: new Date(),
      }
      let finalChat: Chat | undefined
      setChats((prev) => {
        const updated = prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, errorMsg] } : c)
        if (!userId) saveLocalChats(updated)
        finalChat = updated.find((c) => c.id === activeChatId)
        return updated
      })
      if (userId && finalChat) upsertFirestoreChat(userId, finalChat)
    } finally {
      abortControllerRef.current = null
      setIsTyping(false)
      setStreamingContent('')
    }
  }, [activeChatId, chats, userId])

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const clearAllChats = useCallback(() => {
    setChats([])
    setActiveChatId(null)
    if (userId) {
      deleteAllFirestoreChats(userId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(ACTIVE_KEY)
    }
  }, [userId])

  return {
    chats, activeChat, activeChatId, isTyping, streamingContent, streamingThinking, loaded,
    setActiveChatId, createChat, deleteChat, renameChat,
    sendMessage, regenerate, editMessage, clearAllChats, stopGeneration,
    isGuest, guestMessageCount, guestLimitReached, guestMessageLimit: GUEST_MESSAGE_LIMIT,
  }
}
