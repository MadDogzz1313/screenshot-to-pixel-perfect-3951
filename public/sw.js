const CACHE_PREFIX = "leonida-runtime-";

self.addEventListener("install", () => {
  // Keep a newer worker waiting until the user confirms the visible update prompt.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first with an explicit no-store request prevents stale HTML, manifests,
  // Vite assets and API reads from becoming a permanent Home-Screen app snapshot.
  event.respondWith(
    fetch(new Request(request, { cache: "no-store" })).catch(() => caches.match(request)),
  );
});
