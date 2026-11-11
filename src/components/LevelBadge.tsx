import { levelFromXp, toRoman } from "@/lib/levels";
import { cn } from "@/lib/utils";

import { tr } from "@/lib/i18n";
export function LevelBadge({ xp, size = "sm" }: { xp: number; size?: "sm" | "lg" }) {
  const level = levelFromXp(xp);
  return (
    <span className={cn("badge-roman inline-flex items-center justify-center rounded-lg font-display text-primary-foreground",
      size === "sm" ? "h-6 min-w-6 px-1.5 text-xs" : "h-12 min-w-12 px-3 text-xl")} title={tr("Level {0}", level)}>
      {toRoman(level)}
    </span>
  );
}
