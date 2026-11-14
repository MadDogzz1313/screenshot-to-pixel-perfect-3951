// Google AdMob Rewarded Ads für Leonida Fishing (nur iPhone-App). Belohnung vergibt ausschließlich der Server (SQL 037):
//   live  → nur nach Google Server-Side Verification (SSV) über das Emergent-Backend /api/admob/ssv
//   test  → Googles offizielle Testanzeigen + klar gekennzeichneter Testablauf (claim_ad_reward_test)
//   off   → Angebote ausgeblendet
// Modus und produktive Anzeigenblöcke stehen zentral in public.ad_reward_config (Admin-Bereich „Werbung (AdMob)“).
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useQuery } from "@tanstack/react-query";
import { isMissing, sb } from "./db";
import { tr } from "@/lib/i18n";

export type AdPlacement = "fishing_bonus_casts" | "fishing_special_bait";
export type AdMode = "off" | "test" | "live";
export interface AdRewardState {
  mode: AdMode; logged_in?: boolean; next_reset_at?: string;
  bonus?: { used: number; limit: number; amount: number }; bait?: { used: number; limit: number; bait_id: string };
}
interface AdSession { session_id: string; mode: "test" | "live"; ad_unit_id: string | null; remaining: number }
interface AdSessionStatus { session_id: string; status: "pending" | "granted" | "expired"; reward?: Record<string, unknown> | null; already_processed?: boolean }

/** Leonida Explorer fordert AUSSCHLIESSLICH nicht personalisierte Werbung an – unabhängig von der UMP-Einwilligung.
 *  Umsetzung (Plugin @capacitor-community/admob 8.3.0): jede Anfrage mit `npa: true` (Request-Extra npa=1) +
 *  nativ `publisherPrivacyPersonalizationState = .disabled` (scripts/admob-npa-patch.mjs, Codemagic). Keine ATT-Abfrage.
 *  Google wendet immer das restriktivste Signal an – eine Zustimmung im UMP-Formular hebt das nicht auf. */
export const NON_PERSONALIZED_ADS = true as const;

/** Offizielle Google-Testanzeigenblöcke (iOS Rewarded). Werden im Testmodus IMMER verwendet. */
export const GOOGLE_TEST_REWARDED_IOS = "ca-app-pub-3940256099942544/1712485313";
const PENDING_KEY = "leonida-ad-pending";

export const adRewardKey = (uid: string | undefined) => ["ad-reward-state", uid ?? "guest"] as const;
export const adsSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("AdMob");

export function useAdRewardState(uid: string | undefined, enabled = true) {
  return useQuery({ queryKey: adRewardKey(uid), enabled: !!uid && enabled, staleTime: 30_000, queryFn: async (): Promise<AdRewardState> => {
    const { data, error } = await sb.rpc("my_ad_reward_state");
    if (error) { if (isMissing(error)) return { mode: "off" }; throw error; }
    return data as AdRewardState;
  } });
}

/** Verbleibende „+5 Fänge“-Werbungen heute (0 = Angebot ausgeschöpft / Werbung aus). Limit prüft der Server (SQL 037). */
export function bonusAdsLeft(s: AdRewardState | undefined) {
  if (!s || s.mode === "off" || !s.logged_in || !s.bonus) return 0;
  return Math.max(0, s.bonus.limit - s.bonus.used);
}

