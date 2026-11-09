import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Ban, Megaphone, Search, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reasonLabel, SETUP_HINT, socialError, useAdminActions, useAdminReports, useAdminUsers, useModerationLog, type AdminUser } from "@/lib/friends";

const DURATIONS = [{ id: "1d", label: "1 Tag", h: 24 }, { id: "3d", label: "3 Tage", h: 72 }, { id: "7d", label: "7 Tage", h: 168 }, { id: "30d", label: "30 Tage", h: 720 }, { id: "perm", label: "Permanent", h: 0 }] as const;
const STATUS: Record<string, string> = { open: "Offen", in_review: "In Prüfung", resolved: "Abgeschlossen", dismissed: "Verworfen" };
const ACTION: Record<string, string> = { warn: "Verwarnung", ban: "Sperre", unban: "Entsperrt", report_update: "Meldung bearbeitet", broadcast: "Community-Mitteilung", review_request: "Überprüfung angefragt" };
const dt = (iso: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const chip = "min-h-9 rounded-full px-3 text-xs font-bold transition-transform duration-150 active:scale-95 disabled:opacity-50";

/** Admin-Benutzerverwaltung: Suche, Meldungen, Verwarnen, Sperren/Entsperren, Protokoll, Mitteilungen (alles serverseitig geprüft) */
export function AdminUserManagement({ myId }: { myId: string }) {
  const [q, setQ] = useState(""); const [sel, setSel] = useState<AdminUser | null>(null); const [repTab, setRepTab] = useState<"open" | "closed">("open");
  const users = useAdminUsers(q.trim(), true);
  const reports = useAdminReports(repTab, true);
  const log = useModerationLog(true);
  const a = useAdminActions();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bTitle, setBTitle] = useState(""); const [bBody, setBBody] = useState("");
  const done = (msg: string, after?: () => void) => ({ onSuccess: () => { toast.success(msg); after?.(); }, onError: (e: Error) => toast.error(socialError(e)) });
  if (users.data === null) return <section data-testid="admin-users" className="neon-card p-3"><p className="font-display">Benutzerverwaltung</p><p className="text-xs text-muted-foreground">{SETUP_HINT}</p></section>;
  return <div className="space-y-3">
    <section data-testid="admin-users" className="neon-card space-y-2 p-3">
      <p className="flex items-center gap-2 font-display"><Users className="h-5 w-5 text-neon" />Benutzerverwaltung</p>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><input data-testid="admin-user-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Benutzer suchen …" className="min-h-10 w-full bg-transparent text-base outline-none" /></label>
      <ul className="max-h-72 space-y-1 overflow-y-auto">{(users.data ?? []).map((u) => <li key={u.id}><button type="button" data-testid={`admin-user-${u.id}`} onClick={() => setSel(u)} className={`flex w-full flex-wrap items-center gap-1.5 rounded-xl border px-3 py-2 text-left text-sm ${sel?.id === u.id ? "border-neon bg-primary/10" : "border-border"}`}>
        <span data-testid="admin-user-name" className="w-full truncate font-semibold">{u.username}</span>
        {u.is_admin && <span className="rounded-full bg-accent/20 px-2 text-[10px] font-bold text-accent">ADMIN</span>}
        {u.banned && <span data-testid="admin-user-banned-chip" className="rounded-full bg-destructive/20 px-2 text-[10px] font-bold text-destructive">{u.ban_until ? `GESPERRT BIS ${dt(u.ban_until)}` : "PERMANENT GESPERRT"}</span>}
        {u.open_reports > 0 && <span className="rounded-full bg-primary/25 px-2 text-[10px] font-bold text-neon">{u.open_reports} Meldung(en)</span>}
        {u.warnings > 0 && <span className="text-[10px] text-muted-foreground">{u.warnings}× verwarnt</span>}
      </button></li>)}</ul>
      {sel && <UserPanel key={sel.id} u={(users.data ?? []).find((x) => x.id === sel.id) ?? sel} myId={myId} />}
    </section>

    <section data-testid="admin-user-reports" className="neon-card space-y-2 p-3">
      <div className="flex items-center justify-between"><p className="flex items-center gap-2 font-display"><TriangleAlert className="h-5 w-5 text-accent" />Benutzer-Meldungen</p>
        <div className="flex gap-1">{(["open", "closed"] as const).map((t) => <button key={t} type="button" data-testid={`admin-reports-tab-${t}`} onClick={() => setRepTab(t)} className={`${chip} ${repTab === t ? "bg-primary text-primary-foreground" : "border border-border"}`}>{t === "open" ? "Offen" : "Erledigt"}</button>)}</div></div>
      {!reports.data?.length && <p className="text-xs text-muted-foreground">Keine Meldungen.</p>}
      {reports.data?.map((r) => <div key={r.id} data-testid={`admin-report-${r.id}`} className="space-y-1.5 rounded-xl border border-border p-2.5 text-sm">
        <p className="text-xs text-muted-foreground">{dt(r.created_at)} · {r.reporter_name} meldet <Link to="/u/$username" params={{ username: r.reported_name }} className="font-semibold text-neon">{r.reported_name}</Link> · {STATUS[r.status]}</p>
        <p className="font-semibold">{reasonLabel(r.reason)}</p>
        {r.details && <p className="whitespace-pre-line text-xs">{r.details}</p>}
        {r.message_excerpt !== null && <p className="rounded-lg bg-black/25 p-2 text-xs"><span className="text-muted-foreground">Gemeldete Nachricht: </span>{r.message_excerpt || "(vom Absender gelöscht)"}</p>}
        {r.admin_note && <p className="text-xs text-muted-foreground">Notiz: {r.admin_note}</p>}
        {repTab === "open" && <>
          <Input data-testid="admin-report-note" placeholder="Notiz (optional)" value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} className="text-base" />
          <div className="flex flex-wrap gap-2">
            {r.status === "open" && <button type="button" data-testid="admin-report-review" onClick={() => a.updateReport.mutate({ id: r.id, status: "in_review", note: notes[r.id] ?? "" }, done("In Prüfung"))} className={`${chip} border border-border`}>In Prüfung</button>}
            <button type="button" data-testid="admin-report-resolve" onClick={() => a.updateReport.mutate({ id: r.id, status: "resolved", note: notes[r.id] ?? "" }, done("Meldung abgeschlossen"))} className={`${chip} bg-primary text-primary-foreground`}>Abschließen</button>
            <button type="button" data-testid="admin-report-dismiss" onClick={() => a.updateReport.mutate({ id: r.id, status: "dismissed", note: notes[r.id] ?? "" }, done("Meldung verworfen"))} className={`${chip} border border-border`}>Verwerfen</button>
            <button type="button" data-testid="admin-report-open-user" onClick={() => { setQ(r.reported_name); setSel(null); }} className={`${chip} border border-neon/50 text-neon`}>Konto prüfen</button>
          </div></>}
      </div>)}
    </section>

    <section data-testid="admin-broadcast" className="neon-card space-y-2 p-3">
      <p className="flex items-center gap-2 font-display"><Megaphone className="h-5 w-5 text-neon" />Community-Mitteilung</p>
      <p className="text-xs text-muted-foreground">Erscheint bei allen Spielern in der Benachrichtigungsglocke.</p>
      <Input data-testid="admin-broadcast-title" placeholder="Titel" maxLength={120} value={bTitle} onChange={(e) => setBTitle(e.target.value)} className="text-base" />
      <Textarea data-testid="admin-broadcast-body" placeholder="Text (optional)" maxLength={500} value={bBody} onChange={(e) => setBBody(e.target.value)} className="text-base" />
      <button type="button" data-testid="admin-broadcast-submit" disabled={bTitle.trim().length < 3 || a.broadcast.isPending} onClick={() => { if (confirm("Mitteilung an alle Spieler senden?")) a.broadcast.mutate({ title: bTitle.trim(), body: bBody.trim() }, done("Mitteilung gesendet", () => { setBTitle(""); setBBody(""); })); }} className={`${chip} w-full bg-primary text-primary-foreground`}>An alle senden</button>
    </section>

    <details data-testid="admin-moderation-log" className="neon-card p-3"><summary className="cursor-pointer font-display">Moderationsprotokoll</summary>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs">{(log.data ?? []).map((l) => <li key={l.id} className="rounded-lg border border-border px-2 py-1.5"><span className="text-muted-foreground">{dt(l.created_at)}</span> · <b>{ACTION[l.action] ?? l.action}</b>{l.target_name && <> · {l.target_name}</>}{l.actor_name && <> · von {l.actor_name}</>}{l.reason && <span className="block text-muted-foreground">{l.reason}</span>}</li>)}</ul>
      {!log.data?.length && <p className="mt-2 text-xs text-muted-foreground">Noch keine Einträge.</p>}
    </details>
  </div>;
}

