import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";
import { tr } from "@/lib/i18n";
import classicRear from "@/assets/highway/player-rear.webp";
import classicHigh from "@/assets/highway/player-high.webp";
import circuitRear from "@/assets/highway/skins/circuit-rear.webp";
import circuitHigh from "@/assets/highway/skins/circuit-high.webp";
import sunsetRear from "@/assets/highway/skins/sunset-rear.webp";
import sunsetHigh from "@/assets/highway/skins/sunset-high.webp";
import flamingoRear from "@/assets/highway/skins/flamingo-rear.webp";
import flamingoHigh from "@/assets/highway/skins/flamingo-high.webp";
import stripeRear from "@/assets/highway/skins/stripe-rear.webp";
import stripeHigh from "@/assets/highway/skins/stripe-high.webp";
import galaxyRear from "@/assets/highway/skins/galaxy-rear.webp";
import galaxyHigh from "@/assets/highway/skins/galaxy-high.webp";

/**
 * Neon-Highway-Fahrzeugdesigns (rein optisch). Katalog = Tabelle `vehicle_skins` (SQL 025).
 * Preis = Ausgangspreis halbiert, ganzzahlig abgerundet – identisch zur Server-Berechnung (base_price / 2).
 * Kauf/Ausrüsten laufen ausschließlich über die RPCs buy_vehicle_skin / equip_vehicle_skin.
 */
export type VehicleSkinId = "classic" | "circuit" | "sunset" | "flamingo" | "stripe" | "galaxy";
export type VehicleSkin = { id: VehicleSkinId; name: string; tagline: string; basePrice: number; price: number; glow: string; rear: string; high: string };

export const halfPrice = (basePrice: number) => Math.floor(Math.max(0, basePrice) / 2);
const skin = (id: VehicleSkinId, name: string, tagline: string, basePrice: number, glow: string, rear: string, high: string): VehicleSkin =>
  ({ id, name, tagline, basePrice, price: halfPrice(basePrice), glow, rear, high });

export const DEFAULT_SKIN: VehicleSkinId = "classic";
export const VEHICLE_SKINS: VehicleSkin[] = [
  skin("classic", "Miami Classic", tr("Der pinke Klassiker – für alle kostenlos."), 0, "#ff2e97", classicRear, classicHigh),
  skin("circuit", "Neon Circuit", tr("Mitternachtsblau mit leuchtenden Leiterbahnen."), 1200, "#22e4f2", circuitRear, circuitHigh),
  skin("sunset", "Sunset Wave", tr("Sonnenuntergang über dem Ocean Drive."), 1500, "#ff8a3d", sunsetRear, sunsetHigh),
  skin("flamingo", "Chrome Flamingo", tr("Perlweißer Chrom mit Flamingo-Streifen."), 1600, "#ff9fd6", flamingoRear, flamingoHigh),
  skin("stripe", "Cyber Stripe", tr("Mattschwarz mit pinken Rennstreifen."), 1800, "#ff2e97", stripeRear, stripeHigh),
  skin("galaxy", "Galaxy Drift", tr("Kosmischer Nebel in Violett und Blau."), 2000, "#8b5cff", galaxyRear, galaxyHigh),
];
export const isSkinId = (id: unknown): id is VehicleSkinId => VEHICLE_SKINS.some((s) => s.id === id);
export const skinById = (id: string | null | undefined): VehicleSkin => VEHICLE_SKINS.find((s) => s.id === id) ?? VEHICLE_SKINS[0]!;

// Lokaler Spiegel der Auswahl: sofort beim App-Start verfügbar, der Server bleibt maßgeblich.
const storeKey = (uid: string | undefined) => `leonida-highway-skin:${uid ?? "guest"}`;
export function readStoredSkin(uid: string | undefined): VehicleSkinId {
  try { const v = localStorage.getItem(storeKey(uid)); return isSkinId(v) ? v : DEFAULT_SKIN; } catch { return DEFAULT_SKIN; }
}
function storeSkin(uid: string | undefined, id: VehicleSkinId) { try { localStorage.setItem(storeKey(uid), id); } catch { /* privat */ } }

export type GarageEntry = VehicleSkin & { owned: boolean; equipped: boolean };
export type Garage = { setupMissing: boolean; entries: GarageEntry[]; equipped: VehicleSkinId };
type GarageRow = { id: string; name: string; base_price: number; price: number; sort: number; owned: boolean; equipped: boolean };

const fallbackGarage = (setupMissing: boolean): Garage => ({
  setupMissing,
  equipped: DEFAULT_SKIN,
  entries: VEHICLE_SKINS.map((s) => ({ ...s, owned: s.price === 0, equipped: s.id === DEFAULT_SKIN })),
});

export const garageKey = (uid: string | undefined) => ["vehicle-garage", uid ?? "guest"] as const;

