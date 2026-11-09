// Datenzugriffe für Abzeichen, Rangliste, Korrekturen, Spenden, Profilbilder (SQL 004).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";
import type { Progress } from "./badges";

export function useUserBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ["badges", userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sb.from("user_badges").select("badge_id, awarded_at").eq("user_id", userId!);
      if (error) { if (isMissing(error)) return { ready: false, ids: [] as string[] }; throw error; }
      return { ready: true, ids: (data as { badge_id: string }[]).map((r) => r.badge_id) };
    },
  });
}
export function useMyProgress(enabled: boolean) {
  return useQuery({
    queryKey: ["progress"], enabled,
    queryFn: async () => {
      const { data, error } = await sb.rpc("my_badge_progress");
      if (error) { if (isMissing(error)) return undefined; throw error; }
      return data as Progress;
    },
  });
}
export interface RankRow { rank: number; user_id: string; username: string; approved_count: number; reached_at: string; period_start: string; period_end: string; final: boolean }
export function useLeaderboard(month: string) {
  return useQuery({
    queryKey: ["leaderboard", month],
    queryFn: async () => {
      const { data, error } = await sb.rpc("monthly_leaderboard", { _month: month });
      if (error) { if (isMissing(error)) return null; throw error; }
      return data as RankRow[];
    },
  });
}
export interface CorrectionRow { id: string; spot_id: string; message: string; status: string; created_at: string; user: { username: string } | null; spot: { title: string } | null }
export function usePendingCorrections(enabled: boolean) {
  return useQuery({
    queryKey: ["corrections"], enabled,
    queryFn: async () => {
      const { data, error } = await sb.from("spot_corrections")
        .select("id, spot_id, message, status, created_at, user:profiles!spot_corrections_user_id_fkey(username), spot:spots(title)")
        .eq("status", "pending").order("created_at");
      if (error) throw error;
      return data as unknown as CorrectionRow[];
    },
  });
}
export interface DonationRow { id: string; user_id: string; amount_cents: number; note: string | null; created_at: string }
export function useDonations(enabled: boolean) {
  return useQuery({
    queryKey: ["donations"], enabled,
    queryFn: async () => {
      const { data, error } = await sb.from("donations").select("id, user_id, amount_cents, note, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) { if (isMissing(error)) return null; throw error; }
      return data as DonationRow[];
    },
  });
}
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
const dbErr = (e: { code?: string; message?: string } | null, fallback: string) =>
  !e ? null : isMissing(e) ? "Diese Funktion wird nach dem Datenbank-Update (SQL 004) aktiv." : (e.message?.includes("Abzeichen") || e.message?.includes("Admin") ? e.message : fallback);

export async function submitCorrection(spotId: string, userId: string, message: string) {
  const { error } = await sb.from("spot_corrections").insert({ spot_id: spotId, user_id: userId, message });
  return dbErr(error, "Korrektur konnte nicht gesendet werden");
}
export async function reviewCorrection(id: string, status: "confirmed" | "rejected") {
  const { data, error } = await sb.from("spot_corrections").update({ status }).eq("id", id).select("id");
  return dbErr(error, "Speichern fehlgeschlagen") ?? (data?.length ? null : "Keine Berechtigung");
}
export async function setAccuracy(spotId: string, verified: boolean) {
  const { error } = await sb.rpc("set_spot_accuracy", { _spot: spotId, _verified: verified });
  return dbErr(error, "Speichern fehlgeschlagen");
}
export async function addDonation(userId: string, adminId: string, euros: number, note: string) {
  const { error } = await sb.from("donations").insert({ user_id: userId, amount_cents: Math.round(euros * 100), note: note || null, verified_by: adminId });
  return dbErr(error, "Spende konnte nicht gespeichert werden");
}
export async function deleteDonation(id: string) {
  const { error } = await sb.from("donations").delete().eq("id", id);
  return dbErr(error, "Löschen fehlgeschlagen");
}
/** Profilbild: privater Bucket "avatars", Pfad <user-id>/<zufall>.jpg; altes Bild wird entfernt. */
export async function uploadAvatar(userId: string, blob: Blob, oldPath: string | null) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) return up.error.message.toLowerCase().includes("bucket") ? "Profilbilder werden nach dem Datenbank-Update (SQL 004) aktiv." : "Hochladen fehlgeschlagen";
  const { error } = await sb.from("profiles").update({ avatar_url: path }).eq("id", userId);
  if (error) { await sb.storage.from("avatars").remove([path]); return "Speichern fehlgeschlagen"; }
  if (oldPath && oldPath !== path) await sb.storage.from("avatars").remove([oldPath]);
  return null;
}
export async function deleteAvatar(userId: string, path: string | null) {
  const { error } = await sb.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) return "Löschen fehlgeschlagen";
  if (path) await sb.storage.from("avatars").remove([path]);
  return null;
}
