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

// ---------- Web Push (echte Systemmitteilungen, auch wenn die App geschlossen ist) ----------
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Leonida Explorer";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
  }));
});

// Antippen: App öffnen bzw. nach vorne holen und direkt zum Ziel (Anfrage, Chat, Profil, Glocke) springen
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  target.searchParams.set("from", "push");
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      if ("navigate" in client) { try { await client.navigate(target.href); return; } catch { /* weiter mit openWindow */ } }
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});
