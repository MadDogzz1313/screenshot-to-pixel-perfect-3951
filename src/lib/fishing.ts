import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";
import { tr } from "@/lib/i18n";
import kuestenbarschImg from "@/assets/fishing/kuestenbarsch.webp";
import sonnenbarschImg from "@/assets/fishing/sonnenbarsch.webp";
import neonMakreleImg from "@/assets/fishing/neon_makrele.webp";
import palmenschnapperImg from "@/assets/fishing/palmenschnapper.webp";
import leonidaMarlinImg from "@/assets/fishing/leonida_marlin.webp";
import mythicMarlinImg from "@/assets/fishing/mythic_marlin.webp";

/**
 * Leonida Fishing v2 (SQL 027). Der Server würfelt den Fisch beim Auswerfen und prüft das Zeitfenster beim Einholen;
 * der Client zeigt nur an. Werte unten spiegeln die Tabellen fishing_species / fishing_baits.
 */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type SpeciesId = "kuestenbarsch" | "sonnenbarsch" | "neon_makrele" | "palmenschnapper" | "leonida_marlin" | "mythic_marlin";
export type BaitId = `bait_${Rarity}`;
export type FishSpecies = { id: SpeciesId; rarity: Rarity; name: string; baseChance: number; coins: number; image: string };
export type Bait = { id: BaitId; rarity: Rarity; name: string; price: number; uses: number; boost: number; consumeOnCast: boolean };

export const DAILY_CASTS = 15;
export const BAIT_USES = 3;
export const BAIT_BOOST = 4; // +300 % = ×4 (Mythischer Köder: ×2, siehe BAIT_RULES)

export const RARITY_STYLE: Record<Rarity, { label: string; color: string; glow: string }> = {
  common: { label: tr("Gewöhnlich"), color: "#EDEAF7", glow: "rgba(237,234,247,0.45)" },
  uncommon: { label: tr("Ungewöhnlich"), color: "#3DFF8F", glow: "rgba(61,255,143,0.45)" },
  rare: { label: tr("Selten"), color: "#3AA8FF", glow: "rgba(58,168,255,0.5)" },
  epic: { label: tr("Episch"), color: "#C04DFF", glow: "rgba(192,77,255,0.5)" },
  legendary: { label: tr("Legendär"), color: "#FFC83D", glow: "rgba(255,200,61,0.6)" },
  mythic: { label: tr("Mythisch"), color: "#FF5FD2", glow: "rgba(176,38,255,0.7)" },
};

export const FISH: FishSpecies[] = [
  { id: "kuestenbarsch", rarity: "common", name: "Küstenbarsch", baseChance: 50, coins: 25, image: kuestenbarschImg },
  { id: "sonnenbarsch", rarity: "uncommon", name: "Sonnenbarsch", baseChance: 25, coins: 50, image: sonnenbarschImg },
  { id: "neon_makrele", rarity: "rare", name: "Neon-Makrele", baseChance: 12, coins: 100, image: neonMakreleImg },
  { id: "palmenschnapper", rarity: "epic", name: "Palmenschnapper", baseChance: 7.5, coins: 175, image: palmenschnapperImg },
  { id: "leonida_marlin", rarity: "legendary", name: "Leonida-Marlín", baseChance: 5, coins: 250, image: leonidaMarlinImg },
  { id: "mythic_marlin", rarity: "mythic", name: "Mythischer Leonida-Marlín", baseChance: 0.5, coins: 5000, image: mythicMarlinImg },
];
export const fishById = (id: string | null | undefined) => FISH.find((f) => f.id === id);
export const fishByRarity = (rarity: Rarity) => FISH.find((f) => f.rarity === rarity)!;

