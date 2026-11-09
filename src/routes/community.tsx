import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LevelBadge } from "@/components/LevelBadge";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useLeaderboard } from "@/lib/social";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community · Leonida Explorer" }, { name: "description", content: "Die aktivsten Entdecker von Leonida im Überblick." }, { property: "og:title", content: "Community · Leonida Explorer" }, { property: "og:description", content: "Die aktivsten Entdecker von Leonida im Überblick." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Community,
});

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
function Community() {
  const { profiles } = useStore();
  const now = new Date(); const months = [0, 1, 2].map((k) => { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; });
  const [tab, setTab] = useState<"xp" | "month">("xp"); const [month, setMonth] = useState(months[0]!);
  const board = useLeaderboard(month);
  const label = (iso: string) => new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00"));
  return (
    <AppShell title="Community">
      <div className="mb-3 flex gap-2 px-3">
        {([["xp", "Rangliste (XP)"], ["month", "Monatswertung"]] as const).map(([k, l]) => (
          <button key={k} type="button" data-testid={`community-tab-${k}`} onClick={() => setTab(k)} className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold ${tab === k ? "border-neon bg-primary text-primary-foreground" : "border-border bg-card"}`}>{l}</button>))}
      </div>
      {tab === "xp" ? (
        <ol className="space-y-2 px-3">
          {[...profiles].filter((p) => !p.restricted).sort((a, b) => b.xp - a.xp).map((p, i) => (
            <li key={p.id}><Link to="/u/$username" params={{ username: p.username }} className="neon-card flex items-center gap-3 p-3">
              <span className="w-6 text-center font-display text-accent">{i + 1}</span>
              <img src={p.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-neon object-cover" />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.username}</span>
              <span className="text-xs text-muted-foreground">{p.xp} XP</span><LevelBadge xp={p.xp} />
            </Link></li>))}
        </ol>
      ) : (
        <div className="space-y-3 px-3">
          <div className="flex gap-2 overflow-x-auto">{months.map((m) => (
            <button key={m} type="button" data-testid={`community-month-${m}`} onClick={() => setMonth(m)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${m === month ? "border-neon bg-primary/30" : "border-border bg-card"}`}>{label(m)}</button>))}</div>
          {board.data === null && <p className="neon-card p-3 text-sm text-muted-foreground">Die Monatswertung startet nach dem Datenbank-Update.</p>}
          {board.data && <>
            <p data-testid="community-month-period" className="text-xs text-muted-foreground">
              Zeitraum: {fmt(board.data[0]?.period_start ?? month)} – {board.data[0] ? fmt(board.data[0].period_end) : "Monatsende"} (deutsche Zeit) · {board.data[0]?.final ? "Endstand" : "Live-Stand"}.
              Gezählt werden Fundorte nach Datum ihrer ersten Freigabe. Gleichstand: wer die Zahl zuerst erreicht hat. Platz 1–10 eines abgeschlossenen Monats erhalten „Top-Entdecker“.
            </p>
            <ol className="space-y-2">{board.data.map((r) => (
              <li key={r.user_id} data-testid={`community-rank-${r.rank}`}><Link to="/u/$username" params={{ username: r.username }} className="neon-card flex items-center gap-3 p-3">
                <span className="w-6 text-center font-display text-accent">{r.rank}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{r.username}</span>
                <span className="text-xs text-muted-foreground">{r.approved_count} Fundorte</span>
              </Link></li>))}</ol>
            {!board.data.length && <p className="text-sm text-muted-foreground">In diesem Monat wurden noch keine Fundorte freigegeben.</p>}
          </>}
        </div>
      )}
    </AppShell>
  );
}
