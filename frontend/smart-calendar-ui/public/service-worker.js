const CACHE_NAME = 'smart-calendar-shell-v2'
const APP_SHELL = './'

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(APP_SHELL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not cache the app shell: HTTP ${response.status}`)
        const html = await response.clone().text()
        const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
          .map((match) => new URL(match[1], self.registration.scope).toString())
        const cache = await caches.open(CACHE_NAME)
        await cache.put(APP_SHELL, response)
        await cache.addAll(assets)
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('smart-calendar-shell-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const requestUrl = new URL(request.url)
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy))
          return response
        })
        .catch(async () => (await caches.match(request)) ?? (await caches.match(APP_SHELL))),
    )
    return
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
