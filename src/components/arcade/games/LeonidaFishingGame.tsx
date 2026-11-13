import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Check, Fish, Loader2, ShoppingCart, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { LeaderboardModal } from "@/components/arcade/LeaderboardModal";
import { FishCard } from "@/components/arcade/fishing/FishCard";
import { BadgeImg } from "@/components/BadgeImg";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import sceneUrl from "@/assets/fishing/scene.webp";
import {
  BAITS, baitById, baitStock, DAILY_CASTS, FISH, fishById, fishingError, fishingKey, fishingOdds, formatPercent, newNonce,
  RARITY_STYLE, reelFishingCast, startFishingCast, useFishingState, useSelectBait,
  type BaitId, type CastInfo, type FishingState, type ReelResult,
} from "@/lib/fishing";
import { locale, tr } from "@/lib/i18n";
import { useStore } from "@/lib/store";

const GAME = "leonida_fishing" as const;
type Phase = "idle" | "casting" | "waiting" | "bite" | "reeling" | "result";
type Fx = { x: number; y: number; t: number; kind: "ripple" | "bubble" };
type Sim = { phase: Phase; castStart: number; biteAt: number; windowEnd: number; castId: string | null; fx: Fx[]; lastFx: number; splashAt: number };

const BOBBER = { x: 0.47, y: 0.57 }; // Zielpunkt auf dem Wasser (relativ)
const CAST_MS = 900;

