const CACHE_NAME = 'dubdub22-cache-v7';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Only handle GET requests, skip non-http(s)
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    // Don't cache API calls
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        fetch(event.request.clone())
            .then(response => {
                // Cache static assets (JS, CSS, images) but not HTML
                const url = new URL(event.request.url);
                if (url.pathname.startsWith('/assets/')) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    // Last resort: return a minimal offline response for navigation requests
                    if (event.request.mode === 'navigate') {
                        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    }
                    return new Response('', { status: 503 });
                });
            })
    );
});
