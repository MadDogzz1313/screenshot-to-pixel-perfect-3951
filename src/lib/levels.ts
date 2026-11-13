export const MAX_LEVEL = 100;

/**
 * XP-Bedarf für den Aufstieg von Level L auf L+1 (identisch zu public.leonida_level_curve, SQL 033):
 * roundToNearest50(1000 · (1 + ln L) / (1 + ln 5)) → L5→6 = 1.000 XP, danach logarithmisch langsamer steigend.
 */
export function xpStep(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return Math.round((1000 * (1 + Math.log(l))) / (1 + Math.log(5)) / 50) * 50;
}
const TOTALS: number[] = [0, 0];
for (let l = 1; l < MAX_LEVEL; l++) TOTALS.push(TOTALS[l]! + xpStep(l));
/** Kumulative XP-Schwelle, um ein Level zu erreichen (Level I = 0 XP). */
export function xpForLevel(level: number): number {
  return TOTALS[Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))]!;
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
