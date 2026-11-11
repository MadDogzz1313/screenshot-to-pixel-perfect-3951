import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Ban, Check, Flag, Lock, MessageCircle, MoreHorizontal, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { Profile } from "@/lib/demo-data";
import { REPORT_REASONS, relationTo, socialError, SETUP_HINT, useFriendState, useFriendsOf, useSocialActions, type ReportReason } from "@/lib/friends";

import { tr } from "@/lib/i18n";
const pill = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition-transform duration-150 active:scale-95 disabled:opacity-50";
const primary = `${pill} bg-primary text-primary-foreground shadow-[0_0_16px_oklch(0.7_0.3_345/0.55)]`;
const outline = `${pill} border border-neon/50 bg-card/80 text-foreground`;

/** Melde-Dialog für Benutzer (mode "user") oder eine private Nachricht (mode "message") */
export function ReportDialog({ open, onOpenChange, targetId, mode, username }: { open: boolean; onOpenChange: (v: boolean) => void; targetId: string; mode: "user" | "message" | "crew"; username: string }) {
  const actions = useSocialActions();
  const [reason, setReason] = useState<ReportReason | null>(null); const [details, setDetails] = useState("");
  const busy = actions.reportUser.isPending || actions.reportMessage.isPending || actions.reportCrew.isPending;
  const submit = () => {
    if (!reason) return;
    const done = { onSuccess: () => { toast.success(tr("Danke! Das Admin-Team prüft deine Meldung.")); setReason(null); setDetails(""); onOpenChange(false); }, onError: (e: Error) => toast.error(socialError(e)) };
    if (mode === "user") actions.reportUser.mutate({ userId: targetId, reason, details: details.trim() }, done);
    else if (mode === "crew") actions.reportCrew.mutate({ crewId: targetId, reason, details: details.trim() }, done);
    else actions.reportMessage.mutate({ messageId: targetId, reason, details: details.trim() }, done);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-testid="report-dialog" className="max-w-md border-neon/40 bg-[#140c20]">
      <DialogHeader><DialogTitle className="font-display">{mode === "user" ? `${username} melden` : mode === "crew" ? tr("Crew-Suche „{0}“ melden", username) : tr("Nachricht melden")}</DialogTitle>
        <DialogDescription>{tr("Nur das Admin-Team sieht deine Meldung.")}</DialogDescription></DialogHeader>
      <div className="grid gap-2">{REPORT_REASONS.map((r) => <button key={r.id} type="button" data-testid={`report-reason-${r.id}`} onClick={() => setReason(r.id)}
        className={`min-h-11 rounded-2xl border px-3 text-left text-sm transition-colors duration-150 ${reason === r.id ? "border-neon bg-primary/20 text-neon" : "border-border bg-card"}`}>{r.label}</button>)}</div>
      <Textarea data-testid="report-details-input" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} placeholder={tr("Zusätzliche Begründung (optional)")} className="text-base" />
      <button type="button" data-testid="report-submit-button" disabled={!reason || busy} onClick={submit} className={primary}>{tr("Meldung senden")}</button>
    </DialogContent>
  </Dialog>;
}

