self.addEventListener('activate', function(evt) {
  console.log('[ServiceWorker] Activate');
});

self.addEventListener('fetch', function(evt) {
  console.log('[ServiceWorker] Fetch', evt.request.url);
});