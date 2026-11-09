// Web Push (SQL 010 + backend/routers/push.py). Der private VAPID-Schlüssel liegt nur im Backend;
// hier wird nur der öffentliche Schlüssel genutzt. Versand löst ausschließlich die Datenbank aus.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";

export interface PushPrefs { enabled: boolean; friend_request: boolean; friend_accepted: boolean; private_message: boolean; inbox: boolean; community: boolean; show_preview: boolean }
export const DEFAULT_PREFS: PushPrefs = { enabled: true, friend_request: true, friend_accepted: true, private_message: true, inbox: true, community: true, show_preview: false };

export type PushSupport = "ok" | "ios-browser" | "insecure" | "unsupported";
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Prüft HTTPS, Service Worker, Push API, Notifications API und (iPhone) Home-Screen-Installation */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  const apis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !isStandalone()) return "ios-browser";
  return apis ? "ok" : "unsupported";
}

const b64ToBytes = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const toB64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

async function registration() {
  // In der Vorschau registriert die App den Service Worker nicht automatisch – für Push bei Bedarf nachholen
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}
export async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  return (await registration()).pushManager.getSubscription();
}
async function saveSubscription(sub: PushSubscription) {
  const { error } = await sb.rpc("push_subscribe", { _endpoint: sub.endpoint, _p256dh: toB64(sub.getKey("p256dh")), _auth: toB64(sub.getKey("auth")), _user_agent: navigator.userAgent.slice(0, 300) });
  if (error) throw error;
}

/** Nur nach bewusster Nutzeraktion aufrufen (Button) – fragt die Systemberechtigung an und registriert dieses Gerät */
export async function enablePushOnDevice(): Promise<"granted" | "denied" | "default"> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const res = await fetch("/api/push/public-key", { cache: "no-store" });
  if (!res.ok) throw new Error("PUSH_NOT_CONFIGURED");
  const { publicKey } = (await res.json()) as { publicKey: string };
  const reg = await registration();
  if (reg.waiting) throw new Error("PUSH_UPDATE_FIRST");   // erst neue App-Version übernehmen (enthält den Push-Empfang)
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  await saveSubscription(sub);
  return "granted";
}
export async function disablePushOnDevice() {
  const sub = await currentSubscription();
  if (!sub) return;
  await sb.rpc("push_unsubscribe", { _endpoint: sub.endpoint });
  await sub.unsubscribe();
}
/** Beim Abmelden: Gerät vom Konto lösen, damit keine Mitteilungen an den falschen Nutzer gehen */
export async function detachPushOnLogout() { try { await disablePushOnDevice(); } catch { /* offline o. Ä. – Server bereinigt später */ } }
/** Beim App-Start: bestehendes Abo erneut speichern (erneuerte/abgelaufene Abos, Gerätewechsel zwischen Konten) */
export async function syncPushSubscription() {
  try { if (pushSupport() === "ok" && Notification.permission === "granted") { const sub = await currentSubscription(); if (sub) await saveSubscription(sub); } } catch { /* ignorieren */ }
}

export function usePushPrefs(userId: string | undefined) {
  return useQuery({
    queryKey: ["push-prefs", userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sb.from("push_preferences").select("enabled, friend_request, friend_accepted, private_message, inbox, community, show_preview").maybeSingle();
      if (error) { if (isMissing(error)) return null; throw error; }
      return (data as PushPrefs | null) ?? DEFAULT_PREFS;
    },
  });
}
export function useSavePushPrefs(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: PushPrefs) => {
      const { error } = await sb.rpc("push_set_preferences", { _enabled: p.enabled, _friend_request: p.friend_request, _friend_accepted: p.friend_accepted, _private_message: p.private_message, _inbox: p.inbox, _community: p.community, _show_preview: p.show_preview });
      if (error) throw error;
    },
    onMutate: (p) => qc.setQueryData(["push-prefs", userId], p),
    onSettled: () => qc.invalidateQueries({ queryKey: ["push-prefs", userId] }),
  });
}
export async function sendTestPush() {
  const { error } = await sb.rpc("push_send_test");
  if (error) throw error;
}

/** Push-Ziel merken, falls der Nutzer beim Antippen nicht angemeldet ist (sicher: nur interne Pfade) */
const NEXT_KEY = "leonida-push-next";
export function rememberPushTarget() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("from") !== "push") return;
  url.searchParams.delete("from");
  const target = url.pathname + (url.search ? url.search : "");
  if (target.startsWith("/") && !target.startsWith("//")) sessionStorage.setItem(NEXT_KEY, target);
  window.history.replaceState(window.history.state, "", target);
}
export function peekPushTarget() { return sessionStorage.getItem(NEXT_KEY); }
export function takePushTarget() { const t = sessionStorage.getItem(NEXT_KEY); sessionStorage.removeItem(NEXT_KEY); return t; }