export class AdError extends Error { constructor(public code: string, public detail?: string) { super(code); } }
const errText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : (e as { message?: string })?.message ?? "").slice(0, 160);
/** Technischer Hinweis für die Fehlermeldung (hilft bei der Fehlersuche in TestFlight). */
export function adErrorDetail(e: unknown): string | undefined {
  if (e instanceof AdError) return e.detail ? `${e.code}: ${e.detail}` : e.code;
  const m = errText(e); return m || undefined;
}
export function adErrorMessage(e: unknown): string {
  const m = e instanceof AdError ? e.code : (e as { message?: string })?.message ?? "";
  if (m.includes("AD_DAILY_LIMIT")) return tr("Tageslimit erreicht. Morgen gibt es neue Werbebelohnungen.");
  if (m.includes("NO_FILL")) return tr("Momentan ist keine Werbung verfügbar. Versuche es später erneut.");
  if (m.includes("NOT_COMPLETED")) return tr("Werbung nicht abgeschlossen. Keine Belohnung vergeben.");
  if (m.includes("VERIFYING")) return tr("Belohnung wird überprüft … Sie wird automatisch gutgeschrieben.");
  if (m.includes("CONSENT")) return tr("Ohne Werbe-Einwilligung kann keine Werbung geladen werden.");
  if (m.includes("SDK_INIT")) return tr("Werbung konnte nicht gestartet werden. Bitte App neu öffnen.");
  if (m.includes("ADS_DISABLED")) return tr("Werbebelohnungen sind gerade deaktiviert.");
  if (/fetch|network|load failed|offline/i.test(m)) return tr("Keine Internetverbindung. Bitte später erneut versuchen.");
  return tr("Momentan ist keine Werbung verfügbar. Versuche es später erneut.");
}

const rpc = async <T,>(fn: string, args?: Record<string, unknown>, tries = 1): Promise<T> => {
  for (let i = 1; ; i++) {
    const { data, error } = await sb.rpc(fn, args);
    if (!error) return data as T;
    const final = /AD_|ADS_|FORBIDDEN|ACCOUNT_|NOT_AUTH|42501|PGRST20/.test(`${error.code ?? ""} ${error.message ?? ""}`);
    if (i >= tries || final) throw error;
    await new Promise((r) => setTimeout(r, 800 * i));
  }
};

type AdMobModule = typeof import("@capacitor-community/admob");
let admob: Promise<AdMobModule> | null = null;
let ready: Promise<{ privacyOptionsRequired: boolean }> | null = null;
const loadAdMob = () => (admob ??= import("@capacitor-community/admob"));

/** Einwilligung (Google UMP: EWR/UK/Schweiz) → SDK starten. Nur nicht-personalisierte Werbung, keine Tracking-Abfrage.
 *  Schlägt die UMP-Abfrage fehl (z. B. noch keine DSGVO-Mitteilung in AdMob veröffentlicht), wird trotzdem gestartet –
 *  Google entscheidet dann selbst, ob (eingeschränkte) Werbung ausgeliefert wird. Keine Belohnung ohne echtes Reward-Ereignis. */
export function initAds(mode: "test" | "live") {
  ready ??= (async () => {
    const { AdMob, AdmobConsentStatus, MaxAdContentRating } = await loadAdMob().catch((e) => { throw new AdError("SDK_INIT", `import: ${errText(e)}`); });
    let info: Awaited<ReturnType<typeof AdMob.requestConsentInfo>> | null = null;
    let consentOk = true;
    try {
      info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false });
      if (!info.canRequestAds && info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
        const shown = await AdMob.showConsentForm();
        if (!shown.canRequestAds) throw new AdError("CONSENT");
        info = { ...info, ...shown };
      }
    } catch (e) {
      if (e instanceof AdError) throw e;
      consentOk = false; // UMP nicht verfügbar → ohne Formular weiter, beim nächsten Mal erneut versuchen
      console.warn("[ads] Einwilligungsabfrage fehlgeschlagen:", errText(e));
    }
    try {
      await AdMob.initialize({ initializeForTesting: mode === "test", maxAdContentRating: MaxAdContentRating.Teen, tagForChildDirectedTreatment: false });
    } catch (e) { throw new AdError("SDK_INIT", errText(e)); }
    if (!consentOk) ready = null;
    return { privacyOptionsRequired: String(info?.privacyOptionsRequirementStatus) === "REQUIRED" };
  })().catch((e) => { ready = null; throw e instanceof AdError ? e : new AdError("SDK_INIT", errText(e)); });
  return ready;
}
/** Nur Status lesen (kein Formular, keine Anzeige): braucht der Nutzer den Button „Werbe-Datenschutz“? */
export async function adPrivacyOptionsRequired() {
  const { AdMob } = await loadAdMob();
  const info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: false });
  return String(info.privacyOptionsRequirementStatus) === "REQUIRED";
}
export async function showAdPrivacyOptions() { const { AdMob } = await loadAdMob(); await AdMob.showPrivacyOptionsForm(); }

