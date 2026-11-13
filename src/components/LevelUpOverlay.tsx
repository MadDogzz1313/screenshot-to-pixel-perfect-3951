import { useEffect, useMemo, useState } from "react";
import { Coins, Sparkles } from "lucide-react";
import { LevelBadge } from "@/components/LevelBadge";
import { toRoman, xpForLevel } from "@/lib/levels";
import type { PendingLevelReward } from "@/lib/level-rewards";
import { tr } from "@/lib/i18n";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: `${6 + ((i * 47) % 88)}%`,
  delay: `${(i % 6) * 90}ms`,
  duration: `${1800 + (i % 5) * 170}ms`,
  rotate: `${-28 + ((i * 31) % 56)}deg`,
}));

export function LevelUpOverlay({ rewards, onDone }: { rewards: PendingLevelReward[]; onDone: () => void }) {
  const [reduced, setReduced] = useState(false);
  const [done, setDone] = useState(false);
  const totalCoins = useMemo(() => rewards.reduce((sum, r) => sum + r.coins, 0), [rewards]);
  const fromLevel = Math.max(1, Math.min(...rewards.map((r) => r.level)) - 1);
  const toLevel = Math.max(...rewards.map((r) => r.level));
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), reduced ? 700 : 3800);
    return () => window.clearTimeout(timer);
  }, [reduced]);
  useEffect(() => { if (done) onDone(); }, [done, onDone]);
  return (
    <div data-testid="level-up-overlay" role="dialog" aria-modal="true" aria-label={tr("Levelaufstieg")}
      className={`fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[#12051f]/90 px-5 py-[max(env(safe-area-inset-top),1.5rem)] backdrop-blur-md ${reduced ? "level-up-reduced" : "level-up-enter"}`}>
      {!reduced && <div aria-hidden className="pointer-events-none absolute inset-0">{PARTICLES.map((p, i) => <span key={i} className="level-up-particle" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, transform: `rotate(${p.rotate})` }} />)}</div>}
      <div data-testid="level-up-card" className="relative w-full max-w-sm text-center">
        <div aria-hidden className="level-up-ring absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2" />
        <Sparkles aria-hidden className="mx-auto mb-4 h-8 w-8 animate-pulse text-[#FFD45A] drop-shadow-[0_0_16px_#FFD45A]" />
        <p data-testid="level-up-title" className="font-display text-3xl font-black italic tracking-wide text-neon-gradient">{tr("LEVEL AUFSTIEG!")}</p>
        <p data-testid="level-up-transition" className="mt-5 flex items-center justify-center gap-4 text-lg font-bold">
          <span className="level-up-old-rank text-white/60">{toRoman(fromLevel)}</span><span aria-hidden className="text-[#FFD45A]">→</span><span className="level-up-new-rank text-white">{toRoman(toLevel)}</span>
        </p>
        <div data-testid="level-up-badge" className="relative mx-auto my-6 grid h-28 w-28 place-items-center rounded-full border-2 border-neon bg-[#24103d]/90 shadow-[0_0_22px_#ff2e97,0_0_58px_rgba(149,65,255,.65)]">
          <div className="level-up-badge-glow absolute inset-2 rounded-full" />
          <LevelBadge xp={xpForLevel(toLevel)} size="lg" />
        </div>
        <div data-testid="level-up-progress" className="mx-auto h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10 shadow-[inset_0_0_8px_rgba(0,0,0,.35)]"><div className="level-up-progress-fill h-full rounded-full bg-sunset shadow-[0_0_14px_#ff2e97]" /></div>
        <div data-testid="level-up-reward" className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#FFD45A]/70 bg-[#FFD45A]/10 px-5 py-3 text-lg font-black text-[#FFE58B] shadow-[0_0_22px_rgba(255,212,90,.3)]">
          <Coins className="level-up-coin h-6 w-6" aria-hidden /><span>+{totalCoins.toLocaleString()} {tr("Leonida Coins")}</span>
        </div>
        <p data-testid="level-up-level-note" className="mt-3 text-xs text-white/65">{rewards.length > 1 ? tr("{0} neue Level erreicht · 500 Coins je Level", rewards.length) : tr("500 Coins für den neuen Rang")}</p>
        <button type="button" data-testid="level-up-continue-button" onClick={() => setDone(true)} className="mt-7 min-h-12 rounded-full border border-neon/70 px-7 text-sm font-bold text-white transition-[transform,background-color] duration-150 active:scale-95 hover:bg-primary/30">{tr("Weiter")}</button>
      </div>
    </div>
  );
}
