import { useEffect, useState } from "react";
import { BellRing, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { DEFAULT_PREFS, currentSubscription, disablePushOnDevice, enablePushOnDevice, pushSupport, sendTestPush, usePushPrefs, useSavePushPrefs, type PushPrefs } from "@/lib/push";

const CATEGORIES: { k: keyof PushPrefs; l: string }[] = [
  { k: "friend_request", l: "Freundschaftsanfragen" },
  { k: "friend_accepted", l: "Angenommene Freundschaftsanfragen" },
  { k: "private_message", l: "Private Chatnachrichten" },
  { k: "inbox", l: "Private Postfach-Mitteilungen" },
  { k: "community", l: "Wichtige Community-Mitteilungen" },
];
const ERR: Record<string, string> = { PUSH_NO_DEVICE: "Auf diesem Konto ist noch kein Gerät für Push aktiviert.", PUSH_NOT_CONFIGURED: "Push ist auf dem Server noch nicht eingerichtet.", RATE_LIMIT: "Bitte warte ein paar Minuten bis zum nächsten Test." };
const errText = (e: unknown) => { const m = (e as { message?: string }).message ?? ""; return Object.entries(ERR).find(([k]) => m.includes(k))?.[1] ?? "Das hat nicht geklappt. Bitte versuche es erneut."; };

/** Profil → Einstellungen → Benachrichtigungen (echte System-Push-Mitteilungen) */
export function PushSettings() {
  const { user } = useStore();
  const prefs = usePushPrefs(user?.id);
  const save = useSavePushPrefs(user?.id);
  const [support, setSupport] = useState<ReturnType<typeof pushSupport>>("unsupported");
  const [permission, setPermission] = useState<NotificationPermission | "n/a">("n/a");
  const [subscribed, setSubscribed] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const s = pushSupport(); setSupport(s);
    if (s === "ok") { setPermission(Notification.permission); void currentSubscription().then((sub) => setSubscribed(!!sub)); }
  }, []);
  if (!user) return null;
  const p = prefs.data ?? DEFAULT_PREFS;
  const set = (patch: Partial<PushPrefs>) => save.mutate({ ...p, ...patch }, { onError: () => toast.error("Einstellung konnte nicht gespeichert werden.") });
  const enable = async () => {
    setBusy(true);
    try {
      const r = await enablePushOnDevice(); setPermission(r);
      if (r === "granted") { setSubscribed(true); if (!p.enabled) set({ enabled: true }); toast.success("Push-Benachrichtigungen sind auf diesem Gerät aktiv."); }
      else toast.error("Mitteilungen wurden nicht erlaubt. Du kannst das in den iPhone-Einstellungen → Mitteilungen → Leonida Explorer ändern.");
    } catch (e) { toast.error((e as Error).message === "PUSH_UPDATE_FIRST" ? "Bitte tippe zuerst auf „Jetzt aktualisieren“, um die neue App-Version zu laden." : "Push konnte nicht aktiviert werden. Bitte versuche es erneut."); }
    finally { setBusy(false); }
  };
  const disableDevice = async () => { setBusy(true); try { await disablePushOnDevice(); setSubscribed(false); toast.success("Push auf diesem Gerät deaktiviert."); } finally { setBusy(false); } };

  return <div data-testid="push-settings" className="space-y-3 border-t border-border pt-3">
    <p className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-neon" />Benachrichtigungen</p>
    {prefs.data === null && <p className="text-xs text-muted-foreground">Push wird nach dem Datenbank-Update (SQL 010) aktiv. Die Glocke funktioniert unabhängig davon.</p>}
    {support === "ios-browser" && <div data-testid="push-install-hint" className="space-y-2 rounded-2xl border border-neon/40 bg-primary/10 p-3 text-sm">
      <p className="font-semibold">Auf dem iPhone funktionieren Push-Mitteilungen nur in der installierten App (ab iOS 16.4).</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Öffne Leonida Explorer in <b>Safari</b>.</li>
        <li>Tippe unten auf <Share className="inline h-3.5 w-3.5" /> <b>Teilen</b>.</li>
        <li>Wähle <SquarePlus className="inline h-3.5 w-3.5" /> <b>Zum Home-Bildschirm</b> und tippe auf <b>Hinzufügen</b>.</li>
        <li>Öffne Leonida Explorer über das neue Symbol und aktiviere hier Push.</li>
      </ol></div>}
    {support === "insecure" && <p className="text-xs text-muted-foreground">Push benötigt eine sichere HTTPS-Verbindung.</p>}
    {support === "unsupported" && <p data-testid="push-unsupported" className="text-xs text-muted-foreground">Dieses Gerät oder dieser Browser unterstützt keine Web-Push-Mitteilungen.</p>}
    {support === "ok" && (permission === "denied"
      ? <p data-testid="push-denied" className="rounded-2xl border border-accent/40 bg-accent/10 p-3 text-xs text-accent">Mitteilungen sind für Leonida Explorer blockiert. Erlaube sie in den Geräte-Einstellungen → Mitteilungen → Leonida Explorer.</p>
      : !subscribed
        ? <button type="button" data-testid="push-enable-button" disabled={busy || prefs.data === null} onClick={enable} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_18px_oklch(0.7_0.3_345/0.5)] transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"><BellRing className="h-5 w-5" />Push-Benachrichtigungen aktivieren</button>
        : <div className="flex flex-wrap gap-2">
          <span data-testid="push-device-active" className="rounded-full border border-success/60 px-3 py-1.5 text-xs font-semibold text-success">Auf diesem Gerät aktiv</span>
          <button type="button" data-testid="push-test-button" disabled={busy} onClick={() => sendTestPush().then(() => toast.success("Test-Mitteilung gesendet. Sperre kurz dein iPhone, um sie zu sehen.")).catch((e) => toast.error(errText(e)))} className="rounded-full border border-neon/50 px-3 py-1.5 text-xs font-semibold">Test senden</button>
          <button type="button" data-testid="push-device-disable-button" disabled={busy} onClick={disableDevice} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">Auf diesem Gerät deaktivieren</button>
        </div>)}
    {prefs.data !== null && <>
      <label className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block text-sm font-semibold">Push-Benachrichtigungen</span><span className="block text-xs text-muted-foreground">Gilt für alle deine Geräte. Die Glocke funktioniert immer.</span></span>
        <Switch data-testid="push-pref-enabled" checked={p.enabled} onCheckedChange={(v) => set({ enabled: v })} /></label>
      <div className={`space-y-2.5 pl-1 transition-opacity duration-200 ${p.enabled ? "" : "pointer-events-none opacity-45"}`}>
        {CATEGORIES.map(({ k, l }) => <label key={k} className="flex items-center justify-between gap-3"><span className="text-sm">{l}</span>
          <Switch data-testid={`push-pref-${k}`} checked={p[k]} disabled={!p.enabled} onCheckedChange={(v) => set({ [k]: v })} /></label>)}
        <label className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block text-sm">Nachrichtenvorschau auf dem Sperrbildschirm anzeigen</span><span className="block text-xs text-muted-foreground">Aus: nur „Neue private Nachricht von …“ ohne Inhalt.</span></span>
          <Switch data-testid="push-pref-show_preview" checked={p.show_preview} disabled={!p.enabled} onCheckedChange={(v) => set({ show_preview: v })} /></label>
      </div></>}
  </div>;
}
