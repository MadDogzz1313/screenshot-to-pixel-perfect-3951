import { useEffect, useState, type ReactNode } from "react";
import { Hourglass, LogOut, Send } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { rememberPushTarget, syncPushSubscription, takePushTarget } from "@/lib/push";
import { requestBanReview, socialError, useMyBan, useSocialRealtime, type AccountBan } from "@/lib/friends";
import bg from "@/assets/bg-sunset.jpg";

const fmt = (iso: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));

/** Zeigt den Sperrbildschirm nur bei einer tatsächlich bestehenden Kontosperre (Datenbank: my_account_ban).
 *  Die Sperre selbst wirkt serverseitig unabhängig davon. Hält außerdem Glocke/Anfragen/Chats per Realtime aktuell. */
export function BanGate({ children }: { children: ReactNode }) {
  const { user } = useStore();
  useSocialRealtime(user?.id);
  const ban = useMyBan(user?.id);
  const nav = useNavigate();
  // Push angetippt: Ziel merken; ist der Nutzer (noch) nicht angemeldet, nach dem Login dorthin weiterleiten
  useEffect(() => { rememberPushTarget(); }, []);
  useEffect(() => {
    if (!user) return;
    void syncPushSubscription();
    const target = takePushTarget();
    if (target && target !== window.location.pathname + window.location.search) void nav({ href: target });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (user && ban.data) return <BanScreen ban={ban.data} />;
  return <>{children}</>;
}

function BanScreen({ ban }: { ban: AccountBan }) {
  const { signOut } = useStore(); const nav = useNavigate();
  const [text, setText] = useState(""); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await requestBanReview(text.trim()); toast.success("Anfrage gesendet. Das Admin-Team meldet sich."); setOpen(false); setText(""); }
    catch (e) { toast.error((e as { message?: string }).message?.includes("RATE_LIMIT") ? "Du kannst nur einmal pro Tag eine Überprüfung anfragen." : socialError(e as Error)); }
    finally { setBusy(false); }
  };
  return <div data-testid="ban-screen" className="relative isolate flex min-h-dvh flex-col items-center overflow-x-hidden px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)]">
    <img src={bg} alt="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover opacity-70" />
    <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#2a0b3d]/40 via-[#2a0b3d]/30 to-[#12061c]/95" />
    <h1 className="sr-only">DU WURDEST GEBANNT!</h1>
    <img src="/ban-alligator.webp" alt="Alligator im pinken Hawaiihemd: DU WURDEST GEBANNT!" data-testid="ban-image" className="w-full max-w-xl animate-[ban-pop_0.5s_ease-out] drop-shadow-[0_0_30px_oklch(0.7_0.3_345/0.45)]" />
    <div className="mt-3 w-full max-w-md space-y-3">
      <p data-testid="ban-humor-text" className="rounded-3xl border-2 border-neon/70 bg-[#1a0b26]/90 p-4 text-center text-[15px] leading-relaxed shadow-[0_0_24px_oklch(0.7_0.3_345/0.45)] backdrop-blur">
        Offenbar hast du gegen die <span className="font-semibold">Community-Regeln von Leonida Explorer</span> verstoßen. Selbst in Vice City gibt es Regeln, Amigo! 😉
      </p>
      {ban.reason && <p data-testid="ban-reason" className="rounded-2xl border border-border bg-card/80 px-4 py-3 text-sm"><span className="text-muted-foreground">Grund: </span>{ban.reason}</p>}
      <p data-testid="ban-duration" className="mx-auto flex w-fit items-center gap-2 rounded-full border border-neon/50 bg-card/80 px-5 py-2.5 text-base"><Hourglass className="h-5 w-5 text-neon" />Sperre: <span className="font-semibold text-neon">{ban.permanent || !ban.until_at ? "Permanent" : `bis ${fmt(ban.until_at)} Uhr`}</span></p>
      <button type="button" data-testid="ban-logout-button" onClick={async () => { await signOut(); nav({ to: "/", replace: true }); }}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-neon/80 bg-gradient-to-r from-primary/80 to-[#b0127a] text-lg font-bold text-white shadow-[0_0_26px_oklch(0.7_0.3_345/0.55)] transition-transform duration-150 active:scale-[0.97]"><LogOut className="h-5 w-5" />Abmelden</button>
      {!open ? <button type="button" data-testid="ban-review-open-button" onClick={() => setOpen(true)} className="w-full text-center text-sm font-semibold text-neon underline-offset-4 hover:underline">Sperre überprüfen lassen / Support kontaktieren</button>
        : <div data-testid="ban-review-form" className="space-y-2 rounded-2xl border border-border bg-card/85 p-3">
          <textarea data-testid="ban-review-input" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Warum sollte die Sperre überprüft werden?" className="min-h-24 w-full resize-none rounded-xl border border-border bg-background/60 p-3 text-base outline-none focus:border-neon" />
          <button type="button" data-testid="ban-review-submit-button" disabled={text.trim().length < 3 || busy} onClick={send} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />An das Admin-Team senden</button>
        </div>}
    </div>
  </div>;
}
