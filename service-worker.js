/* 排便日記 PWA Service Worker（方法A）
 * - 預先快取核心檔案
 * - 線上：stale-while-revalidate（先快取回應、背景更新）
 * - 離線：至少能打開首頁與圖示
 */
const CACHE_NAME = "poop-diary-pwa-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 清理舊快取
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

// 工具：判斷是否為同網域導覽請求（離線時回首頁用）
function isNavigationRequest(request) {
  return request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 只處理 GET
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 導覽請求：離線時至少回首頁
    if (isNavigationRequest(req)) {
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match("./index.html")) || (await cache.match("./"));
      }
    }

    // 其他資源：stale-while-revalidate
    const cached = await cache.match(req, { ignoreSearch: true });
    const fetchPromise = fetch(req)
      .then((res) => {
        // 不快取錯誤回應
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => undefined);

    return cached || (await fetchPromise) || cached;
  })());
});
