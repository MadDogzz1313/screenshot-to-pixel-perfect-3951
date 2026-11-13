import { describe, expect, it } from "vitest";
import { BAITS, BAIT_USES, FISH, fishingOdds, type Rarity } from "./fishing";

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const r4 = (v: number) => Math.round(v * 10000) / 10000;

describe("Leonida Fishing – Fangchancen", () => {
  it("Grundchancen und Belohnungen (6 Fischarten, Summe 100 %)", () => {
    expect(FISH.map((f) => [f.name, f.baseChance, f.coins])).toEqual([
      ["Küstenbarsch", 50, 25], ["Sonnenbarsch", 25, 50], ["Neon-Makrele", 12, 100], ["Palmenschnapper", 7.5, 175],
      ["Leonida-Marlín", 5, 250], ["Mythischer Leonida-Marlín", 0.5, 5000],
    ]);
    expect(sum(fishingOdds(null))).toBe(100);
  });

  it("Köderpreise 12/25/50/87/125/150, je 3 Nutzungen; nur Mythisch pro Wurf", () => {
    expect(BAITS.map((b) => b.price)).toEqual([12, 25, 50, 87, 125, 150]);
    expect(BAITS.every((b) => b.uses === 3 && BAIT_USES === 3)).toBe(true);
    expect(BAITS.filter((b) => b.consumeOnCast).map((b) => b.rarity)).toEqual(["mythic"]);
  });

  it.each(["common", "uncommon", "rare", "epic", "legendary"] as Rarity[])("Köder %s: Ziel ×4 (max. 100 %%), Summe 100 %%", (rarity) => {
    const odds = fishingOdds(rarity);
    const target = FISH.find((f) => f.rarity === rarity)!;
    expect(odds[target.id]).toBeCloseTo(Math.min(100, target.baseChance * 4), 10);
    expect(sum(odds)).toBeCloseTo(100, 10);
  });

  it("Mythischer Köder: 0,5 % → 1 %, Rest proportional", () => {
    const o = fishingOdds("mythic");
    expect([o.kuestenbarsch, o.sonnenbarsch, o.neon_makrele, o.palmenschnapper, o.leonida_marlin, o.mythic_marlin].map(r4))
      .toEqual([49.7487, 24.8744, 11.9397, 7.4623, 4.9749, 1]);
    expect(sum(o)).toBeCloseTo(100, 10);
  });

  it("Legendärer Köder auf neuer Basis: 5 % → 20 %", () => {
    expect(fishingOdds("legendary").leonida_marlin).toBe(20);
  });
});
