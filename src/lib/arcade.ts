import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";

import { tr } from "@/lib/i18n";
export type ArcadeGameId = "neon_highway" | "leonida_fishing";
export type ArcadeRoundStart = { round_id: string; seed: string; started_at: string; max_duration_seconds: number; max_score: number };
export type ArcadeRoundResult = { round_id: string; score: number; coins: number; xp: number; new_high_score: boolean; already_processed?: boolean; daily_limit_reached?: boolean };
export type LeaderboardEntry = { rank: number; user_id: string; username: string | null; score: number };
export type ArcadeStats = { high_score: number | null; rank: number | null; xp_earned: number };

export const ARCADE_GAMES: { id: ArcadeGameId; name: string; description: string; icon: string; maxCoins: number; maxXp: number; playable: boolean }[] = [
  { id: "neon_highway", name: "Neon Highway", description: tr("Weiche dem Verkehr aus und rase durch die Neon-Nacht."), icon: "🏎️", maxCoins: 40, maxXp: 20, playable: true },
  { id: "leonida_fishing", name: "Leonida Fishing", description: tr("15 Würfe pro Tag: Köder wählen, im richtigen Moment einholen und fünf Fischarten sammeln."), icon: "🎣", maxCoins: 250, maxXp: 5, playable: true },
];
export const UPCOMING_ARCADE_GAMES = [tr("Alligator-Jagd"), "Leonida Memory", "Neon Snake", "Flamingo Flight", "Beach Basketball", "Sunset Runner", "Neon Breaker", "Leonida Quiz"];

export function arcadeError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return tr("Das hat nicht geklappt.");
  if (isMissing(error)) return tr("Arcade-Belohnungen werden nach dem Datenbank-Update (SQL 013) aktiv.");
  const msg = error.message ?? "";
  if (msg.includes("AUTH_REQUIRED")) return tr("Bitte melde dich an, um gewertete Runden zu spielen.");
  if (msg.includes("ROUND_TOO_SHORT")) return tr("Diese Runde war zu kurz und wurde nicht gewertet.");
  if (msg.includes("ROUND_EXPIRED")) return tr("Diese Runde war über 6 Stunden offen und ist verfallen.");
  if (msg.includes("ROUND_DURATION_INVALID")) return tr("Die gemeldete Spielzeit war nicht plausibel – die Runde wurde nicht gewertet.");
  if (msg.includes("ROUND_NOT_FOUND") || msg.includes("ROUND_CLOSED")) return tr("Diese Runde ist nicht mehr offen und konnte nicht gewertet werden.");
  if (msg.includes("ROUND_SCORE_INVALID")) return tr("Das Ergebnis war serverseitig nicht plausibel und wurde nicht gewertet.");
  if (msg.includes("INSUFFICIENT_COINS")) return tr("Du hast nicht genug Leonida Coins.");
  if (msg.includes("SPOT_NOT_FOUND")) return tr("Dieser Fundort ist nicht mehr verfügbar.");
  return tr("Die Arcade-Aktion konnte nicht abgeschlossen werden.");
}

export function spotUnlockError(error: { code?: string; message?: string; details?: string } | null | undefined): string {
  if (!error) return tr("Die Fundort-Freischaltung konnte nicht abgeschlossen werden.");
  if (isMissing(error)) return tr("Die Fundort-Freischaltung ist in der Datenbank noch nicht eingerichtet. Bitte SQL 013 in Lovable ausführen.");
  const text = [error.message, error.details].filter(Boolean).join(" ");
  if (text.includes("AUTH_REQUIRED")) return tr("Bitte melde dich an, um Fundorte freizuschalten.");
  if (text.includes("INSUFFICIENT_COINS")) return tr("Du hast nicht genug Leonida Coins. Ab dem 6. Fundort brauchst du genau 500 Coins.");
  if (text.includes("SPOT_NOT_FOUND")) return tr("Dieser Fundort ist nicht mehr verfügbar.");
  if (error.code === "23505") return tr("Dieser Fundort ist bereits freigeschaltet. Lade die Seite kurz neu.");
  if (error.code === "42501") return tr("Du hast keine Berechtigung, diesen Fundort freizuschalten.");
  if (error.code === "42702" || text.toLowerCase().includes("ambiguous") || text.includes("column reference")) return tr("Die Datenbank benötigt das Fundort-Update SQL 018 in Lovable.");
  if (error.code === "57014" || text.toLowerCase().includes("network") || text.toLowerCase().includes("fetch")) return tr("Die Verbindung wurde unterbrochen. Dein Coin-Guthaben wurde nicht verändert. Bitte versuche es erneut.");
  return tr("Die Fundort-Freischaltung konnte nicht abgeschlossen werden.");
}

