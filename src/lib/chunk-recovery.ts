// Schutz vor veralteten App-Dateien nach einer neuen Veröffentlichung.
// Ursache (iPhone-App): Die App lädt die Live-Website ohne Service Worker. Die iOS-WebView hält die alte Startseite
// samt altem Haupt-Skript im Zwischenspeicher. Nach einer neuen Veröffentlichung gibt es die alten Seiten-Dateien
// (z. B. /assets/community-ALT.js) nicht mehr – der Server liefert stattdessen HTML, der Import scheitert und es
// erschien „This page didn't load“. Lösung: alte Version erkennen und die Seite frisch (am Zwischenspeicher vorbei) laden.
import { isNativeApp } from "./native";

const PARAM = "_fresh";
const GUARD_KEY = "leonida-fresh-reload-at";
const GUARD_MS = 60_000;
let stale = false;

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|not a valid JavaScript MIME type|Expected a JavaScript/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

const freshUrl = (href: string) => {
  const url = new URL(href, window.location.origin);
  url.searchParams.set(PARAM, Date.now().toString(36));
  return url.toString();
};

/** Lädt die Seite mit eindeutiger Adresse neu (umgeht den Zwischenspeicher). Höchstens einmal pro Minute, außer force. */
export function reloadFresh(href = window.location.href, force = false): boolean {
  const last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
  if (!force && Date.now() - last < GUARD_MS) return false;
  sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  window.location.replace(freshUrl(href));
  return true;
}

/** Bei einer als veraltet erkannten Version: nächster Seitenwechsel lädt frisch (keine Eingaben gehen verloren). */
export function freshNavigationTarget(href: string): boolean {
  if (!stale) return false;
  stale = false;
  return reloadFresh(href, true);
}

const ENTRY = /\/assets\/index-[\w-]+\.js/;
const currentEntry = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]")).map((s) => s.getAttribute("src") ?? "").find((src) => ENTRY.test(src))?.match(ENTRY)?.[0];

async function checkLatestVersion(onNew: () => void) {
  const mine = currentEntry();
  if (!mine) return;   // Entwicklungsmodus
  try {
    const res = await fetch(freshUrl("/"), { cache: "no-store" });
    const latest = (await res.text()).match(ENTRY)?.[0];
    if (latest && latest !== mine) onNew();
  } catch { /* offline – später erneut */ }
}

function install() {
  // Erfolgreicher Frisch-Ladevorgang: Hilfsparameter wieder aus der Adresse entfernen (bevor der Router sie liest)
  const url = new URL(window.location.href);
  if (url.searchParams.has(PARAM)) {
    url.searchParams.delete(PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }
  // Vite meldet fehlgeschlagene Seiten-Dateien hier – sofort frisch laden statt Fehlerseite
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadFresh()) event.preventDefault();
  });
  if (!isNativeApp()) return;   // Browser/PWA: der Service Worker lädt ohnehin immer frisch
  // iPhone-App: beim Start veraltete Version sofort ersetzen, beim Zurückkehren in die App beim nächsten Seitenwechsel
  void checkLatestVersion(() => reloadFresh());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkLatestVersion(() => { stale = true; });
  });
}

if (typeof window !== "undefined") install();
