import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { addDonation, deleteDonation, reviewCorrection, setAccuracy, useDonations, useInvalidate, usePendingCorrections } from "@/lib/social";
import { AppShell } from "@/components/AppShell";
import { SpotCard } from "@/components/SpotCard";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Status } from "@/lib/demo-data";
import { AdminUserManagement } from "@/components/social/AdminUserManagement";
import { CrewActivityAdmin } from "@/components/crew/CrewActivityAdmin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Leonida Explorer" }, { name: "robots", content: "noindex" }, { name: "description", content: "Moderation" }, { property: "og:title", content: "Admin" }, { property: "og:description", content: "Moderation" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Admin,
});

const LABEL: Record<Status, string> = { pending: "Wartend", approved: "Freigegeben", rejected: "Abgelehnt", hidden: "Ausgeblendet" };

function Admin() {
  const { user, authReady, spots, spotsLoading, setStatus, profiles } = useStore();
  const isAdmin = !!user?.isAdmin; const invalidate = useInvalidate();
  const corrections = usePendingCorrections(isAdmin); const donations = useDonations(isAdmin);
  const [donUser, setDonUser] = useState(""); const [donEur, setDonEur] = useState(""); const [donNote, setDonNote] = useState("");
  const run = async (p: Promise<string | null>, ok: string, ...keys: string[]) => { const err = await p; if (err) toast.error(err); else { toast.success(ok); await invalidate(...keys); } };
  const [busyId, setBusyId] = useState<string | null>(null);
  const act = async (id: string, status: Status, msg: string) => {
    setBusyId(id); const err = await setStatus(id, status); setBusyId(null);
    if (err) toast.error(err); else toast.success(msg);
  };
  if (!authReady) return <AppShell title="Moderation">{null}</AppShell>;
  if (!user?.isAdmin) return <Navigate to="/karte" />;
  return (
    <AppShell title="Moderation">
      <div className="space-y-3 px-3">
        <AdminUserManagement myId={user.id} />
        <CrewActivityAdmin />
        <section data-testid="admin-corrections" className="neon-card space-y-2 p-3">
          <p className="font-display">Korrekturen prüfen ({corrections.data?.length ?? 0})</p>
          {corrections.data?.map((c) => (
            <div key={c.id} data-testid={`admin-correction-${c.id}`} className="space-y-1 rounded-xl border border-border p-2 text-sm">
              <p className="text-xs text-muted-foreground">{c.user?.username ?? "?"} zu „{c.spot?.title ?? "Fundort"}“</p>
              <p className="whitespace-pre-line">{c.message}</p>
              <div className="flex gap-2"><Button size="sm" data-testid="admin-correction-confirm" onClick={() => run(reviewCorrection(c.id, "confirmed"), "Korrektur bestätigt", "corrections", "profiles", "badges", "progress")}>Bestätigen</Button>
                <Button size="sm" variant="destructive" data-testid="admin-correction-reject" onClick={() => run(reviewCorrection(c.id, "rejected"), "Korrektur abgelehnt", "corrections")}>Ablehnen</Button></div>
            </div>))}
          {corrections.data?.length === 0 && <p className="text-xs text-muted-foreground">Keine offenen Korrekturen.</p>}
        </section>
        <section data-testid="admin-donations" className="neon-card space-y-2 p-3">
          <p className="font-display">Spende erfassen</p>
          <p className="text-xs text-muted-foreground">Nur nach geprüfter Spende eintragen. Stufen ergeben sich aus der Gesamtsumme; keine XP, keine Rechte. Beträge sind privat.</p>
          <select data-testid="admin-donation-user" value={donUser} onChange={(e) => setDonUser(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm">
            <option value="">Spieler wählen …</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.username}</option>)}</select>
          <div className="flex gap-2"><Input data-testid="admin-donation-amount" inputMode="decimal" placeholder="Betrag in €" value={donEur} onChange={(e) => setDonEur(e.target.value)} />
            <Input data-testid="admin-donation-note" placeholder="Notiz (optional)" value={donNote} maxLength={200} onChange={(e) => setDonNote(e.target.value)} /></div>
          <Button data-testid="admin-donation-submit" className="w-full" disabled={!donUser || !(Number(donEur.replace(",", ".")) > 0)} onClick={() => run(
            addDonation(donUser, user!.id, Number(donEur.replace(",", ".")), donNote.trim()).then((e) => { if (!e) { setDonEur(""); setDonNote(""); } return e; }), "Spende erfasst", "donations", "badges")}>Spende speichern</Button>
          {donations.data?.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs"><span>{profiles.find((p) => p.id === d.user_id)?.username ?? "?"} · {(d.amount_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} · {d.created_at.slice(0, 10)}</span>
              <button type="button" className="text-destructive" data-testid={`admin-donation-delete-${d.id}`} onClick={() => run(deleteDonation(d.id), "Spende entfernt", "donations", "badges")}>Entfernen</button></div>))}
        </section>
        {[...spots].sort((a) => (a.status === "pending" ? -1 : 1)).map((s) => (
          <div key={s.id} data-testid={`admin-spot-${s.id}`} className="space-y-2"><SpotCard spot={s} />
            <div className="flex flex-wrap items-center gap-2 text-xs"><span data-testid="admin-spot-status" className="rounded-full bg-muted px-2 py-1">{LABEL[s.status]}</span>
              {s.status !== "approved" && <Button size="sm" disabled={busyId === s.id} data-testid="admin-approve-button" onClick={() => act(s.id, "approved", s.status === "pending" ? "Freigegeben" : "Wiederhergestellt")}>{s.status === "pending" ? "Freigeben" : "Wiederherstellen"}</Button>}
              {s.status === "pending" && <Button size="sm" variant="destructive" disabled={busyId === s.id} data-testid="admin-reject-button" onClick={() => act(s.id, "rejected", "Abgelehnt")}>Ablehnen</Button>}
              {s.status === "approved" && <Button size="sm" variant="outline" disabled={busyId === s.id} data-testid="admin-hide-button" onClick={() => act(s.id, "hidden", "Ausgeblendet")}>Ausblenden</Button>}
              {s.status === "approved" && <Button size="sm" variant={s.accurate ? "secondary" : "outline"} data-testid="admin-accuracy-button"
                onClick={() => run(setAccuracy(s.id, !s.accurate), s.accurate ? "Genauigkeit zurückgenommen" : "Als korrekt bestätigt", "spots", "badges", "progress")}>{s.accurate ? "✓ Korrekt bestätigt" : "Als korrekt bestätigen"}</Button>}
            </div></div>))}
        {!spotsLoading && !spots.length && <p data-testid="admin-empty" className="text-sm text-muted-foreground">Noch keine Beiträge eingereicht.</p>}
      </div>
    </AppShell>
  );
}
