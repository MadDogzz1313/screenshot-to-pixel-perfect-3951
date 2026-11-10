import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Trophy, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { LeaderboardModal } from "@/components/arcade/LeaderboardModal";
import { ARCADE_GAMES, UPCOMING_ARCADE_GAMES, useArcadeStats, type ArcadeGameId } from "@/lib/arcade";
import { useStore } from "@/lib/store";
import { useState } from "react";

function GameHighscore({ game, enabled }: { game: ArcadeGameId; enabled: boolean }) {
  const stats = useArcadeStats(game, enabled);
  return <p data-testid={`game-highscore-${game}`} className="mt-2 text-xs text-[#BFAAD9]">🏆 Dein Highscore: <span className="font-bold text-[#FFD12A]">{stats.data?.high_score?.toLocaleString("de-DE") ?? "–"}</span></p>;
}
export function ArcadeHub() {
  const { user } = useStore();
  const isGameRoute = useRouterState({ select: (state) => state.location.pathname !== "/arcade" && state.location.pathname.startsWith("/arcade/") });
  const [leaderboard, setLeaderboard] = useState<ArcadeGameId | null>(null);
  if (isGameRoute) return <Outlet />;
  return <AppShell title="Neon Arcade">
    <div data-testid="arcade-hub" className="space-y-5 px-3 pb-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#FF2E97]/50 bg-[#21113B]/90 p-5 shadow-[0_0_24px_rgba(255,46,151,0.2)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-8 -top-10 text-8xl opacity-20">🎮</div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#22E4F2]">Spiel · Sammle · Steige auf</p>
        <h2 className="mt-1 font-display text-3xl text-neon-gradient">Neon Arcade</h2>
        <p className="mt-2 max-w-md text-sm text-[#BFAAD9]">Echte Touch-Spiele für iPhone. Gewertete Runden geben dir Coins und Arcade-XP – Community-Abzeichen bleiben davon unberührt.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2"><CoinBalance /><span data-testid="arcade-xp-hint" className="inline-flex items-center gap-1.5 rounded-full border border-[#22E4F2]/50 bg-[#22E4F2]/10 px-3 py-1.5 text-sm font-bold text-[#22E4F2]"><Zap className="h-4 w-4" />Arcade-XP separat</span></div>
        {!user && <p data-testid="arcade-guest-note" className="mt-3 text-xs text-[#BFAAD9]">Du kannst die Spiele testen. Für Ranglisten, Coins und XP musst du angemeldet sein.</p>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {ARCADE_GAMES.map((game) => <article key={game.id} data-testid={`game-tile-${game.id}`} className="group relative overflow-hidden rounded-3xl border border-[#FF2E97]/55 bg-[#21113B]/90 p-4 shadow-[0_0_18px_rgba(255,46,151,0.14)] transition-transform duration-200 active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3"><span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#22E4F2]/40 bg-[#0B0418] text-3xl shadow-[inset_0_0_15px_rgba(34,228,242,0.15)]">{game.icon}</span><span className="rounded-full border border-[#FFD12A]/50 px-2 py-1 text-xs font-bold text-[#FFD12A]">bis {game.maxCoins} 🪙</span></div>
          <h3 className="mt-3 font-display text-xl">{game.name}</h3><p className="mt-1 min-h-10 text-sm text-[#BFAAD9]">{game.description}</p><GameHighscore game={game.id} enabled={!!user} />
          <div className="mt-4 flex gap-2"><Link to={game.id === "neon_highway" ? "/arcade/highway" : "/arcade/fishing"} data-testid={`game-play-${game.id}`} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_16px_rgba(255,46,151,0.35)] transition-transform duration-100 active:scale-95">Spielen <ArrowRight className="h-4 w-4" /></Link><button type="button" data-testid={`game-leaderboard-${game.id}`} onClick={() => setLeaderboard(game.id)} className="grid min-h-12 min-w-12 place-items-center rounded-full border border-[#22E4F2]/60 text-[#22E4F2] transition-transform duration-100 active:scale-95" aria-label={`Top 5 ${game.name}`}><Trophy className="h-5 w-5" /></button></div>
        </article>)}
      </section>
      <section className="rounded-3xl border border-border bg-card/65 p-4"><h3 className="flex items-center gap-2 font-display"><LockKeyhole className="h-4 w-4 text-[#BFAAD9]" />Weitere Spiele kommen als echte Spielmodi</h3><p className="mt-1 text-xs text-muted-foreground">Keine Attrappen: Diese acht Spiele werden erst freigeschaltet, wenn ihre Touch-Mechanik und serverseitige Wertung fertig getestet sind.</p><div className="mt-3 flex flex-wrap gap-2">{UPCOMING_ARCADE_GAMES.map((name) => <span key={name} data-testid="upcoming-game-chip" className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">{name}</span>)}</div></section>
      <p data-testid="arcade-security-note" className="text-center text-[11px] text-muted-foreground">Serverseitige Rundennummern, Score-Grenzen, Tageslimits und idempotente Belohnungen schützen die gewerteten Ergebnisse. Browser-Spiele bleiben grundsätzlich nicht vollständig cheatfrei.</p>
    </div>
    {leaderboard && <LeaderboardModal game={leaderboard} gameName={ARCADE_GAMES.find((x) => x.id === leaderboard)?.name ?? "Arcade"} open onOpenChange={(open) => !open && setLeaderboard(null)} />}
  </AppShell>;
}
