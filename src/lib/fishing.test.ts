import { describe, expect, it } from "vitest";
import { BAITS, BAIT_USES, FISH, fishingOdds, type Rarity } from "./fishing";

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe("Leonida Fishing – Fangchancen", () => {
  it("Grundchancen und Belohnungen", () => {
    expect(FISH.map((f) => [f.name, f.baseChance, f.coins])).toEqual([
      ["Küstenbarsch", 50, 25], ["Sonnenbarsch", 25, 50], ["Neon-Makrele", 12.5, 100], ["Palmenschnapper", 5, 175], ["Leonida-Marlín", 7.5, 250],
    ]);
    expect(sum(fishingOdds(null))).toBe(100);
  });

  it("Köderpreise = halbe Belohnung (abgerundet), 3 Nutzungen", () => {
    expect(BAITS.map((b) => b.price)).toEqual([12, 25, 50, 87, 125]);
    expect(BAITS.every((b) => b.uses === 3 && BAIT_USES === 3)).toBe(true);
  });

  it.each(["common", "uncommon", "rare", "epic", "legendary"] as Rarity[])("Köder %s: Ziel ×4 (max. 100 %%), Summe 100 %%", (rarity) => {
    const odds = fishingOdds(rarity);
    const target = FISH.find((f) => f.rarity === rarity)!;
    expect(odds[target.id]).toBeCloseTo(Math.min(100, target.baseChance * 4), 10);
    expect(sum(odds)).toBeCloseTo(100, 10);
    // übrige Chancen proportional: Verhältnis untereinander bleibt gleich
    const others = FISH.filter((f) => f.id !== target.id);
    if (odds[target.id] < 100) expect(odds[others[0]!.id] / odds[others[1]!.id]).toBeCloseTo(others[0]!.baseChance / others[1]!.baseChance, 10);
  });

  it("Beispiel legendärer Köder", () => {
    const o = fishingOdds("legendary");
    expect([o.kuestenbarsch, o.sonnenbarsch, o.neon_makrele, o.palmenschnapper, o.leonida_marlin].map((v) => Math.round(v * 100) / 100))
      .toEqual([37.84, 18.92, 9.46, 3.78, 30]);
  });

  it("Gewöhnlicher Köder wird auf 100 % begrenzt", () => {
    const o = fishingOdds("common");
    expect(o.kuestenbarsch).toBe(100);
    expect(o.leonida_marlin).toBe(0);
  });
});