function UserPanel({ u, myId }: { u: AdminUser; myId: string }) {
  const a = useAdminActions();
  const [reason, setReason] = useState(""); const [dur, setDur] = useState<(typeof DURATIONS)[number]["id"]>("1d"); const [visible, setVisible] = useState(true);
  const protectedUser = u.is_admin || u.id === myId;
  const done = (msg: string) => ({ onSuccess: () => { toast.success(msg); setReason(""); }, onError: (e: Error) => toast.error(socialError(e)) });
  const ban = () => {
    const d = DURATIONS.find((x) => x.id === dur)!;
    const until = d.h ? new Date(Date.now() + d.h * 3600_000).toISOString() : null;
    if (confirm(`${u.username} ${until ? `für ${d.label}` : "dauerhaft"} sperren?`)) a.ban.mutate({ userId: u.id, until, reason: reason.trim(), visible }, done("Konto gesperrt"));
  };
  return <div data-testid="admin-user-panel" className="space-y-2 rounded-2xl border border-neon/40 bg-background/40 p-3">
    <div className="flex items-center justify-between gap-2"><p className="font-display text-lg">{u.username}</p><Link to="/u/$username" params={{ username: u.username }} data-testid="admin-user-profile-link" className="text-xs font-semibold text-neon">Profil ansehen ›</Link></div>
    <p className="text-xs text-muted-foreground">Mitglied seit {dt(u.created_at)} · {u.is_private ? "privates Profil" : "öffentliches Profil"} · {u.open_reports} offene Meldung(en) · {u.warnings}× verwarnt</p>
    {u.banned && <p data-testid="admin-user-ban-info" className="rounded-xl bg-destructive/15 p-2 text-xs text-destructive">Gesperrt {u.ban_until ? `bis ${dt(u.ban_until)}` : "– permanent"}{u.ban_reason ? ` · Grund: ${u.ban_reason}` : ""}</p>}
    {protectedUser ? <p data-testid="admin-user-protected" className="flex items-center gap-2 text-xs text-accent"><ShieldCheck className="h-4 w-4" />{u.id === myId ? "Das bist du – eigene Sperren sind nicht möglich." : "Admin-Konten sind geschützt."}</p> : <>
      <Textarea data-testid="admin-user-reason" placeholder="Grund (Pflicht für Verwarnung/Sperre)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="text-base" />
      <div className="flex flex-wrap gap-1">{DURATIONS.map((d) => <button key={d.id} type="button" data-testid={`admin-ban-duration-${d.id}`} onClick={() => setDur(d.id)} className={`${chip} ${dur === d.id ? "bg-primary text-primary-foreground" : "border border-border"}`}>{d.label}</button>)}</div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" data-testid="admin-ban-reason-visible" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-[var(--neon)]" />Grund auf dem Sperrbildschirm anzeigen</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="admin-warn-button" disabled={reason.trim().length < 3 || a.warn.isPending} onClick={() => a.warn.mutate({ userId: u.id, reason: reason.trim() }, done("Verwarnung gesendet"))} className={`${chip} border border-accent/60 text-accent`}><TriangleAlert className="mr-1 inline h-3.5 w-3.5" />Verwarnen</button>
        <button type="button" data-testid="admin-ban-button" disabled={reason.trim().length < 3 || a.ban.isPending} onClick={ban} className={`${chip} bg-destructive text-white`}><Ban className="mr-1 inline h-3.5 w-3.5" />Sperren</button>
        {u.banned && <button type="button" data-testid="admin-unban-button" disabled={a.unban.isPending} onClick={() => a.unban.mutate(u.id, done("Konto entsperrt"))} className={`${chip} border border-success/60 text-success`}>Entsperren</button>}
      </div></>}
  </div>;
}
