import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, MapPin, Plus, UserRound, Bell, SlidersHorizontal, TreePalm } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapCanvas } from "@/components/MapCanvas";
import { SpotCard } from "@/components/SpotCard";
import { NotificationBell } from "@/components/social/NotificationBell";
import { CATEGORIES, type CategoryId, type Spot } from "@/lib/demo-data";
import { useStore } from "@/lib/store";

import { lang, tr } from "@/lib/i18n";
export const Route = createFileRoute("/karte")({
  head: () => ({ meta: [{ title: tr("Karte · Leonida Explorer") }, { name: "description", content: tr("Interaktive Karte mit allen bestätigten Fundorten in Leonida.") }, { property: "og:title", content: tr("Karte · Leonida Explorer") }, { property: "og:description", content: tr("Interaktive Karte mit allen bestätigten Fundorten in Leonida.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Karte,
});

const roundBtn = "relative grid h-12 w-12 place-items-center rounded-full border border-neon/60 bg-background/60 shadow-[0_0_16px_oklch(0.7_0.3_345/0.4)] backdrop-blur-md transition-transform duration-150 active:scale-95";

function Karte() {
  const { spots, profiles, user } = useStore();
  const [q, setQ] = useState(""); const [cats, setCats] = useState<CategoryId[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sel, setSel] = useState<Spot | null>(null);
  const visible = useMemo(() => spots.filter((s) => s.status === "approved"
    && (!cats.length || cats.includes(s.category))
    && (!q || (s.title + s.area + (s.vehicleType ?? "")).toLowerCase().includes(q.toLowerCase()))), [spots, q, cats]);
  return (
    <AppShell vividBg>
      {/* Volle Bildschirmhöhe minus Navigation: die Karte bekommt den restlichen Platz ("Fit to Screen"). */}
      <div className="flex h-[calc(100dvh-6rem-env(safe-area-inset-bottom))] flex-col gap-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <header className="grid shrink-0 grid-cols-[3rem_1fr_3rem] items-start gap-2">
          <Link to="/profil" aria-label={tr("Profil")} data-testid="map-profile-button" className={`${roundBtn} mt-3`}><UserRound className="h-6 w-6" /></Link>
          <div className="text-center">
            <h1 data-testid="map-logo" className="relative mx-auto inline-block -skew-x-6 font-display text-[2.6rem] italic leading-[0.9] text-neon-gradient">
              LEONIDA<br />EXPLORER
              <TreePalm aria-hidden className="absolute -right-7 -top-3 h-10 w-10 skew-x-6 text-neon drop-shadow-[0_0_8px_var(--neon)]" />
            </h1>
            <p data-testid="map-community-label" className="mt-1.5 text-center text-[10px] font-bold tracking-[0.32em] text-foreground/90 [text-shadow:0_0_8px_oklch(0.7_0.3_345/0.8)]">COMMUNITY MAP</p>
          </div>
          {user ? <NotificationBell testId="map-bell-button" /> : <Link to="/profil" aria-label={tr("Hinweise")} data-testid="map-bell-button" className={`${roundBtn} mt-3`}><Bell className="h-6 w-6" /></Link>}
        </header>

        <div className="flex shrink-0 gap-2">
          <label className="neon-card flex h-12 min-w-0 flex-1 items-center gap-2 !rounded-full px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="map-search-input" placeholder={tr("Fundorte, Orte oder Gebiete suchen …")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {q && <button type="button" aria-label={tr("Suche leeren")} onClick={() => setQ("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
          </label>
          <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen} data-testid="map-filter-button"
            className={`neon-card flex h-12 shrink-0 items-center gap-1.5 !rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${filterOpen ? "!bg-primary/30" : ""}`}>
            <SlidersHorizontal className="h-5 w-5" />Filter
            {cats.length > 0 && <span data-testid="map-filter-count" className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{cats.length}</span>}
          </button>
        </div>

        {filterOpen && (
          <div data-testid="map-filter-panel" className="neon-card flex shrink-0 flex-wrap gap-2 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {CATEGORIES.map((c) => { const on = cats.includes(c.id); return (
              <button key={c.id} type="button" data-testid={`map-filter-${c.id}`} onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? `${c.color} border-foreground` : "border-border bg-card"}`}>
                <c.icon className="h-3.5 w-3.5" />{c.label}
              </button>); })}
            {cats.length > 0 && <button type="button" data-testid="map-filter-reset" onClick={() => setCats([])} className="px-2 text-xs font-semibold text-neon">{tr("Zurücksetzen")}</button>}
          </div>
        )}

        <MapCanvas variant="floating" spots={visible} onSelect={setSel} className="w-full flex-1" />

        <div className="flex shrink-0 items-center justify-between gap-2">
          <div data-testid="map-stats" className="neon-card flex min-w-0 items-center gap-3 !rounded-full px-4 py-2">
            <MapPin className="h-6 w-6 shrink-0 text-foreground" />
            <div className="min-w-0 leading-tight">
              <p data-testid="map-spot-count" className="text-sm font-bold">{visible.length === 1 ? tr("1 Fundort") : tr("{0} Fundorte", visible.length)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{tr("Community: {0} Spieler", profiles.length)}</p>
            </div>
          </div>
          <Link to="/beitrag" data-testid="map-suggest-button" className="flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[oklch(0.66_0.29_345)] to-[oklch(0.6_0.28_330)] px-4 py-2 text-sm font-bold leading-tight text-primary-foreground neon-ring transition-transform duration-150 active:scale-95">
            <Plus className="h-6 w-6" /><span className="text-left">{lang === "de" ? <>Fundort<br />vorschlagen</> : <>Suggest<br />a spot</>}</span>
          </Link>
        </div>
      </div>
      {sel && (
        <div className="fixed inset-x-0 bottom-28 z-50 mx-auto max-w-3xl px-3">
          <div className="relative"><SpotCard spot={sel} />
            <button aria-label={tr("Schließen")} onClick={() => setSel(null)} className="absolute right-2 top-2 rounded-full bg-background/80 p-1"><X className="h-4 w-4" /></button></div>
        </div>
      )}
    </AppShell>
  );
}
