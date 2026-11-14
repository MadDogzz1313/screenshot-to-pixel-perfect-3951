import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { reviewCorrection, setAccuracy, useInvalidate, usePendingCorrections } from "@/lib/social";
import { AppShell } from "@/components/AppShell";
import { SpotCard } from "@/components/SpotCard";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Status } from "@/lib/demo-data";
import { AdminUserManagement } from "@/components/social/AdminUserManagement";
import { CrewActivityAdmin } from "@/components/crew/CrewActivityAdmin";
import { StripeDonationsAdmin } from "@/components/StripeDonationsAdmin";
import { PushServerAdmin } from "@/components/social/PushServerAdmin";
import { AdminPlayerManager } from "@/components/admin/AdminPlayerManager";
import { AdConfigAdmin } from "@/components/admin/AdConfigAdmin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Leonida Explorer" }, { name: "robots", content: "noindex" }, { name: "description", content: "Moderation" }, { property: "og:title", content: "Admin" }, { property: "og:description", content: "Moderation" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Admin,
});

const LABEL: Record<Status, string> = { pending: "Wartend", approved: "Freigegeben", rejected: "Abgelehnt", hidden: "Ausgeblendet" };

function Admin() {
  const { user, authReady, spots, spotsLoading, setStatus } = useStore();
  const isAdmin = !!user?.isAdmin; const invalidate = useInvalidate();
  const corrections = usePendingCorrections(isAdmin);
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
        <AdminPlayerManager />
        <AdminUserManagement myId={user.id} />
        <PushServerAdmin />
        <AdConfigAdmin />
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
        <StripeDonationsAdmin />
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