export function LeonidaFishingGame() {
  const { user } = useStore();
  const qc = useQueryClient();
  const state = useFishingState(user?.id);
  const selectBait = useSelectBait(user?.id);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [result, setResult] = useState<ReelResult | null>(null);
  const [firstMythic, setFirstMythic] = useState(false);
  const [sheet, setSheet] = useState<"bait" | "collection" | null>(null);
  const [leaderboard, setLeaderboard] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const reduced = useRef(false);
  const sim = useRef<Sim>({ phase: "idle", castStart: 0, biteAt: 0, windowEnd: 0, castId: null, fx: [], lastFx: 0, splashAt: 0 });
  const setPhase = (p: Phase) => { sim.current.phase = p; setPhaseState(p); };
  const reelRef = useRef<(take: boolean) => Promise<void>>(async () => undefined);

  const data = state.data;
  const used = data?.used ?? 0;
  const limit = data?.limit ?? DAILY_CASTS;
  const bonus = data?.bonus_casts ?? 0;
  // Erst die 15 Tagesversuche, danach vom Admin vergebene Bonusversuche (verfallen nicht um Mitternacht)
  const limitReached = !!data?.logged_in && used >= limit && bonus <= 0;
  const selected = baitById(data?.selected_bait_id);
  const selectedStock = selected ? baitStock(data, selected.id) : null;
  const busy = phase === "casting" || phase === "waiting" || phase === "bite" || phase === "reeling";
  const setupMissing = !!data?.setupMissing;

  const refresh = (r?: ReelResult) => {
    if (r && typeof r.balance === "number") qc.setQueryData(["coin-balance"], Number(r.balance));
    void qc.invalidateQueries({ queryKey: fishingKey(user?.id) });
    void qc.invalidateQueries({ queryKey: ["coin-balance"] });
    void qc.invalidateQueries({ queryKey: ["arcade-stats", GAME] });
    void qc.invalidateQueries({ queryKey: ["arcade-leaderboard", GAME] });
    if (r?.species_id === "mythic_marlin") void qc.invalidateQueries({ queryKey: ["badges", user?.id] });
  };

  // Biss-Zeitpunkt aus Server-Angaben (Restzeit) – Geräteuhr spielt keine Rolle.
  const schedule = (c: CastInfo) => {
    const s = sim.current; const now = performance.now();
    s.castId = c.cast_id;
    s.biteAt = Math.max(now + (c.bite_delay_ms - c.elapsed_ms), s.castStart + CAST_MS);
    s.windowEnd = s.biteAt + c.window_ms;
    setPhase(now >= s.biteAt ? "bite" : "waiting");
  };

  const reel = async (take: boolean) => {
    const s = sim.current; const id = s.castId; if (!id || s.phase === "reeling") return;
    setPhase("reeling");
    try {
      const r = await reelFishingCast(id, take);
      // Erstes Mythisch-Badge: Sammlung vor dem Fang hatte noch keinen mythischen Marlín (Badge vergibt der Server).
      setFirstMythic(r.status === "caught" && r.species_id === "mythic_marlin" && !r.already_processed && (data?.collection.mythic_marlin ?? 0) === 0);
      s.castId = null; setResult(r); setPhase("result"); refresh(r);
      if (r.status === "caught" && navigator.vibrate) navigator.vibrate(r.species_id === "leonida_marlin" ? [40, 60, 80] : 35);
    } catch (error) {
      toast.error(fishingError(error as { code?: string; message?: string }));
      s.castId = null; setPhase("idle"); refresh();
    }
  };

  reelRef.current = reel;

  const cast = async () => {
    if (!user) { toast.error(tr("Bitte melde dich an, um zu angeln und Köder zu kaufen.")); return; }
    if (setupMissing) { toast.error(fishingError({ code: "PGRST202" })); return; }
    if (limitReached || busy) return;
    const s = sim.current; s.castStart = performance.now(); s.splashAt = s.castStart + CAST_MS * 0.85;
    setResult(null); setPhase("casting");
    try {
      const c = await startFishingCast(newNonce());
      if (c.status !== "pending") { setResult({ ...c, already_processed: true, balance: null }); setPhase("result"); refresh(); return; }
      qc.setQueryData<FishingState>(fishingKey(user.id), (old) => (old ? { ...old, used: c.used, bonus_casts: typeof c.bonus_casts === "number" ? Number(c.bonus_casts) : old.bonus_casts } : old));
      schedule(c);
    } catch (error) {
      toast.error(fishingError(error as { code?: string; message?: string }));
      setPhase("idle"); refresh();
    }
  };

  // Laufenden Wurf nach Neustart / Netzabbruch wiederherstellen
  const pendingId = data?.pending?.cast_id;
  useEffect(() => {
    const p = data?.pending;
    if (!p || sim.current.castId || sim.current.phase !== "idle") return;
    sim.current.castStart = performance.now() - CAST_MS; sim.current.splashAt = 0;
    schedule(p);
  }, [pendingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render-Loop (Canvas: Wasser-Glitzern, Angel, Schnur, Schwimmer, Wellen, Blasen)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => { reduced.current = mq.matches; };
    mq.addEventListener?.("change", onMq);
    const resize = () => { const c = canvas.current; if (!c) return; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = Math.floor(c.clientWidth * dpr); c.height = Math.floor(c.clientHeight * dpr); c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const loop = (now: number) => {
      raf.current = requestAnimationFrame(loop);
      const c = canvas.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
      const s = sim.current;
      if (s.phase === "waiting" && now >= s.biteAt) setPhase("bite");
      if (s.phase === "bite" && now > s.windowEnd) void reelRef.current(false);
      draw(ctx, c.clientWidth, c.clientHeight, now, s, reduced.current);
    };
    const visibility = () => {
      if (document.hidden) { if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; }
      else if (raf.current === null) raf.current = requestAnimationFrame(loop);
    };
    resize(); raf.current = requestAnimationFrame(loop);
    window.addEventListener("resize", resize); document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", visibility); mq.removeEventListener?.("change", onMq); if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mainButton = (() => {
    if (phase === "bite") return { label: tr("Jetzt einholen!"), testId: "fishing-reel-button", onClick: () => void reel(true), disabled: false, accent: true };
    if (phase === "casting" || phase === "waiting") return { label: phase === "casting" ? tr("Auswerfen …") : tr("Warte …"), testId: "fishing-reel-button", onClick: () => undefined, disabled: true, accent: false };
    if (phase === "reeling") return { label: tr("Einholen …"), testId: "fishing-reel-button", onClick: () => undefined, disabled: true, accent: false };
    return { label: phase === "result" ? tr("Nochmal angeln") : tr("Angeln starten"), testId: "fishing-cast-button", onClick: () => void cast(), disabled: limitReached || state.isLoading, accent: false };
  })();
  const discovered = FISH.filter((f) => (data?.collection[f.id] ?? 0) > 0).length;

  return <div data-testid="leonida-fishing-game" className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden overscroll-none bg-[#0B0418] text-white">
    <header className="relative z-10 flex items-center justify-between gap-2 border-b border-[#FF2E97]/30 bg-[#120A24]/85 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-md">
      <Link to="/arcade" data-testid="fishing-back-button" aria-label={tr("Zurück zur Neon Arcade")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#22E4F2]/60 text-[#22E4F2] transition-transform duration-150 active:scale-90"><ArrowLeft className="h-5 w-5" /></Link>
      <h1 className="flex min-w-0 items-center gap-1.5 truncate font-display text-lg text-[#FF5FB4] [text-shadow:0_0_12px_rgba(255,46,151,0.8)]"><Fish className="h-5 w-5 shrink-0" />Leonida Fishing</h1>
      <div data-testid="fishing-coin-balance" className="shrink-0"><CoinBalance compact /></div>
    </header>

    <div className="relative min-h-0 flex-1 overflow-hidden">
      <img src={sceneUrl} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <canvas ref={canvas} data-testid="fishing-canvas" className="absolute inset-0 h-full w-full" />

      <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span data-testid="fishing-attempts" className="w-fit rounded-full border border-[#22E4F2]/60 bg-[#0B0418]/75 px-3 py-1.5 text-xs font-bold text-[#22E4F2] backdrop-blur-sm">{tr("Tägliche Versuche: {0}/{1}", Math.max(0, limit - used), limit)}</span>
          {bonus > 0 && <span data-testid="fishing-bonus-attempts" className="w-fit rounded-full border border-[#22E4F2] bg-[#22E4F2]/15 px-3 py-1.5 text-xs font-bold text-[#22E4F2] shadow-[0_0_12px_rgba(34,228,242,0.35)] backdrop-blur-sm">{tr("Bonus-Angelversuche: {0}", bonus.toLocaleString(locale()))}</span>}
          <span data-testid="fishing-active-bait" className="w-fit max-w-full truncate rounded-full border bg-[#0B0418]/75 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm" style={{ borderColor: selected ? RARITY_STYLE[selected.rarity].color : "rgba(255,255,255,0.25)", color: selected ? RARITY_STYLE[selected.rarity].color : "#BFAAD9" }}>
            {selected && selectedStock ? tr("{0} · {1}/3 Nutzungen übrig", selected.name, selectedStock.current) : tr("Ohne Köder")}
          </span>
        </div>
        <button type="button" data-testid="fishing-leaderboard-button" aria-label={tr("Top 5 Marlín-Fänge")} onClick={() => setLeaderboard(true)} className="grid h-11 w-11 place-items-center rounded-full border border-[#FFC83D]/70 bg-[#0B0418]/75 text-[#FFC83D] backdrop-blur-sm transition-transform duration-150 active:scale-90"><Trophy className="h-5 w-5" /></button>
      </div>

      {(phase === "waiting" || phase === "bite" || phase === "casting") && <p data-testid="fishing-status" aria-live="assertive" className={`absolute inset-x-0 top-[30%] text-center font-display text-xl ${phase === "bite" ? "text-[#FFD12A] [text-shadow:0_0_16px_rgba(255,209,42,0.9)]" : "text-white/90 [text-shadow:0_0_10px_rgba(0,0,0,0.8)]"}`}>
        {phase === "bite" ? tr("Biss! Jetzt einholen!") : phase === "casting" ? tr("Die Angel fliegt …") : tr("Warte auf einen Biss …")}
      </p>}

      {setupMissing && !!user && <p data-testid="fishing-setup-hint" className="absolute inset-x-4 top-[30%] rounded-2xl border border-[#FFD12A]/40 bg-[#0B0418]/85 p-3 text-center text-xs text-[#FFE38A]">{tr("Leonida Fishing wird nach dem Datenbank-Update (SQL 027) aktiv.")}</p>}
      {!user && <p data-testid="fishing-login-hint" className="absolute inset-x-4 top-[30%] rounded-2xl border border-[#22E4F2]/40 bg-[#0B0418]/85 p-3 text-center text-sm text-[#BFAAD9]">{tr("Melde dich an, um zu angeln, Coins zu verdienen und deine Sammlung zu füllen.")}</p>}
      {limitReached && !busy && phase !== "result" && <p data-testid="fishing-limit-message" role="status" className="absolute inset-x-4 top-[30%] rounded-2xl border border-[#FF2E97]/50 bg-[#0B0418]/85 p-4 text-center text-sm font-semibold text-[#FFB3D9]">{tr("Deine 15 Angelversuche für heute sind aufgebraucht. Komm morgen wieder!")}</p>}

      {phase === "result" && result && result.status === "caught" && result.species_id === "mythic_marlin" && <MythicCatch result={result} firstBadge={firstMythic} canAgain={!limitReached} onAgain={() => void cast()} onClose={() => { setResult(null); setPhase("idle"); }} />}
      {phase === "result" && result && !(result.status === "caught" && result.species_id === "mythic_marlin") && <ResultCard result={result} canAgain={!limitReached} onAgain={() => void cast()} onClose={() => { setResult(null); setPhase("idle"); }} />}
    </div>

    <nav className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-end gap-3 border-t border-[#FF2E97]/25 bg-[#120A24]/90 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.9rem)] backdrop-blur-md" aria-label={tr("Angel-Steuerung")}>
      <SideButton testId="fishing-bait-button" label={tr("Köder")} badge={(data?.inventory ?? []).reduce((n, i) => n + i.uses_left, 0)} color="#22E4F2" onClick={() => setSheet("bait")}><span aria-hidden className="text-xl">🪝</span></SideButton>
      <button type="button" data-testid={mainButton.testId} disabled={mainButton.disabled} onClick={mainButton.onClick}
        className={`grid h-[5.5rem] w-[5.5rem] place-items-center rounded-full border-[3px] px-2 text-center text-sm font-bold leading-tight transition-[transform,opacity,background-color] duration-150 active:scale-95 disabled:opacity-60 ${mainButton.accent ? "fishing-bite-pulse border-[#FFD12A] bg-[#FFD12A] text-[#2B0B47]" : "border-[#FF2E97] bg-[#2B0B47] text-white shadow-[0_0_22px_rgba(255,46,151,0.55)]"}`}>
        {phase === "reeling" || phase === "casting" ? <Loader2 className="h-6 w-6 animate-spin" /> : null}{mainButton.label}
      </button>
      <SideButton testId="fishing-collection-button" label={tr("Sammlung")} badge={discovered} badgeSuffix={`/${FISH.length}`} color="#FF5FB4" onClick={() => setSheet("collection")}><BookOpen className="h-5 w-5" /></SideButton>
    </nav>

    <Sheet open={sheet === "bait"} onOpenChange={(o) => setSheet(o ? "bait" : null)}>
      <SheetContent side="bottom" data-testid="fishing-bait-sheet" className="z-[60] max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#22E4F2]/50 bg-[#1A0C33] pb-[max(env(safe-area-inset-bottom),1rem)] text-white">
        <SheetHeader><SheetTitle className="font-display text-xl text-neon-gradient">{tr("Köder wählen")}</SheetTitle><SheetDescription className="text-[#BFAAD9]">{tr("Ein Köder vervierfacht die Chance seiner Seltenheit. Nur ein Köder ist aktiv – wähle ihn vor dem Auswerfen.")}</SheetDescription></SheetHeader>
        <div className="mt-4 space-y-2">
          <BaitRow testId="fishing-bait-option-none" title={tr("Ohne Köder")} subtitle={tr("Normale Grundchancen")} active={!selected} disabled={busy || selectBait.isPending || !user} onSelect={() => selectBait.mutate(null, { onError: (e) => toast.error(fishingError(e as { message?: string })) })} />
          {BAITS.map((b) => {
            const stock = baitStock(data, b.id); const fish = FISH.find((f) => f.rarity === b.rarity)!; const style = RARITY_STYLE[b.rarity];
            return <BaitRow key={b.id} testId={`fishing-bait-option-${b.rarity}`} color={style.color} title={b.name}
              subtitle={tr("{0}: {1} → {2}", fish.name, formatPercent(fish.baseChance, locale()), formatPercent(fishingOdds(b.rarity)[fish.id], locale()))}
              note={b.consumeOnCast ? tr("Verbraucht pro Angelversuch eine Nutzung") : undefined}
              stock={stock.items ? (stock.items > 1 ? tr("{0}/3 Nutzungen übrig · +{1} weitere", stock.current, stock.items - 1) : tr("{0}/3 Nutzungen übrig", stock.current)) : tr("Nicht im Inventar")}
              active={selected?.id === b.id} disabled={busy || selectBait.isPending || !stock.items}
              onSelect={() => selectBait.mutate(b.id as BaitId, { onError: (e) => toast.error(fishingError(e as { message?: string })) })}
              shopLink={!stock.items} />;
          })}
        </div>
        {busy && <p className="mt-3 text-center text-xs text-[#FFE38A]">{tr("Während die Angel im Wasser ist, kannst du den Köder nicht wechseln.")}</p>}
      </SheetContent>
    </Sheet>

    <Sheet open={sheet === "collection"} onOpenChange={(o) => setSheet(o ? "collection" : null)}>
      <SheetContent side="bottom" data-testid="fishing-collection-sheet" className="z-[60] max-h-[88vh] overflow-y-auto rounded-t-3xl border-[#FF2E97]/50 bg-[#1A0C33] pb-[max(env(safe-area-inset-bottom),1rem)] text-white">
        <SheetHeader><SheetTitle className="font-display text-xl text-neon-gradient">{tr("Fischsammlung · {0}/{1} entdeckt", discovered, FISH.length)}</SheetTitle><SheetDescription className="text-[#BFAAD9]">{tr("Grundchancen ohne Köder. Noch nicht gefangene Fische erscheinen als Silhouette.")}</SheetDescription></SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-3 pb-2 sm:grid-cols-3">
          {FISH.map((f) => { const n = data?.collection[f.id] ?? 0; return <FishCard key={f.id} testId={`fishing-collection-${f.id}`} fish={f} chance={f.baseChance} count={n} silhouette={n === 0} />; })}
        </div>
      </SheetContent>
    </Sheet>

    <LeaderboardModal game={GAME} gameName="Leonida Fishing" open={leaderboard} onOpenChange={setLeaderboard} scoreLabel={tr("Deine Marlíne")} description={tr("Rang nach Anzahl gefangener Leonida-Marlíne.")} />
  </div>;
}

function SideButton({ testId, label, badge, badgeSuffix = "", color, onClick, children }: { testId: string; label: string; badge: number; badgeSuffix?: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" data-testid={testId} onClick={onClick} className="relative mx-auto flex min-h-16 w-full max-w-[7rem] flex-col items-center justify-center gap-1 rounded-2xl border bg-[#0B0418]/70 text-xs font-bold transition-[transform,background-color] duration-150 active:scale-95" style={{ borderColor: `${color}AA`, color, boxShadow: `0 0 14px ${color}40` }}>
    {children}{label}
    {badge > 0 && <span data-testid={`${testId}-badge`} className="absolute -right-1 -top-2 min-w-6 rounded-full px-1.5 py-0.5 text-[10px] font-black text-[#0B0418]" style={{ backgroundColor: color }}>{badge}{badgeSuffix}</span>}
  </button>;
}

function BaitRow({ testId, title, subtitle, note, stock, color = "#BFAAD9", active, disabled, onSelect, shopLink = false }: { testId: string; title: string; subtitle: string; note?: string | undefined; stock?: string; color?: string; active: boolean; disabled: boolean; onSelect: () => void; shopLink?: boolean }) {
  return <div data-testid={testId} className={`flex items-center gap-3 rounded-2xl border bg-[#120724] p-3 transition-[border-color,box-shadow] duration-150 ${active ? "shadow-[0_0_16px_rgba(34,228,242,0.35)]" : ""}`} style={{ borderColor: active ? "#22E4F2" : `${color}66` }}>
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-lg" style={{ borderColor: color, boxShadow: `0 0 10px ${color}55` }}>🪝</span>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold" style={{ color }}>{title}</p><p className="text-[11px] text-[#BFAAD9]">{subtitle}</p>{note && <p className="text-[11px] text-[#FFB3D9]">{note}</p>}{stock && <p data-testid={`${testId}-stock`} className="text-[11px] font-semibold text-white/85">{stock}</p>}</div>
    {active ? <span data-testid={`${testId}-active`} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#22E4F2] px-3 text-xs font-black text-[#0B0418]"><Check className="h-4 w-4" />{tr("Aktiv")}</span>
      : shopLink ? <Link to="/neoshop" search={{ tab: "baits" }} data-testid={`${testId}-shop-link`} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#FF2E97]/70 px-3 text-xs font-bold text-[#FFB3D9] active:scale-95"><ShoppingCart className="h-4 w-4" />{tr("Kaufen")}</Link>
      : <button type="button" data-testid={`${testId}-select`} disabled={disabled} onClick={onSelect} className="min-h-10 rounded-xl border border-[#22E4F2]/70 px-3 text-xs font-bold text-[#22E4F2] transition-transform duration-150 active:scale-95 disabled:opacity-50">{tr("Auswählen")}</button>}
  </div>;
}

function ResultCard({ result, canAgain, onAgain, onClose }: { result: ReelResult; canAgain: boolean; onAgain: () => void; onClose: () => void }) {
  const fish = result.status === "caught" ? fishById(result.species_id) : undefined;
  const legendary = fish?.rarity === "legendary";
  const outcome = result.outcome === "too_early" ? tr("Zu früh eingeholt.") : result.outcome === "expired" ? tr("Der Wurf ist abgelaufen.") : tr("Zu spät reagiert.");
  return <div data-testid="fishing-result" role="dialog" aria-modal="true" aria-label={fish ? fish.name : tr("Fisch entkommen")} className="absolute inset-0 grid place-items-center overflow-y-auto bg-[#0B0418]/60 p-4 backdrop-blur-[2px]">
    <div className="relative w-full max-w-[19rem]">
      {legendary && <div aria-hidden className="pointer-events-none absolute inset-0">{Array.from({ length: 14 }, (_, i) => <span key={i} className="fishing-gold-spark absolute left-1/2 top-1/3 h-2 w-2 rounded-full bg-[#FFD76A] shadow-[0_0_10px_#FFC83D]" style={{ "--dx": `${Math.cos(i * 0.45) * (90 + (i % 3) * 30)}px`, "--dy": `${Math.sin(i * 0.45) * (90 + (i % 4) * 22)}px`, animationDelay: `${(i % 7) * 140}ms` } as React.CSSProperties} />)}</div>}
      {fish ? <>
        <div className="fishing-catch-pop"><FishCard testId="fishing-result-card" fish={fish} /></div>
        <p data-testid="fishing-result-coins" className="fishing-coin-rise pointer-events-none absolute inset-x-0 -top-2 text-center font-display text-2xl text-[#FFD12A] [text-shadow:0_0_14px_rgba(255,209,42,0.9)]">{tr("+{0} Coins", result.coins.toLocaleString(locale()))}</p>
        <p data-testid="fishing-result-summary" className="mt-3 rounded-2xl bg-[#0B0418]/80 p-2 text-center text-sm text-[#E9DDF7]">{tr("{0} gefangen! +{1} Coins{2}", fish.name, result.coins.toLocaleString(locale()), result.xp > 0 ? tr(" · +{0} Arcade-XP", result.xp) : "")}</p>
      </> : <div data-testid="fishing-result-escaped" className="fishing-catch-pop rounded-3xl border-2 border-[#FF2E97]/70 bg-[#1A0C33]/95 p-5 text-center shadow-[0_0_24px_rgba(255,46,151,0.4)]"><p className="text-4xl" aria-hidden>💦</p><h2 className="mt-2 font-display text-2xl text-neon-gradient">{tr("Der Fisch ist entkommen!")}</h2><p className="mt-2 text-sm text-[#BFAAD9]">{outcome} {baitById(result.bait_id)?.consumeOnCast ? tr("Der Versuch zählt, eine Köder-Nutzung wurde verbraucht.") : result.bait_id ? tr("Der Versuch zählt, dein Köder bleibt erhalten.") : tr("Der Versuch zählt.")}</p></div>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-testid="fishing-result-close-button" onClick={onClose} className="min-h-12 rounded-full border border-white/25 bg-[#0B0418]/80 text-sm font-semibold transition-transform duration-150 active:scale-95">{tr("Schließen")}</button>
        <button type="button" data-testid="fishing-result-again-button" disabled={!canAgain} onClick={onAgain} className="min-h-12 rounded-full bg-gradient-to-r from-[#FF2E97] to-[#B026FF] text-sm font-bold transition-transform duration-150 active:scale-95 disabled:opacity-50">{canAgain ? tr("Nochmal angeln") : tr("Für heute fertig")}</button>
      </div>
    </div>
  </div>;
}

/** Exklusive Mythisch-Animation: Abdunkeln, Lichtstrahlen, leuchtender Fisch, „MYTHISCHER FANG!“, +5.000, ggf. Badge. Gutschrift ist bereits serverseitig erfolgt. */
function MythicCatch({ result, firstBadge, canAgain, onAgain, onClose }: { result: ReelResult; firstBadge: boolean; canAgain: boolean; onAgain: () => void; onClose: () => void }) {
  const fish = fishById("mythic_marlin")!;
  return <div data-testid="fishing-mythic-catch" role="dialog" aria-modal="true" aria-label={tr("MYTHISCHER FANG!")} className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-[#07020F]/80 p-4 animate-in fade-in duration-500">
    <div aria-hidden className="fishing-mythic-rays pointer-events-none absolute left-1/2 top-[42%] h-[140vmax] w-[140vmax]" />
    <div className="relative w-full max-w-[20rem] text-center">
      <p data-testid="fishing-mythic-title" className="fishing-catch-pop font-display text-3xl tracking-wide text-transparent bg-gradient-to-r from-[#FFD76A] via-[#FF5FD2] to-[#A855FF] bg-clip-text [filter:drop-shadow(0_0_14px_rgba(255,46,151,0.9))]">{tr("MYTHISCHER FANG!")}</p>
      <img src={fish.image} alt={fish.name} className="fishing-mythic-fish mx-auto mt-3 w-full select-none" draggable={false} />
      <p className="mt-1 font-bold italic text-white">{fish.name}</p>
      <p data-testid="fishing-mythic-coins" className="fishing-catch-pop mt-2 font-display text-4xl text-[#FFD12A] [text-shadow:0_0_18px_rgba(255,209,42,0.95)]">{tr("+{0} Coins", result.coins.toLocaleString(locale()))}</p>
      {result.xp > 0 && <p className="text-xs text-[#E9DDF7]">{tr("+{0} Arcade-XP", result.xp)}</p>}
      {firstBadge && <div data-testid="fishing-mythic-badge" className="fishing-catch-pop mx-auto mt-3 flex w-fit items-center gap-3 rounded-2xl border border-[#FF5FD2]/70 bg-[#1A0C33]/90 p-2 pr-4 shadow-[0_0_20px_rgba(255,46,151,0.5)]"><BadgeImg id="mythic_catch" alt={tr("Mythischer Fang")} className="h-16 w-16" /><span className="text-left"><span className="block text-xs font-bold uppercase tracking-wider text-[#FFD76A]">{tr("Neues Badge freigeschaltet!")}</span><span className="block font-display text-base">{tr("Mythischer Fang")}</span></span></div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" data-testid="fishing-result-close-button" onClick={onClose} className="min-h-12 rounded-full border border-white/25 bg-[#0B0418]/80 text-sm font-semibold transition-transform duration-150 active:scale-95">{tr("Weiter")}</button>
        <button type="button" data-testid="fishing-result-again-button" disabled={!canAgain} onClick={onAgain} className="min-h-12 rounded-full bg-gradient-to-r from-[#FF2E97] to-[#B026FF] text-sm font-bold transition-transform duration-150 active:scale-95 disabled:opacity-50">{canAgain ? tr("Nochmal angeln") : tr("Für heute fertig")}</button>
      </div>
    </div>
  </div>;
}

// ---------- Canvas ----------
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, s: Sim, reduced: boolean) {
  ctx.clearRect(0, 0, w, h);
  const t = reduced ? 0 : now;
  // Wasser-Glitzern (Sonnen-Säule pink/gold, sonst türkis)
  ctx.lineCap = "round";
  for (let i = 0; i < 18; i++) {
    const row = i / 18; const y = h * (0.36 + row * 0.36);
    const nearSun = i % 3 !== 0;
    const baseX = nearSun ? w * (0.55 + Math.sin(i * 12.9) * 0.08 * (1 + row)) : w * ((i * 0.137) % 1);
    const x = baseX + Math.sin(t / 900 + i) * 10;
    const len = (10 + row * 26) * (0.6 + 0.4 * Math.sin(t / 600 + i * 2));
    ctx.strokeStyle = nearSun ? `rgba(255,${150 + (i % 4) * 20},170,${0.25 + 0.2 * Math.sin(t / 500 + i)})` : `rgba(34,228,242,${0.12 + 0.1 * Math.sin(t / 700 + i)})`;
    ctx.lineWidth = 1.2 + row * 1.6;
    ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y); ctx.stroke();
  }

  const phase = s.phase;
  const tipRest = { x: w * 0.68, y: h * 0.33 }; const base = { x: w * 0.96, y: h * 1.02 };
  let tip = tipRest;
  const castP = phase === "casting" || phase === "waiting" || phase === "bite" ? Math.min(1, (now - s.castStart) / CAST_MS) : 0;
  if (phase === "casting" && castP < 0.35) { const k = castP / 0.35; tip = { x: tipRest.x + w * 0.12 * k, y: tipRest.y - h * 0.05 * k }; }
  else if (phase === "casting") { const k = (castP - 0.35) / 0.65; tip = { x: tipRest.x + w * 0.12 * (1 - k) - w * 0.04 * Math.sin(k * Math.PI), y: tipRest.y - h * 0.05 * (1 - k) }; }
  if (phase === "bite") tip = { x: tip.x - 3 + Math.sin(now / 45) * 2, y: tip.y + 6 };

  // Schwimmer
  const target = { x: w * BOBBER.x, y: h * BOBBER.y };
  let bob: { x: number; y: number } | null = null;
  if (phase === "casting" && castP > 0.35) { const k = (castP - 0.35) / 0.65; bob = { x: tip.x + (target.x - tip.x) * k, y: tip.y + (target.y - tip.y) * k - Math.sin(k * Math.PI) * h * 0.14 }; }
  else if (phase === "waiting") bob = { x: target.x, y: target.y + Math.sin(t / 420) * 3 };
  else if (phase === "bite") bob = { x: target.x + Math.sin(now / 70) * 2, y: target.y + 4 + Math.abs(Math.sin(now / 95)) * (reduced ? 4 : 10) };
  else if (phase === "reeling") bob = { x: target.x, y: target.y + 6 };

  // Effekte: Wellen beim Aufkommen + beim Anbeißen, Blasen beim Biss
  if (!reduced) {
    if (s.splashAt && now >= s.splashAt) { s.fx.push({ x: target.x, y: target.y, t: now, kind: "ripple" }); s.splashAt = 0; }
    if (phase === "bite" && now - s.lastFx > 170) { s.lastFx = now; s.fx.push({ x: target.x, y: target.y, t: now, kind: "ripple" }); s.fx.push({ x: target.x + (Math.random() - 0.5) * 22, y: target.y + 4, t: now, kind: "bubble" }); }
    else if (phase === "waiting" && now - s.lastFx > 1400) { s.lastFx = now; s.fx.push({ x: target.x, y: target.y, t: now, kind: "ripple" }); }
  }
  s.fx = s.fx.filter((f) => now - f.t < 1100);
  for (const f of s.fx) {
    const k = (now - f.t) / 1100;
    if (f.kind === "ripple") { ctx.strokeStyle = `rgba(255,190,230,${0.55 * (1 - k)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(f.x, f.y + 4, 8 + k * 34, 3 + k * 10, 0, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.fillStyle = `rgba(200,245,255,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + Math.sin(k * 8) * 3, f.y - k * 34, 1.5 + k * 2, 0, Math.PI * 2); ctx.fill(); }
  }

  // Schnur
  if (bob) {
    ctx.strokeStyle = phase === "bite" ? "rgba(255,240,180,0.95)" : "rgba(255,230,250,0.75)"; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    const sag = phase === "bite" ? 0 : h * 0.06;
    ctx.quadraticCurveTo((tip.x + bob.x) / 2, Math.max(tip.y, bob.y) + sag, bob.x, bob.y); ctx.stroke();
    ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = phase === "bite" ? "#FFD12A" : "#FF2E97";
    ctx.fillStyle = phase === "bite" ? "#FFD12A" : "#FF2E97"; ctx.beginPath(); ctx.arc(bob.x, bob.y, 6.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(bob.x, bob.y, 6.5, 0, Math.PI); ctx.fill(); ctx.restore();
  }

  // Angelrute (dunkel mit pinker Neonkante)
  ctx.save();
  ctx.shadowBlur = 12; ctx.shadowColor = "#FF2E97";
  ctx.strokeStyle = "#FF5FB4"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.restore();
  const grad = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y); grad.addColorStop(0, "#1A0F24"); grad.addColorStop(1, "#3B2A4A");
  ctx.strokeStyle = grad; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(base.x + (tip.x - base.x) * 0.45, base.y + (tip.y - base.y) * 0.45); ctx.stroke();
  ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(base.x + (tip.x - base.x) * 0.45, base.y + (tip.y - base.y) * 0.45); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  const reelPos = { x: base.x + (tip.x - base.x) * 0.2, y: base.y + (tip.y - base.y) * 0.2 };
  ctx.fillStyle = "#2A1838"; ctx.strokeStyle = "#22E4F2"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(reelPos.x - 10, reelPos.y + 6, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
