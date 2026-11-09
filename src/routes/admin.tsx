import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SpotCard } from "@/components/SpotCard";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Status } from "@/lib/demo-data";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Leonida Explorer" }, { name: "robots", content: "noindex" }, { name: "description", content: "Moderation" }, { property: "og:title", content: "Admin" }, { property: "og:description", content: "Moderation" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Admin,
});

const LABEL: Record<Status, string> = { pending: "Wartend", approved: "Freigegeben", rejected: "Abgelehnt", hidden: "Ausgeblendet" };

function Admin() {
  const { user, spots, setStatus } = useStore();
  if (!user?.isAdmin) return <Navigate to="/karte" />;
  return (
    <AppShell title="Moderation">
      <div className="space-y-3 px-3">
        {[...spots].sort((a) => (a.status === "pending" ? -1 : 1)).map((s) => (
          <div key={s.id} className="space-y-2"><SpotCard spot={s} />
            <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-muted px-2 py-1">{LABEL[s.status]}</span>
              {s.status !== "approved" && <Button size="sm" onClick={() => setStatus(s.id, "approved")}>{s.status === "pending" ? "Freigeben" : "Wiederherstellen"}</Button>}
              {s.status === "pending" && <Button size="sm" variant="destructive" onClick={() => setStatus(s.id, "rejected")}>Ablehnen</Button>}
              {s.status === "approved" && <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "hidden")}>Ausblenden</Button>}
            </div></div>))}
      </div>
    </AppShell>
  );
}
