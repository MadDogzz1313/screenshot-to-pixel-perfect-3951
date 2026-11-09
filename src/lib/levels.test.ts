import { describe, it, expect } from "vitest";
import { xpForLevel, levelFromXp, toRoman } from "./levels";

describe("levels", () => {
  it("Level I braucht 0 XP", () => expect(xpForLevel(1)).toBe(0));
  it("Level II braucht 100 XP", () => expect(xpForLevel(2)).toBe(100));
  it("Level III braucht 250 XP", () => expect(xpForLevel(3)).toBe(250));
  it("Level C braucht 252450 XP", () => expect(xpForLevel(100)).toBe(252450));
  it("99 XP ist Level I, 100 XP Level II", () => {
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
  });
  it("Maximal Level C", () => expect(levelFromXp(10_000_000)).toBe(100));
  it("römische Zahlen", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(49)).toBe("XLIX");
    expect(toRoman(100)).toBe("C");
  });
});
