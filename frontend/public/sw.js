const CACHE_NAME = 'fokus-shell-v3'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/fokus-logo.png',
  '/icons/fokus-192.png',
  '/icons/fokus-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)
  // No cachear módulos de Vite si el usuario activa Push durante desarrollo local.
  if (/^\/(?:@vite|@react-refresh|src|node_modules)(?:\/|$)/.test(requestUrl.pathname)) return
  const isApiRequest = requestUrl.pathname.startsWith('/api/')

  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin || isApiRequest) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
      }
      return response
    })),
  )
})

// Recepción remota independiente de las ventanas de Fokus.
self.addEventListener('push', (event) => {
  let payload
  try { payload = event.data?.json() } catch { payload = null }
  const valid = payload && typeof payload.title === 'string' && typeof payload.body === 'string'
  const title = valid ? payload.title.slice(0, 120) : 'Fokus'
  const body = valid ? payload.body.slice(0, 2000) : 'Recibiste una notificación de Fokus. Abrí la aplicación para verla.'
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: '/icons/fokus-192.png', badge: '/icons/fokus-192.png',
    ...(typeof payload?.id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(payload.id) ? { tag: 'fokus-push-' + payload.id } : {}),
    data: { source: 'fokus', test: payload?.data?.test === true },
  }))
})

self.addEventListener('notificationclick', (event) => {
  if (event.notification.data?.test !== true && event.notification.data?.source !== 'fokus') return
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      await client.focus()
      if ('navigate' in client) await client.navigate('/notifications/preferences')
      return
    }
    return self.clients.openWindow('/notifications/preferences')
  }))
})