const BAIT_NAMES: Record<Rarity, string> = {
  common: tr("Gewöhnlicher Köder"), uncommon: tr("Ungewöhnlicher Köder"), rare: tr("Seltener Köder"), epic: tr("Epischer Köder"), legendary: tr("Legendärer Köder"), mythic: tr("Mythischer Köder"),
};
/** Sonderregeln: Mythischer Köder 150 Coins, ×2 (0,5 % → 1 %), Nutzung pro Angelversuch. */
const BAIT_RULES: Partial<Record<Rarity, { price: number; boost: number; consumeOnCast: boolean }>> = { mythic: { price: 150, boost: 2, consumeOnCast: true } };
/** Köderpreis = halbe Belohnung des Ziel-Fisches, abgerundet (außer Sonderregel). */
export const baitPrice = (rarity: Rarity) => BAIT_RULES[rarity]?.price ?? Math.floor(fishByRarity(rarity).coins / 2);
export const BAITS: Bait[] = FISH.map((f) => ({ id: `bait_${f.rarity}` as BaitId, rarity: f.rarity, name: BAIT_NAMES[f.rarity], price: baitPrice(f.rarity), uses: BAIT_USES,
  boost: BAIT_RULES[f.rarity]?.boost ?? BAIT_BOOST, consumeOnCast: BAIT_RULES[f.rarity]?.consumeOnCast ?? false }));
export const baitById = (id: string | null | undefined) => BAITS.find((b) => b.id === id);

/**
 * Fangchancen in Prozent. Ohne Köder = Grundchancen. Mit Köder: Ziel-Chance ×4 (Mythisch ×2, max. 100 %),
 * alle anderen werden mit (100 − neu) / (100 − alt) skaliert → Summe immer exakt 100 %.
 * Identisch zu public.fishing_odds() in SQL 027.
 */
export function fishingOdds(baitRarity: Rarity | null): Record<SpeciesId, number> {
  const out = {} as Record<SpeciesId, number>;
  const target = baitRarity ? fishByRarity(baitRarity) : null;
  const boost = baitRarity ? (BAIT_RULES[baitRarity]?.boost ?? BAIT_BOOST) : 1;
  const boosted = target ? Math.min(100, target.baseChance * boost) : 0;
  const scale = target ? (target.baseChance >= 100 ? 0 : (100 - boosted) / (100 - target.baseChance)) : 1;
  for (const f of FISH) out[f.id] = !target ? f.baseChance : f.id === target.id ? boosted : f.baseChance * scale;
  return out;
}
export const formatPercent = (value: number, loc: string) => `${value.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`;

// ---------- Server-Zustand ----------
export type CastInfo = {
  cast_id: string; status: "pending" | "caught" | "escaped"; outcome: string | null; bait_id: BaitId | null;
  bite_delay_ms: number; window_ms: number; elapsed_ms: number; species_id: SpeciesId | null;
  coins: number; xp: number; bait_uses_left: number | null; resolved_at: string | null;
};
export type FishingState = {
  logged_in: boolean; setupMissing?: boolean; limit: number; used: number; next_reset_at: string | null;
  selected_bait_id: BaitId | null; inventory: { id: string; bait_id: BaitId; uses_left: number }[];
  collection: Partial<Record<SpeciesId, number>>; pending: CastInfo | null; last: CastInfo | null;
};
const EMPTY: Omit<FishingState, "logged_in"> = { limit: DAILY_CASTS, used: 0, next_reset_at: null, selected_bait_id: null, inventory: [], collection: {}, pending: null, last: null };
export const fishingKey = (uid: string | undefined) => ["fishing-state", uid ?? "guest"] as const;

export function useFishingState(uid: string | undefined) {
  return useQuery({
    queryKey: fishingKey(uid),
    staleTime: 5_000,
    queryFn: async (): Promise<FishingState> => {
      const { data, error } = await sb.rpc("my_fishing_state");
      if (error) { if (isMissing(error)) return { ...EMPTY, logged_in: !!uid, setupMissing: true }; throw error; }
      const d = (data ?? {}) as Partial<FishingState>;
      return { ...EMPTY, ...d, logged_in: !!d.logged_in, inventory: d.inventory ?? [], collection: d.collection ?? {}, limit: d.limit ?? DAILY_CASTS, used: Number(d.used ?? 0) };
    },
  });
}

