import { useEffect, useState, type CSSProperties } from "react";
import { BadgeImg } from "@/components/BadgeImg";
import { fishById } from "@/lib/fishing";
import { locale, tr } from "@/lib/i18n";

type Variant = "legendary" | "mythic";
const LOOK: Record<Variant, { fish: "leonida_marlin" | "mythic_marlin"; testId: string; title: string; titleClass: string; bg: string; rays: string; fishClass: string; spark: [string, string] }> = {
  legendary: { fish: "leonida_marlin", testId: "fishing-legendary", title: "LEGENDÄRER FANG!", titleClass: "from-[#FFE9A3] via-[#FFC83D] to-[#FF5FD2]",
    bg: "bg-[radial-gradient(ellipse_at_center,#2B0B47_0%,#14062A_55%,#07020F_100%)]", rays: "fishing-legend-rays", fishClass: "fishing-legend-fish", spark: ["#FFD76A", "#FF5FD2"] },
  mythic: { fish: "mythic_marlin", testId: "fishing-mythic", title: "MYTHISCHER FANG!", titleClass: "from-[#FFD76A] via-[#FF5FD2] to-[#A855FF]",
    bg: "bg-[radial-gradient(ellipse_at_center,#3A0E5C_0%,#170631_55%,#07020F_100%)]", rays: "fishing-mythic-rays", fishClass: "fishing-mythic-fish", spark: ["#FF5FD2", "#22E4F2"] },
};

/** Belohnungsbildschirm nach der Fangsequenz (legendär/mythisch). Coins (und ggf. Badge) sind zu diesem Zeitpunkt bereits serverseitig gutgeschrieben. */
export function CatchReward({ variant, coins, xp, firstBadge = false, onContinue }: { variant: Variant; coins: number; xp: number; firstBadge?: boolean; onContinue: () => void }) {
  const look = LOOK[variant];
  const fish = fishById(look.fish)!;
  const shown = useCountUp(coins, variant === "mythic" ? 1600 : 1200, 450);
  return <div data-testid={`${look.testId}-catch`} role="dialog" aria-modal="true" aria-label={tr(look.title)}
    className={`fixed inset-0 z-[90] grid place-items-center overflow-y-auto overflow-x-hidden ${look.bg} p-4 animate-in fade-in duration-500`}>
    <div aria-hidden className={`${look.rays} pointer-events-none absolute left-1/2 top-[42%] h-[150vmax] w-[150vmax]`} />
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 22 }, (_, i) => { const c = i % 3 === 0 ? look.spark[1] : look.spark[0]; return <span key={i} className="fishing-gold-spark absolute left-1/2 top-[40%] h-2 w-2 rounded-full"
        style={{ background: c, boxShadow: `0 0 10px ${c}`, "--dx": `${Math.cos(i * 0.29) * (110 + (i % 4) * 34)}px`, "--dy": `${Math.sin(i * 0.29) * (120 + (i % 5) * 26)}px`, animationDelay: `${(i % 8) * 170}ms` } as CSSProperties} />; })}
      {Array.from({ length: 16 }, (_, i) => <span key={`t${i}`} className="fishing-legend-twinkle absolute h-1 w-1 rounded-full bg-white"
        style={{ left: `${(i * 61) % 100}%`, top: `${(i * 37 + 11) % 100}%`, animationDelay: `${(i % 6) * 320}ms` }} />)}
    </div>
    <div className="relative w-full max-w-[22rem] py-[env(safe-area-inset-top)] text-center">
      <p data-testid={`${look.testId}-title`} className={`fishing-legend-pulse font-display text-[2.1rem] leading-tight tracking-wide text-transparent bg-gradient-to-r ${look.titleClass} bg-clip-text`}>
        <span aria-hidden className="mr-1 inline-block text-[#FFC83D]">🏆</span>{tr(look.title)}
      </p>
      <img data-testid={`${look.testId}-fish`} src={fish.image} alt={fish.name} className={`${look.fishClass} mx-auto mt-4 w-full select-none`} draggable={false} />
      <p className="mt-1 font-bold italic text-white/95">{fish.name}</p>
      <p data-testid={`${look.testId}-coins`} aria-label={tr("+{0} LEONIDA COINS", coins.toLocaleString(locale()))} className="fishing-catch-pop mt-3 font-display text-5xl text-[#FFD12A] [text-shadow:0_0_22px_rgba(255,209,42,0.95)]">
        +{shown.toLocaleString(locale())}
      </p>
      <p className="font-display text-lg tracking-[0.2em] text-[#FFE38A] [text-shadow:0_0_12px_rgba(255,200,61,0.7)]">{tr("LEONIDA COINS")}</p>
      {xp > 0 && <p className="mt-1 text-xs text-[#E9DDF7]">{tr("+{0} Arcade-XP", xp)}</p>}
      {firstBadge && <div data-testid={`${look.testId}-badge`} className="fishing-catch-pop mx-auto mt-4 flex w-fit items-center gap-3 rounded-2xl border border-[#FF5FD2]/70 bg-[#1A0C33]/90 p-2 pr-4 shadow-[0_0_20px_rgba(255,46,151,0.5)]">
        <BadgeImg id="mythic_catch" alt={tr("Mythischer Fang")} className="h-16 w-16" />
        <span className="text-left"><span className="block text-xs font-bold uppercase tracking-wider text-[#FFD76A]">{tr("Neues Badge freigeschaltet!")}</span><span className="block font-display text-base">{tr("Mythischer Fang")}</span></span>
      </div>}
      <button type="button" data-testid={`${look.testId}-continue`} onClick={onContinue}
        className="mt-6 min-h-14 w-full rounded-full bg-gradient-to-r from-[#FFC83D] via-[#FF8A3D] to-[#FF2E97] text-lg font-black text-[#2B0B47] shadow-[0_0_26px_rgba(255,46,151,0.55)] transition-[transform,box-shadow] duration-150 active:scale-95">{tr("Weiter")}</button>
    </div>
  </div>;
}

function useCountUp(target: number, ms: number, delay: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now() + delay;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}