export async function startArcadeRound(game: ArcadeGameId): Promise<ArcadeRoundStart | null> {
  const { data, error } = await sb.rpc("start_arcade_round", { _game: game });
  if (error) { if (isMissing(error)) return null; throw error; }
  return data as ArcadeRoundStart;
}
/** Serverseitige Ablehnungsgründe – alles andere (z. B. kurzer Netzabbruch) wird automatisch erneut versucht. */
const FINAL_ARCADE_ERRORS = /AUTH_REQUIRED|ROUND_|GAME_UNAVAILABLE/;
export async function finishArcadeRound(roundId: string, score: number, durationMs: number): Promise<ArcadeRoundResult | null> {
  const args = { _round: roundId, _score: Math.max(0, Math.floor(score)), _duration_ms: Math.max(0, Math.round(durationMs)) };
  // Die Wertung ist serverseitig idempotent (Round-ID): eine Wiederholung kann nie doppelt Coins gutschreiben.
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await sb.rpc("finish_arcade_round", args);
    if (!error) return data as ArcadeRoundResult;
    if (isMissing(error)) return null;
    if (attempt >= 3 || FINAL_ARCADE_ERRORS.test(error.message ?? "")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
  }
}

export function useCoinBalance(enabled: boolean) {
  return useQuery({ queryKey: ["coin-balance"], enabled, staleTime: 10_000, queryFn: async () => {
    const { data, error } = await sb.rpc("my_coin_balance");
    if (error) { if (isMissing(error)) return null; throw error; }
    return Number(data ?? 0);
  } });
}
export function useArcadeLeaderboard(game: ArcadeGameId, enabled: boolean) {
  return useQuery({ queryKey: ["arcade-leaderboard", game], enabled, staleTime: 10_000, queryFn: async () => {
    const { data, error } = await sb.rpc("arcade_leaderboard", { _game: game });
    if (error) { if (isMissing(error)) return null; throw error; }
    return (data ?? []) as LeaderboardEntry[];
  } });
}
export function useArcadeStats(game: ArcadeGameId, enabled: boolean) {
  return useQuery({ queryKey: ["arcade-stats", game], enabled, staleTime: 10_000, queryFn: async () => {
    const { data, error } = await sb.rpc("my_arcade_stats", { _game: game });
    if (error) { if (isMissing(error)) return null; throw error; }
    return ((data as ArcadeStats[] | null)?.[0] ?? null);
  } });
}
export function useFinishArcadeRound(game: ArcadeGameId) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ roundId, score, durationMs }: { roundId: string; score: number; durationMs: number }) => finishArcadeRound(roundId, score, durationMs), onSettled: () => {
    void qc.invalidateQueries({ queryKey: ["coin-balance"] });
    void qc.invalidateQueries({ queryKey: ["arcade-leaderboard", game] });
    void qc.invalidateQueries({ queryKey: ["arcade-stats", game] });
    void qc.invalidateQueries({ queryKey: ["profiles"] });
    void qc.invalidateQueries({ queryKey: ["level-rewards"] });
  } });
}

export function useSpotAccess(spotId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ["spot-access", spotId], enabled: enabled && !!spotId, queryFn: async () => {
    const { data, error } = await sb.rpc("my_spot_access", { _spot: spotId });
    if (error) { if (isMissing(error)) return null; throw error; }
    return data === true;
  } });
}

export type SpotUnlockPreview = { unlocked: boolean; unlocked_count: number; free_remaining: number; cost: number; balance: number };

/** UI-Vorschau; unlock_spot bleibt die alleinige serverseitige Autorität für Preis und Abbuchung. */
export function useSpotUnlockPreview(spotId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ["spot-unlock-preview", spotId], enabled: enabled && !!spotId, queryFn: async (): Promise<SpotUnlockPreview | null> => {
    const { data, error } = await sb.rpc("my_spot_unlock_preview", { _spot: spotId });
    if (error) { if (isMissing(error)) return null; throw error; }
    return (data as SpotUnlockPreview[] | null)?.[0] ?? null;
  } });
}

const FINAL_UNLOCK_ERRORS = /AUTH_REQUIRED|INSUFFICIENT_COINS|SPOT_NOT_FOUND|23505|42501|42702|column reference|ambiguous|PGRST202|PGRST205|42P01/;

async function unlockSpotWithRetry(spotId: string) {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await sb.rpc("unlock_spot", { _spot: spotId });
    if (!error) return (data as { unlocked: boolean; cost: number; balance: number; free_unlock_number: number | null }[])[0];
    if (attempt >= 3 || FINAL_UNLOCK_ERRORS.test(`${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
  }
}

export function useUnlockSpot() {
  const qc = useQueryClient();
  return useMutation({
    // Die RPC ist atomar und idempotent: ein Retry nach einem Netzfehler kann keine zweite Abbuchung erzeugen.
    mutationFn: unlockSpotWithRetry,
    onSuccess: (result, spotId) => {
      qc.setQueryData(["spot-access", spotId], true);
      if (typeof result?.balance === "number") qc.setQueryData(["coin-balance"], result.balance);
    },
    onSettled: (_data, _error, spotId) => {
      void qc.invalidateQueries({ queryKey: ["coin-balance"] });
      void qc.invalidateQueries({ queryKey: ["spot-access", spotId] });
      void qc.invalidateQueries({ queryKey: ["spot-unlock-preview", spotId] });
    },
  });
}