export function useVehicleGarage(uid: string | undefined) {
  return useQuery({
    queryKey: garageKey(uid),
    staleTime: 15_000,
    queryFn: async (): Promise<Garage> => {
      const { data, error } = await sb.rpc("my_vehicle_garage");
      if (error) { if (isMissing(error)) return fallbackGarage(true); throw error; }
      const rows = new Map(((data ?? []) as GarageRow[]).map((r) => [r.id, r]));
      // Nur Designs mit Bild im Client; Server-Preis ist maßgeblich (identisch berechnet).
      const entries = VEHICLE_SKINS.filter((s) => rows.has(s.id)).map((s) => {
        const r = rows.get(s.id)!;
        return { ...s, name: r.name || s.name, basePrice: Number(r.base_price), price: Number(r.price), owned: !!r.owned, equipped: !!r.equipped };
      });
      if (!entries.length) return fallbackGarage(false);
      const equipped = entries.find((e) => e.equipped)?.id ?? DEFAULT_SKIN;
      if (uid) storeSkin(uid, equipped);
      return { setupMissing: false, entries, equipped };
    },
  });
}

/** Ausgerüstetes Design: Server-Stand, bis dahin die zuletzt gespeicherte Auswahl. */
export function useEquippedSkin(uid: string | undefined): VehicleSkin {
  const garage = useVehicleGarage(uid);
  return skinById(garage.data ? garage.data.equipped : readStoredSkin(uid));
}

export function vehicleSkinError(error: { code?: string; message?: string; details?: string } | null | undefined): string {
  if (!error) return tr("Das hat nicht geklappt.");
  if (isMissing(error)) return tr("Fahrzeugdesigns werden nach dem Datenbank-Update (SQL 025) aktiv.");
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (text.includes("AUTH_REQUIRED")) return tr("Bitte melde dich an, um Fahrzeugdesigns zu kaufen und zu speichern.");
  if (text.includes("INSUFFICIENT_COINS")) return tr("Du hast nicht genug Leonida Coins für dieses Design.");
  if (text.includes("SKIN_LOCKED")) return tr("Dieses Design ist noch gesperrt. Du kannst es im Neoshop kaufen.");
  if (text.includes("SKIN_NOT_FOUND")) return tr("Dieses Design ist nicht mehr verfügbar.");
  if (text.includes("ACCOUNT_BANNED")) return tr("Dein Konto ist gesperrt.");
  if (text.includes("RATE_LIMIT")) return tr("Zu viele Versuche – bitte warte kurz.");
  if (text.toLowerCase().includes("fetch") || text.toLowerCase().includes("network")) return tr("Die Verbindung wurde unterbrochen. Dein Coin-Guthaben wurde nicht verändert. Bitte versuche es erneut.");
  return tr("Die Aktion konnte nicht abgeschlossen werden.");
}

type BuyResult = { skin_id: string; charged: number; balance: number; already_owned: boolean };
const FINAL_BUY_ERRORS = /AUTH_REQUIRED|INSUFFICIENT_COINS|SKIN_|ACCOUNT_BANNED|RATE_LIMIT|PGRST20|42P01|42883|42501/;
async function buyWithRetry(id: VehicleSkinId): Promise<BuyResult> {
  // Die RPC ist idempotent (Besitz unique, Wallet gesperrt): ein Retry nach Netzabbruch bucht nie doppelt ab.
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await sb.rpc("buy_vehicle_skin", { _skin: id });
    if (!error) { const row = (data as BuyResult[] | null)?.[0]; if (row) return row; throw new Error("SKIN_NOT_FOUND"); }
    if (attempt >= 3 || FINAL_BUY_ERRORS.test(`${error.code ?? ""} ${error.message ?? ""}`)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
  }
}

export function useBuyVehicleSkin(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: buyWithRetry,
    onSuccess: (result) => { if (typeof result?.balance === "number") qc.setQueryData(["coin-balance"], Number(result.balance)); },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["coin-balance"] });
      void qc.invalidateQueries({ queryKey: garageKey(uid) });
    },
  });
}

export function useEquipVehicleSkin(uid: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: VehicleSkinId) => {
      const { error } = await sb.rpc("equip_vehicle_skin", { _skin: id });
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: garageKey(uid) });
      const previous = qc.getQueryData<Garage>(garageKey(uid));
      if (previous) qc.setQueryData<Garage>(garageKey(uid), { ...previous, equipped: id, entries: previous.entries.map((e) => ({ ...e, equipped: e.id === id })) });
      return { previous };
    },
    onSuccess: (id) => storeSkin(uid, id),
    onError: (_error, _id, ctx) => { if (ctx?.previous) qc.setQueryData(garageKey(uid), ctx.previous); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: garageKey(uid) }); },
  });
}
