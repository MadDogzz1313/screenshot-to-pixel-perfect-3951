import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";
import { tr } from "@/lib/i18n";
import neonSunset from "@/assets/frames/neon_sunset.webp";
import neonSunsetStatic from "@/assets/frames/neon_sunset-static.webp";
import goldenCrown from "@/assets/frames/golden_crown.webp";
import goldenCrownStatic from "@/assets/frames/golden_crown-static.webp";
import neonSkyline from "@/assets/frames/neon_skyline.webp";
import neonSkylineStatic from "@/assets/frames/neon_skyline-static.webp";
import cyberLightning from "@/assets/frames/cyber_lightning.webp";
import cyberLightningStatic from "@/assets/frames/cyber_lightning-static.webp";
import neonCoast from "@/assets/frames/neon_coast.webp";
import neonCoastStatic from "@/assets/frames/neon_coast-static.webp";

/** Animierte Profilrahmen (SQL 029). Kauf/Ausrüsten nur per RPC; Preis kommt vom Server. */
export type FrameId = "neon_sunset" | "golden_crown" | "neon_skyline" | "cyber_lightning" | "neon_coast";
export type ProfileFrameDef = { id: FrameId; name: string; price: number; premium: boolean; anim: string; still: string };
export const PROFILE_FRAMES: ProfileFrameDef[] = [
  { id: "neon_sunset", name: "Neon Sunset", price: 1500, premium: false, anim: neonSunset, still: neonSunsetStatic },
  { id: "golden_crown", name: "Golden Crown", price: 3000, premium: true, anim: goldenCrown, still: goldenCrownStatic },
  { id: "neon_skyline", name: "Neon Skyline", price: 1500, premium: false, anim: neonSkyline, still: neonSkylineStatic },
  { id: "cyber_lightning", name: "Cyber Lightning", price: 1500, premium: false, anim: cyberLightning, still: cyberLightningStatic },
  { id: "neon_coast", name: "Neon Coast", price: 1500, premium: false, anim: neonCoast, still: neonCoastStatic },
];
export const frameById = (id: string | null | undefined) => PROFILE_FRAMES.find((f) => f.id === id);
/** Anteil des Profilbild-Durchmessers an der Rahmenbreite (innerer Ring der Vorlagen). */
export const FRAME_AVATAR_RATIO = 0.76;

export type FrameEntry = ProfileFrameDef & { owned: boolean; equipped: boolean; purchasedAt: string | null };
export type MyFrames = { setupMissing: boolean; entries: FrameEntry[]; equipped: FrameId | null };
type Row = { id: string; name: string; price: number; premium: boolean; owned: boolean; equipped: boolean; purchased_at: string | null };
export const myFramesKey = (uid: string | undefined) => ["profile-frames", uid ?? "guest"] as const;
export const frameOfKey = (userId: string | undefined) => ["profile-frame", userId ?? "none"] as const;
const fallback = (setupMissing: boolean): MyFrames => ({ setupMissing, equipped: null, entries: PROFILE_FRAMES.map((f) => ({ ...f, owned: false, equipped: false, purchasedAt: null })) });

export function useMyFrames(uid: string | undefined) {
  return useQuery({
    queryKey: myFramesKey(uid),
    staleTime: 15_000,
    queryFn: async (): Promise<MyFrames> => {
      const { data, error } = await sb.rpc("my_profile_frames");
      if (error) { if (isMissing(error)) return fallback(true); throw error; }
      const rows = new Map(((data ?? []) as Row[]).map((r) => [r.id, r]));
      const entries = PROFILE_FRAMES.filter((f) => rows.has(f.id)).map((f) => {
        const r = rows.get(f.id)!;
        return { ...f, name: r.name || f.name, price: Number(r.price), premium: !!r.premium, owned: !!r.owned, equipped: !!r.equipped, purchasedAt: r.purchased_at };
      });
      if (!entries.length) return fallback(false);
      return { setupMissing: false, entries, equipped: entries.find((e) => e.equipped)?.id ?? null };
    },
  });
}

