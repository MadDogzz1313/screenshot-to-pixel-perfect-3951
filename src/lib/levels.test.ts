import { describe, it, expect } from "vitest";
import { xpForLevel, xpStep, levelFromXp, levelProgress, toRoman } from "./levels";

describe("levels (logarithmische Kurve, SQL 033)", () => {
  it("XP-Bedarf je Aufstieg für L1/5/10/20/50/99", () => {
    expect([1, 5, 10, 20, 50, 99].map(xpStep)).toEqual([400, 1000, 1250, 1550, 1900, 2150]);
  });
  it("Gesamt-XP für Level II/V/VI/X/XX/L/C", () => {
    expect([2, 5, 6, 10, 20, 50, 100].map(xpForLevel)).toEqual([400, 2750, 3750, 8400, 22350, 74100, 175550]);
  });
  it("Bedarf steigt, Zuwachs wird kleiner", () => {
    for (let l = 2; l < 100; l++) expect(xpStep(l)).toBeGreaterThanOrEqual(xpStep(l - 1));
    expect(xpStep(2) - xpStep(1)).toBeGreaterThan(xpStep(51) - xpStep(50));
  });
  it("Level aus XP inkl. mehrerer Aufstiege und Übertrag", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(399)).toBe(1);
    expect(levelFromXp(400)).toBe(2);
    expect(levelFromXp(8450)).toBe(10);
    expect(levelProgress(8450)).toMatchObject({ level: 10, base: 8400, next: 9650, pct: 4 });
  });
  it("Maximal Level C", () => expect(levelFromXp(10_000_000)).toBe(100));
  it("römische Zahlen", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(49)).toBe("XLIX");
    expect(toRoman(100)).toBe("C");
  });
});
