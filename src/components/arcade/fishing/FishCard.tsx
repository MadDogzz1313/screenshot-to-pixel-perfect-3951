import { Crown } from "lucide-react";
import { locale, tr } from "@/lib/i18n";
import { formatPercent, RARITY_STYLE, type FishSpecies } from "@/lib/fishing";

/** Fischkarte im Stil der Referenz: Seltenheitsrahmen, Chance, Bild, Name, Coin-Pille, optional Fänge. */
export function FishCard({ fish, chance, count, silhouette = false, testId, className = "" }: {
  fish: FishSpecies; chance?: number; count?: number; silhouette?: boolean; testId?: string; className?: string;
}) {
  const style = RARITY_STYLE[fish.rarity];
  const legendary = fish.rarity === "legendary";
  const mythic = fish.rarity === "mythic";
  return (
    <article data-testid={testId} className={`relative flex flex-col items-center rounded-3xl border-2 bg-[#120724]/90 px-3 pb-3 pt-3 text-center ${legendary ? "mt-4" : ""} ${className}`}
      style={mythic
        ? { borderColor: "transparent", background: "linear-gradient(#120724,#120724) padding-box, linear-gradient(135deg,#FFC83D,#FF2E97 50%,#8B2CFF) border-box", boxShadow: "0 0 22px rgba(255,46,151,0.55), 0 0 34px rgba(139,44,255,0.45)" }
        : { borderColor: style.color, boxShadow: `0 0 18px ${style.glow}, inset 0 0 18px ${style.glow.replace(/[\d.]+\)$/, "0.18)")}` }}>
      {mythic && <span aria-hidden className="fishing-crown pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-lg text-[#FFD76A] drop-shadow-[0_0_8px_rgba(255,46,151,0.9)]">✦</span>}
      {legendary && <Crown aria-hidden className="fishing-crown absolute -top-5 left-1/2 h-7 w-7 -translate-x-1/2 fill-[#FFC83D] text-[#FFE38A] drop-shadow-[0_0_8px_rgba(255,200,61,0.9)]" />}
      <p className={`font-display text-base italic leading-tight ${mythic ? "bg-gradient-to-r from-[#FFC83D] via-[#FF5FD2] to-[#A855FF] bg-clip-text text-transparent" : ""}`} style={mythic ? { filter: "drop-shadow(0 0 8px rgba(255,46,151,0.7))" } : { color: style.color, textShadow: `0 0 10px ${style.glow}` }}>{style.label}</p>
      <span aria-hidden className="mt-1.5 h-px w-4/5" style={{ background: `linear-gradient(90deg, transparent, ${style.color}, transparent)` }} />
      {chance !== undefined && <p className="mt-1.5 text-[11px] text-[#D8CCEB]">{tr("Wahrscheinlichkeit:")}<span data-testid={testId ? `${testId}-chance` : undefined} className="block text-base font-bold" style={{ color: legendary ? style.color : "#fff" }}>{formatPercent(chance, locale())}</span></p>}
      <div className="relative my-1 grid h-20 w-full place-items-center">
        <img src={fish.image} alt={silhouette ? tr("Noch nicht gefangen") : fish.name} draggable={false} loading="lazy"
          className={`h-full w-full select-none object-contain ${silhouette ? `brightness-0 opacity-70 ${mythic ? "drop-shadow-[0_0_10px_rgba(176,38,255,0.9)]" : "drop-shadow-[0_0_6px_rgba(191,170,217,0.35)]"}` : "drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]"}`} />
      </div>
      <h3 data-testid={testId ? `${testId}-name` : undefined} className="text-sm font-bold italic">{mythic && silhouette ? "???" : fish.name}</h3>
      <span data-testid={testId ? `${testId}-coins` : undefined} className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold text-[#FFD12A]" style={{ borderColor: `${style.color}99` }}>
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-[#FFE38A] to-[#F5A623] text-[8px] text-[#7A4A00]">★</span>{tr("{0} Coins", fish.coins.toLocaleString(locale()))}
      </span>
      {count !== undefined && <p data-testid={testId ? `${testId}-count` : undefined} className="mt-1.5 text-[11px] text-[#BFAAD9]">{count > 0 ? tr("Gefangen: {0}×", count) : tr("Noch nicht gefangen")}</p>}
    </article>
  );
}
