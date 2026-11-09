export const MAX_LEVEL = 100;

/** Kumulative XP-Schwelle für ein Level: 25*(L-1)^2 + 75*(L-1) */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level))) - 1;
  return 25 * l * l + 75 * l;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = level >= MAX_LEVEL ? base : xpForLevel(level + 1);
  const pct = level >= MAX_LEVEL ? 100 : Math.round(((xp - base) / (next - base)) * 100);
  return { level, base, next, pct };
}

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let v = Math.max(1, Math.min(MAX_LEVEL, n));
  for (const [val, sym] of map) while (v >= val) { out += sym; v -= val; }
  return out;
}
