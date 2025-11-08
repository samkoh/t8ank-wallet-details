// Service Worker for PWA
const CACHE_NAME = 'wallet-monitor-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.js',
  '/styles.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Try to cache resources, but don't fail if some fail
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.log('Failed to cache:', url, err);
              return null;
            })
          )
        );
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // For external API requests (like OKX, DexScreener), always fetch from network
  const url = new URL(event.request.url);
  const isExternalAPI = url.origin !== self.location.origin;
  
  if (isExternalAPI) {
    // For external APIs, just fetch from network, don't cache
    event.respondWith(
      fetch(event.request).catch(err => {
        console.log('External API fetch failed:', event.request.url, err);
        // Return a basic error response
        return new Response(JSON.stringify({ error: 'Network error' }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // For local resources, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(event.request).catch(err => {
          console.log('Fetch failed for:', event.request.url, err);
          // Return a basic response for failed fetches
          return new Response('Network error', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