/** Übrige Nutzungen je Köderart (aktiver Köder = ältester Stapel zuerst). */
export function baitStock(state: FishingState | undefined, id: BaitId) {
  const items = (state?.inventory ?? []).filter((i) => i.bait_id === id && i.uses_left > 0);
  return { items: items.length, uses: items.reduce((n, i) => n + i.uses_left, 0), current: items[0]?.uses_left ?? 0 };
}

export function fishingError(error: { code?: string; message?: string; details?: string } | null | undefined): string {
  if (!error) return tr("Das hat nicht geklappt.");
  if (isMissing(error)) return tr("Leonida Fishing wird nach dem Datenbank-Update (SQL 027) aktiv.");
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return tr("Bitte melde dich an, um zu angeln und Köder zu kaufen.");
  if (text.includes("FISHING_DAILY_LIMIT")) return tr("Deine 15 Angelversuche für heute sind aufgebraucht. Komm morgen wieder!");
  if (text.includes("INSUFFICIENT_COINS")) return tr("Du hast nicht genug Leonida Coins für diesen Köder.");
  if (text.includes("BAIT_EMPTY")) return tr("Von diesem Köder hast du keine Nutzungen mehr.");
  if (text.includes("BAIT_NOT_FOUND") || text.includes("CAST_NOT_FOUND")) return tr("Das ist nicht mehr verfügbar. Bitte lade neu.");
  if (text.includes("ACCOUNT_BANNED")) return tr("Dein Konto ist gesperrt.");
  if (text.includes("RATE_LIMIT")) return tr("Zu viele Versuche – bitte warte kurz.");
  if (/fetch|network|load failed/i.test(text)) return tr("Die Verbindung wurde unterbrochen. Bitte versuche es erneut.");
  return tr("Die Aktion konnte nicht abgeschlossen werden.");
}

const FINAL = /AUTH_REQUIRED|FISHING_DAILY_LIMIT|INSUFFICIENT_COINS|BAIT_|CAST_NOT_FOUND|NONCE_REQUIRED|ACCOUNT_BANNED|RATE_LIMIT|PGRST20|42P01|42883|42501/;
/** Alle Fishing-RPCs sind idempotent (Nonce/Status) – Wiederholen nach Netzabbruch ist sicher. */
async function rpcWithRetry<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await sb.rpc(fn, args);
    if (!error) return data as T;
    if (attempt >= 4 || FINAL.test(`${error.code ?? ""} ${error.message ?? ""}`)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
  }
}
export type ReelResult = CastInfo & { already_processed: boolean; balance: number | null };
export const startFishingCast = (nonce: string) => rpcWithRetry<CastInfo & { resumed: boolean; used: number; limit: number }>("start_fishing_cast", { _nonce: nonce });
export const reelFishingCast = (castId: string, reel: boolean) => rpcWithRetry<ReelResult>("reel_fishing_cast", { _cast: castId, _reel: reel });

export function useBuyBait(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bait, nonce }: { bait: BaitId; nonce: string }) =>
      rpcWithRetry<{ charged: number; balance: number; uses_left: number; already_processed: boolean }>("buy_fishing_bait", { _bait: bait, _nonce: nonce }),
    onSuccess: (r) => { if (typeof r?.balance === "number") qc.setQueryData(["coin-balance"], Number(r.balance)); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ["coin-balance"] }); void qc.invalidateQueries({ queryKey: fishingKey(uid) }); },
  });
}

export function useSelectBait(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bait: BaitId | null) => { const { error } = await sb.rpc("select_fishing_bait", { _bait: bait }); if (error) throw error; return bait; },
    onMutate: async (bait) => {
      await qc.cancelQueries({ queryKey: fishingKey(uid) });
      const previous = qc.getQueryData<FishingState>(fishingKey(uid));
      if (previous) qc.setQueryData<FishingState>(fishingKey(uid), { ...previous, selected_bait_id: bait });
      return { previous };
    },
    onError: (_e, _b, ctx) => { if (ctx?.previous) qc.setQueryData(fishingKey(uid), ctx.previous); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: fishingKey(uid) }); },
  });
}

export const newNonce = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)));
