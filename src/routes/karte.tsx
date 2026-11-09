import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, MapPin, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapCanvas } from "@/components/MapCanvas";
import { SpotCard } from "@/components/SpotCard";
import { CATEGORIES, type CategoryId, type Spot } from "@/lib/demo-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/karte")({
  head: () => ({ meta: [{ title: "Karte · Leonida Explorer" }, { name: "description", content: "Interaktive Karte mit allen bestätigten Fundorten in Leonida." }, { property: "og:title", content: "Karte · Leonida Explorer" }, { property: "og:description", content: "Interaktive Karte mit allen bestätigten Fundorten in Leonida." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Karte,
});

function Karte() {
  const { spots } = useStore();
  const [q, setQ] = useState(""); const [cats, setCats] = useState<CategoryId[]>([]);
  const [sel, setSel] = useState<Spot | null>(null);
  const visible = useMemo(() => spots.filter((s) => s.status === "approved"
    && (!cats.length || cats.includes(s.category))
    && (!q || (s.title + s.area + (s.vehicleType ?? "")).toLowerCase().includes(q.toLowerCase()))), [spots, q, cats]);
  return (
    <AppShell>
      <div className="space-y-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <h1 className="text-center font-display text-3xl leading-none text-neon-gradient">LEONIDA EXPLORER</h1>
        <label className="neon-card flex h-12 items-center gap-2 !rounded-full px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fundorte, Orte oder Gebiete suchen …" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {CATEGORIES.map((c) => { const on = cats.includes(c.id); return (
            <button key={c.id} onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? `${c.color} border-foreground` : "border-border bg-card"}`}>
              <c.icon className="h-3.5 w-3.5" />{c.label}
            </button>); })}
        </div>
        <MapCanvas spots={visible} onSelect={setSel} />
        <div className="flex items-center justify-between gap-2">
          <div className="neon-card flex items-center gap-2 px-4 py-2"><MapPin className="h-5 w-5 text-neon" /><span className="text-sm font-semibold">{visible.length} Fundorte</span></div>
          <Link to="/beitrag" className="flex items-center gap-1 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground neon-ring"><Plus className="h-5 w-5" />Fundort vorschlagen</Link>
        </div>
      </div>
      {sel && (
        <div className="fixed inset-x-0 bottom-28 z-50 mx-auto max-w-3xl px-3">
          <div className="relative"><SpotCard spot={sel} />
            <button aria-label="Schließen" onClick={() => setSel(null)} className="absolute right-2 top-2 rounded-full bg-background/80 p-1"><X className="h-4 w-4" /></button></div>
        </div>
      )}
    </AppShell>
  );
}
