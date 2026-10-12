// アプリ本体(同一オリジンの静的ファイル)をキャッシュして、オフラインでも開けるようにする。
// OCR ライブラリや言語データなど外部のものは扱わない(Tesseract 側が自前でキャッシュする)。
const CACHE = 'book-memo-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/main.js', './src/db.js', './src/model.js', './src/image.js', './src/settings.js',
  './src/ocr/index.js', './src/ocr/tesseract.js', './src/ocr/claude.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // 先にネットワーク、失敗したらキャッシュ(更新を取りこぼさないため)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
