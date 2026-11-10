import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";

export type ArcadeGameId = "neon_highway" | "leonida_fishing";
export type ArcadeRoundStart = { round_id: string; seed: string; started_at: string; max_duration_seconds: number; max_score: number };
export type ArcadeRoundResult = { round_id: string; score: number; coins: number; xp: number; new_high_score: boolean; already_processed?: boolean };
export type LeaderboardEntry = { rank: number; user_id: string; username: string | null; score: number };
export type ArcadeStats = { high_score: number | null; rank: number | null; xp_earned: number };

export const ARCADE_GAMES: { id: ArcadeGameId; name: string; description: string; icon: string; maxCoins: number; maxXp: number; playable: boolean }[] = [
  { id: "neon_highway", name: "Neon Highway", description: "Weiche dem Verkehr aus und rase durch die Neon-Nacht.", icon: "🏎️", maxCoins: 40, maxXp: 20, playable: true },
  { id: "leonida_fishing", name: "Leonida Fishing", description: "Treffe den richtigen Moment und ziehe seltene Fische an Land.", icon: "🎣", maxCoins: 35, maxXp: 18, playable: true },
];
export const UPCOMING_ARCADE_GAMES = ["Alligator-Jagd", "Leonida Memory", "Neon Snake", "Flamingo Flight", "Beach Basketball", "Sunset Runner", "Neon Breaker", "Leonida Quiz"];

export function arcadeError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Das hat nicht geklappt.";
  if (isMissing(error)) return "Arcade-Belohnungen werden nach dem Datenbank-Update (SQL 013) aktiv.";
  const msg = error.message ?? "";
  if (msg.includes("AUTH_REQUIRED")) return "Bitte melde dich an, um gewertete Runden zu spielen.";
  if (msg.includes("ROUND_DURATION_INVALID")) return "Diese Runde war zu kurz, zu lang oder wurde unterbrochen und wurde nicht gewertet.";
  if (msg.includes("ROUND_SCORE_INVALID")) return "Das Ergebnis war serverseitig nicht plausibel und wurde nicht gewertet.";
  if (msg.includes("INSUFFICIENT_COINS")) return "Du hast nicht genug Leonida Coins.";
  if (msg.includes("SPOT_NOT_FOUND")) return "Dieser Fundort ist nicht mehr verfügbar.";
  return "Die Arcade-Aktion konnte nicht abgeschlossen werden.";
}

export async function startArcadeRound(game: ArcadeGameId): Promise<ArcadeRoundStart | null> {
  const { data, error } = await sb.rpc("start_arcade_round", { _game: game });
  if (error) { if (isMissing(error)) return null; throw error; }
  return data as ArcadeRoundStart;
}
export async function finishArcadeRound(roundId: string, score: number, durationMs: number): Promise<ArcadeRoundResult | null> {
  const { data, error } = await sb.rpc("finish_arcade_round", { _round: roundId, _score: Math.max(0, Math.round(score)), _duration_ms: Math.max(0, Math.round(durationMs)) });
  if (error) { if (isMissing(error)) return null; throw error; }
  return data as ArcadeRoundResult;
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
  } });
}

export function useSpotAccess(spotId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ["spot-access", spotId], enabled: enabled && !!spotId, queryFn: async () => {
    const { data, error } = await sb.rpc("my_spot_access", { _spot: spotId });
    if (error) { if (isMissing(error)) return null; throw error; }
    return data === true;
  } });
}
export function useUnlockSpot() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (spotId: string) => {
    const { data, error } = await sb.rpc("unlock_spot", { _spot: spotId });
    if (error) throw error;
    return (data as { unlocked: boolean; cost: number; balance: number; free_unlock_number: number | null }[])[0];
  }, onSettled: (_data, _error, spotId) => {
    void qc.invalidateQueries({ queryKey: ["coin-balance"] });
    void qc.invalidateQueries({ queryKey: ["spot-access", spotId] });
  } });
}