/** Freund hinzufügen / Anfrage / Freunde / Nachricht / Melden / Blockieren – auf fremden Profilen */
export function ProfileSocialActions({ profile }: { profile: Profile }) {
  const { user } = useStore();
  const state = useFriendState(!!user);
  const actions = useSocialActions();
  const [menu, setMenu] = useState(false); const [report, setReport] = useState(false);
  if (!user || user.id === profile.id) return null;
  if (state.data === null) return <p data-testid="social-setup-hint" className="neon-card mx-3 p-3 text-xs text-muted-foreground">{tr("Freunde & Privatchat: {0}", SETUP_HINT)}</p>;
  const { rel, requestId } = relationTo(state.data, profile.id);
  const run = <T,>(m: { mutate: (a: T, o: { onSuccess: () => void; onError: (e: Error) => void }) => void }, arg: T, ok: string) =>
    m.mutate(arg, { onSuccess: () => toast.success(ok), onError: (e) => toast.error(socialError(e)) });
  const busy = Object.values(actions).some((a) => a.isPending) || state.isPending;
  return <div data-testid="profile-social-actions" className="relative mx-3 flex flex-wrap items-center gap-2">
    {rel === "none" && <button type="button" data-testid="friend-add-button" disabled={busy} onClick={() => actions.sendRequest.mutate(profile.id, { onSuccess: (r) => toast.success(r === "accepted" ? tr("Ihr seid jetzt Freunde") : tr("Freundschaftsanfrage gesendet")), onError: (e) => toast.error(socialError(e)) })} className={primary}><UserPlus className="h-4 w-4" />{tr("Freund hinzufügen")}</button>}
    {rel === "outgoing" && <><span data-testid="friend-status-pending" className={`${outline} text-muted-foreground`}>{tr("Anfrage gesendet")}</span>
      <button type="button" data-testid="friend-cancel-button" disabled={busy} onClick={() => run(actions.cancel, requestId!, tr("Anfrage zurückgezogen"))} className={outline}><X className="h-4 w-4" />{tr("Zurückziehen")}</button></>}
    {rel === "incoming" && <><button type="button" data-testid="friend-accept-button" disabled={busy} onClick={() => run(actions.respond, { id: requestId!, accept: true }, tr("Ihr seid jetzt Freunde"))} className={primary}><Check className="h-4 w-4" />{tr("Annehmen")}</button>
      <button type="button" data-testid="friend-decline-button" disabled={busy} onClick={() => run(actions.respond, { id: requestId!, accept: false }, tr("Anfrage abgelehnt"))} className={outline}>{tr("Ablehnen")}</button></>}
    {rel === "friends" && <><span data-testid="friend-status-friends" className={`${outline} border-success/60 text-success`}><Users className="h-4 w-4" />{tr("Freunde")}</span>
      <Link to="/nachrichten/$userId" params={{ userId: profile.id }} data-testid="friend-message-button" className={primary}><MessageCircle className="h-4 w-4" />{tr("Nachricht")}</Link></>}
    {rel === "blocked" && <button type="button" data-testid="unblock-button" disabled={busy} onClick={() => run(actions.unblock, profile.id, tr("Blockierung aufgehoben"))} className={outline}><Ban className="h-4 w-4 text-destructive" />{tr("Blockiert · Aufheben")}</button>}
    <button type="button" aria-label={tr("Weitere Aktionen")} data-testid="profile-more-button" onClick={() => setMenu((v) => !v)} className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neon/50 bg-card/80 transition-transform duration-150 active:scale-95"><MoreHorizontal className="h-5 w-5" /></button>
    {menu && <div data-testid="profile-more-menu" className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-neon/40 bg-[#160E22] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
      {rel === "friends" && <button type="button" data-testid="friend-remove-button" onClick={() => { setMenu(false); if (confirm(tr("{0} als Freund entfernen?", profile.username))) run(actions.removeFriend, profile.id, tr("Freund entfernt")); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><UserMinus className="h-4 w-4 text-accent" />{tr("Freund entfernen")}</button>}
      <button type="button" data-testid="user-report-button" onClick={() => { setMenu(false); setReport(true); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Flag className="h-4 w-4 text-accent" />{tr("Benutzer melden")}</button>
      {rel !== "blocked" && <button type="button" data-testid="user-block-button" onClick={() => { setMenu(false); if (confirm(tr("{0} blockieren? Eine bestehende Freundschaft wird entfernt.", profile.username))) run(actions.block, profile.id, tr("Nutzer blockiert")); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Ban className="h-4 w-4 text-destructive" />{tr("Blockieren")}</button>}
    </div>}
    <ReportDialog open={report} onOpenChange={setReport} targetId={profile.id} mode="user" username={profile.username} />
  </div>;
}

/** Freundesliste: eigene (immer sichtbar, mit Suche/Entfernen/Chat) oder fremde (nach Privatsphäre) */
export function FriendsSection({ userId, own }: { userId: string; own?: boolean }) {
  const { profiles, user } = useStore();
  const state = useFriendState(!!own && !!user);
  const foreign = useFriendsOf(own ? undefined : userId);
  const actions = useSocialActions();
  const [q, setQ] = useState("");
  const ids = own ? state.data?.friends.map((f) => f.id) : foreign.data?.friends;
  const list = useMemo(() => (ids ?? []).map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p)
    .filter((p) => p.username.toLowerCase().includes(q.trim().toLowerCase())), [ids, profiles, q]);
  const missing = own ? state.data === null : foreign.data === null;
  const hidden = !own && foreign.data && !foreign.data.visible;
  const count = own ? ids?.length ?? 0 : foreign.data?.count ?? 0;
  return <section data-testid="friends-section" className="neon-card mx-3 space-y-3 p-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-display"><Users className="h-5 w-5 text-neon" />{tr("Freunde")}</h3>
      {!missing && !hidden && <span data-testid="friends-count" className="rounded-full border border-neon/50 px-2.5 py-0.5 text-xs font-bold">{count}</span>}
    </div>
    {missing && <p className="text-xs text-muted-foreground">{SETUP_HINT}</p>}
    {hidden && <p data-testid="friends-private-note" className="flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-4 w-4" />{tr("Freundesliste ist privat")}</p>}
    {!missing && !hidden && <>
      {(ids?.length ?? 0) > 4 && <label className="flex items-center gap-2 rounded-2xl border border-border bg-background/50 px-3"><Search className="h-4 w-4 text-muted-foreground" />
        <input data-testid="friends-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Freunde suchen …")} className="min-h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground" /></label>}
      {!list.length && <p data-testid="friends-empty" className="text-sm text-muted-foreground">{q ? tr("Kein Freund mit diesem Namen.") : own ? tr("Noch keine Freunde. Öffne ein Spielerprofil und tippe auf „Freund hinzufügen“.") : tr("Noch keine sichtbaren Freunde.")}</p>}
      <ul className="space-y-2">{list.map((p) => <li key={p.id} data-testid={`friend-row-${p.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2">
        <Link to="/u/$username" params={{ username: p.username }} data-testid="friend-profile-link" className="flex min-w-0 flex-1 items-center gap-3"><img src={p.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-neon object-cover" /><span className="truncate font-semibold">{p.username}</span></Link>
        {own && <><Link to="/nachrichten/$userId" params={{ userId: p.id }} aria-label={tr("Chat mit {0}", p.username)} data-testid="friend-chat-button" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_12px_var(--neon)] active:scale-90"><MessageCircle className="h-4 w-4" /></Link>
          <button type="button" aria-label={`${p.username} entfernen`} data-testid="friend-row-remove-button" onClick={() => { if (confirm(tr("{0} als Freund entfernen?", p.username))) actions.removeFriend.mutate(p.id, { onSuccess: () => toast.success(tr("Freund entfernt")), onError: (e) => toast.error(socialError(e)) }); }} className="grid h-10 w-10 place-items-center rounded-full border border-border active:scale-90"><UserMinus className="h-4 w-4" /></button></>}
      </li>)}</ul>
    </>}
  </section>;
}