/** Wartet auf das offizielle Reward-Ereignis. Vorzeitiges Schließen = kein Reward. */
async function playRewarded(adId: string, testing: boolean, userId: string, sessionId: string): Promise<boolean> {
  const { AdMob, RewardAdPluginEvents } = await loadAdMob();
  try {
    await AdMob.prepareRewardVideoAd({ adId, isTesting: testing, npa: NON_PERSONALIZED_ADS, ssv: { userId, customData: sessionId } });
  } catch (e) { throw new AdError("NO_FILL", errText(e)); }
  const handles: PluginListenerHandle[] = [];
  let rewarded = false;
  try {
    return await new Promise<boolean>((resolve) => {
      let closed = false;
      const done = () => { if (closed) return; closed = true; window.setTimeout(() => resolve(rewarded), 400); };
      void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }).then((h) => handles.push(h));
      void AdMob.addListener(RewardAdPluginEvents.Dismissed, done).then((h) => handles.push(h));
      void AdMob.addListener(RewardAdPluginEvents.FailedToShow, done).then((h) => handles.push(h));
      // resolve() kommt nur bei verdienter Belohnung; bei vorzeitigem Schließen bleibt es offen → Dismissed entscheidet
      AdMob.showRewardVideoAd().then((r) => { if (r && Number(r.amount) >= 0) rewarded = true; }).catch(done);
    });
  } finally { handles.forEach((h) => void h.remove()); }
}

function rememberPending(sessionId: string, mode: "test" | "live") { try { localStorage.setItem(PENDING_KEY, JSON.stringify({ sessionId, mode, at: Date.now() })); } catch { /* privat */ } }
function forgetPending() { try { localStorage.removeItem(PENDING_KEY); } catch { /* privat */ } }

async function confirm(sessionId: string, mode: "test" | "live"): Promise<AdSessionStatus> {
  if (mode === "test") return rpc<AdSessionStatus>("claim_ad_reward_test", { _session: sessionId }, 4);
  // live: Google meldet die Belohnung direkt an unseren Server (SSV) – wir warten auf die Bestätigung
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    const s = await rpc<AdSessionStatus>("my_ad_reward_session", { _session: sessionId }, 2).catch(() => null);
    if (s?.status === "granted") return s;
    if (s?.status === "expired") throw new AdError("AD_DAILY_LIMIT");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new AdError("VERIFYING");
}

/** Kompletter Ablauf: Limit prüfen → Anzeige laden/zeigen → Reward-Ereignis → Server-Bestätigung. */
export async function watchRewardedAd(placement: AdPlacement, userId: string): Promise<AdSessionStatus> {
  const session = await rpc<AdSession>("start_ad_reward", { _placement: placement }, 2);
  await initAds(session.mode);
  const adId = session.mode === "test" ? GOOGLE_TEST_REWARDED_IOS : session.ad_unit_id;
  if (!adId) throw new AdError("NO_FILL");
  const rewarded = await playRewarded(adId, session.mode === "test", userId, session.session_id);
  if (!rewarded) throw new AdError("NOT_COMPLETED");
  rememberPending(session.session_id, session.mode); // geht bei Verbindungsabbruch nicht verloren
  const result = await confirm(session.session_id, session.mode);
  forgetPending();
  return result;
}

/** Beim Öffnen des Spiels: unterbrochene Bestätigung nachholen (z. B. Verbindung nach dem Reward weg). */
export async function resumePendingAdReward(): Promise<AdSessionStatus | null> {
  let p: { sessionId: string; mode: "test" | "live"; at: number } | null = null;
  try { p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null"); } catch { p = null; }
  if (!p?.sessionId) return null;
  if (Date.now() - p.at > 6 * 3600_000) { forgetPending(); return null; }
  try {
    const s = p.mode === "test" ? await rpc<AdSessionStatus>("claim_ad_reward_test", { _session: p.sessionId }, 2)
      : await rpc<AdSessionStatus>("my_ad_reward_session", { _session: p.sessionId }, 2);
    if (s.status !== "pending") forgetPending();
    return s.status === "granted" ? s : null;
  } catch (e) {
    if (/AD_/.test((e as { message?: string })?.message ?? "")) forgetPending();
    return null;
  }
}
