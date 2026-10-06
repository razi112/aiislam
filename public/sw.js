const CACHE = 'minnal-ai-v2'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Only handle GET requests to same origin — never intercept cross-origin or API calls
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  // Skip Vite dev server HMR and internal requests
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Only cache valid responses
        if (!res || res.status !== 200 || res.type === 'opaque') return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
        return res
      })
      .catch(() => caches.match(e.request).then(cached => cached ?? Response.error()))
  )
})
