const CACHE_NAME = 'hotspot-v2'
const ASSETS = [
    '/hotspot/',
    '/hotspot/index.html',
    '/hotspot/manifest.json',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    )
    self.clients.claim()
})

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('hotspot.maxxarena.de') ||
        event.request.url.includes('connectivitycheck') ||
        event.request.url.includes('api.ipify.org')) {
        return
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone()
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                }
                return response
            }).catch(() => cached)

            return cached || fetched
        })
    )
})