/** Aktiver Rahmen eines beliebigen Nutzers (öffentlich lesbar, rein kosmetisch). */
export function useProfileFrame(userId: string | undefined) {
  return useQuery({
    queryKey: frameOfKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<FrameId | null> => {
      const { data, error } = await sb.from("profile_frame_loadouts").select("frame_id").eq("user_id", userId!).maybeSingle();
      if (error) { if (isMissing(error)) return null; throw error; }
      return (frameById((data as { frame_id: string | null } | null)?.frame_id)?.id ?? null);
    },
  });
}

export function frameError(error: { code?: string; message?: string; details?: string } | null | undefined): string {
  if (!error) return tr("Das hat nicht geklappt.");
  if (isMissing(error)) return tr("Profilrahmen werden nach dem Datenbank-Update (SQL 029) aktiv.");
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return tr("Bitte melde dich an, um Profilrahmen zu kaufen.");
  if (text.includes("INSUFFICIENT_COINS")) return tr("Du hast nicht genug Leonida Coins für diesen Profilrahmen.");
  if (text.includes("FRAME_LOCKED")) return tr("Dieser Profilrahmen ist noch gesperrt. Du kannst ihn im Neoshop kaufen.");
  if (text.includes("FRAME_NOT_FOUND")) return tr("Dieser Profilrahmen ist nicht mehr verfügbar.");
  if (text.includes("ACCOUNT_BANNED")) return tr("Dein Konto ist gesperrt.");
  if (text.includes("RATE_LIMIT")) return tr("Zu viele Versuche – bitte warte kurz.");
  if (/fetch|network|load failed/i.test(text)) return tr("Die Verbindung wurde unterbrochen. Dein Coin-Guthaben wurde nicht verändert. Bitte versuche es erneut.");
  return tr("Die Aktion konnte nicht abgeschlossen werden.");
}

const FINAL = /AUTH_REQUIRED|INSUFFICIENT_COINS|FRAME_|ACCOUNT_BANNED|RATE_LIMIT|PGRST20|42P01|42883|42501/;
type BuyResult = { frame_id: string; charged: number; balance: number; already_owned: boolean };

export function useBuyFrame(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    // Idempotent (Besitz unique + Wallet-Sperre): Wiederholen nach Netzabbruch bucht nie doppelt ab.
    mutationFn: async (id: FrameId): Promise<BuyResult> => {
      for (let attempt = 1; ; attempt++) {
        const { data, error } = await sb.rpc("buy_profile_frame", { _frame: id });
        if (!error) return data as BuyResult;
        if (attempt >= 3 || FINAL.test(`${error.code ?? ""} ${error.message ?? ""}`)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    },
    onSuccess: (r) => { if (typeof r?.balance === "number") qc.setQueryData(["coin-balance"], Number(r.balance)); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ["coin-balance"] }); void qc.invalidateQueries({ queryKey: myFramesKey(uid) }); },
  });
}

export function useEquipFrame(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: FrameId | null) => { const { error } = await sb.rpc("equip_profile_frame", { _frame: id }); if (error) throw error; return id; },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: myFramesKey(uid) });
      const prev = qc.getQueryData<MyFrames>(myFramesKey(uid)); const prevOf = qc.getQueryData<FrameId | null>(frameOfKey(uid));
      if (prev) qc.setQueryData<MyFrames>(myFramesKey(uid), { ...prev, equipped: id, entries: prev.entries.map((e) => ({ ...e, equipped: e.id === id })) });
      qc.setQueryData(frameOfKey(uid), id);
      return { prev, prevOf };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(myFramesKey(uid), ctx.prev); qc.setQueryData(frameOfKey(uid), ctx?.prevOf ?? null); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: myFramesKey(uid) }); void qc.invalidateQueries({ queryKey: frameOfKey(uid) }); },
  });
}
