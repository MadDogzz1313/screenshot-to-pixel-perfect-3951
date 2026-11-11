import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SpotCard } from "@/components/SpotCard";
import { CATEGORIES } from "@/lib/demo-data";
import { useStore } from "@/lib/store";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/entdecken")({
  head: () => ({ meta: [{ title: tr("Entdecken · Leonida Explorer") }, { name: "description", content: tr("Neue und beliebte Fundorte nach Kategorie entdecken.") }, { property: "og:title", content: tr("Entdecken · Leonida Explorer") }, { property: "og:description", content: tr("Neue und beliebte Fundorte nach Kategorie entdecken.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => {
    const { spots, spotsLoading } = useStore();
    const ok = spots.filter((s) => s.status === "approved");
    return (
      <AppShell title={tr("Entdecken")}>
        <div className="space-y-5 px-3">
          {CATEGORIES.map((c) => { const list = ok.filter((s) => s.category === c.id); if (!list.length) return null; return (
            <section key={c.id}><h2 className="mb-2 flex items-center gap-2 font-display"><c.icon className="h-5 w-5 text-neon" />{c.label}</h2>
              <div className="grid gap-2 sm:grid-cols-2">{list.map((s) => <SpotCard key={s.id} spot={s} />)}</div></section>); })}
          {!spotsLoading && !ok.length && <p data-testid="discover-empty" className="neon-card p-4 text-sm text-muted-foreground">{tr("Noch keine freigegebenen Fundorte. Sei der Erste und schlage einen vor!")}</p>}
        </div>
      </AppShell>
    );
  },
});
