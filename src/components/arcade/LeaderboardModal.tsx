import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { arcadeError, useArcadeLeaderboard, useArcadeStats, type ArcadeGameId } from "@/lib/arcade";

import { tr, locale } from "@/lib/i18n";
const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
export function LeaderboardModal({ game, gameName, open, onOpenChange }: { game: ArcadeGameId; gameName: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useStore();
  const board = useArcadeLeaderboard(game, open && !!user);
  const stats = useArcadeStats(game, open && !!user);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent data-testid={`leaderboard-modal-${game}`} className="max-w-md border-[#22E4F2]/60 bg-[#1A0C33] p-0 text-foreground shadow-[0_0_34px_rgba(34,228,242,0.22)]">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <DialogHeader><DialogTitle className="flex items-center gap-2 font-display text-xl text-neon-gradient"><Trophy className="h-5 w-5 text-[#FFD12A]" />Top 5 · {gameName}</DialogTitle><DialogDescription>{tr("Score bestimmt den Rang. XP und Coins werden getrennt gespeichert.")}</DialogDescription></DialogHeader>
        {!user && <p data-testid="leaderboard-login-hint" className="mt-4 rounded-xl border border-neon/30 bg-card p-3 text-sm text-muted-foreground">{tr("Melde dich an, um deine Rangliste und persönliche Bestwerte zu sehen.")}</p>}
        {board.isError && <p data-testid="leaderboard-error" className="mt-4 rounded-xl bg-destructive/15 p-3 text-sm">{arcadeError(board.error)}</p>}
        {board.data === null && <p data-testid="leaderboard-setup-hint" className="mt-4 rounded-xl border border-neon/30 bg-card p-3 text-sm text-muted-foreground">{tr("Die echten Ranglisten werden nach dem Datenbank-Update (SQL 013) aktiv.")}</p>}
        {board.data && <ol data-testid={`leaderboard-list-${game}`} className="mt-4 space-y-2">{board.data.map((entry, index) => <li key={entry.user_id} data-testid={`leaderboard-row-${game}-${index + 1}`} className="flex items-center gap-3 rounded-xl border border-neon/25 bg-card/80 px-3 py-2.5"><span className="w-7 text-xl">{medals[index]}</span><span className="min-w-0 flex-1 truncate font-semibold">{entry.username ?? tr("Spieler")}</span><span className="font-mono text-sm text-[#FFD12A]">{entry.score.toLocaleString(locale())}</span></li>)}</ol>}
        {stats.data && <div data-testid={`leaderboard-personal-${game}`} className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[#FF2E97]/35 bg-[#21113B] p-3 text-center text-xs"><div><span className="block text-muted-foreground">{tr("Dein Highscore")}</span><b>{stats.data.high_score?.toLocaleString(locale()) ?? "–"}</b></div><div><span className="block text-muted-foreground">{tr("Dein Rang")}</span><b>{stats.data.rank ? `#${stats.data.rank}` : "–"}</b></div><div><span className="block text-muted-foreground">Arcade-XP</span><b>{stats.data.xp_earned}</b></div></div>}
      </div>
    </DialogContent>
  </Dialog>;
}
