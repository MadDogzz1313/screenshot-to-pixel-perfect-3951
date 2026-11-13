import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCoinBalance } from "@/lib/arcade";
import { BAITS, baitStock, fishByRarity, fishingError, fishingOdds, formatPercent, newNonce, RARITY_STYLE, useBuyBait, useFishingState, type Bait } from "@/lib/fishing";
import { locale, tr } from "@/lib/i18n";
import { useStore } from "@/lib/store";

/** Neoshop-Bereich „Angelköder“ – Kauf serverseitig per buy_fishing_bait (SQL 027), idempotent per Nonce. */
export function BaitShop() {
  const { user } = useStore();
  const state = useFishingState(user?.id);
  const balance = useCoinBalance(!!user);
  const buy = useBuyBait(user?.id);
  const [confirm, setConfirm] = useState<{ bait: Bait; nonce: string } | null>(null);
  const coins = typeof balance.data === "number" ? balance.data : 0;
  const fmt = (n: number) => n.toLocaleString(locale());
  const pct = (n: number) => formatPercent(n, locale());
  const setupMissing = !!state.data?.setupMissing;

  const ask = (bait: Bait) => {
    if (!user) { toast.error(tr("Bitte melde dich an, um zu angeln und Köder zu kaufen.")); return; }
    if (setupMissing) { toast.error(tr("Leonida Fishing wird nach dem Datenbank-Update (SQL 027) aktiv.")); return; }
    setConfirm({ bait, nonce: newNonce() });
  };
  const doBuy = () => {
    if (!confirm || buy.isPending) return;
    const { bait, nonce } = confirm;
    buy.mutate({ bait: bait.id, nonce }, {
      onSuccess: (r) => { toast.success(r.already_processed ? tr("{0} ist bereits in deinem Inventar – keine Coins doppelt abgezogen.", bait.name) : tr("{0} gekauft! −{1} Coins", bait.name, fmt(r.charged))); setConfirm(null); },
      onError: (e) => { toast.error(fishingError(e as { code?: string; message?: string })); setConfirm(null); },
    });
  };
  const missing = confirm ? Math.max(0, confirm.bait.price - coins) : 0;

  return <section data-testid="neoshop-baits" className="space-y-3">
    {setupMissing && <p data-testid="neoshop-baits-setup-hint" className="rounded-2xl border border-[#FFD12A]/40 bg-[#FFD12A]/10 p-3 text-xs text-[#FFE38A]">{tr("Leonida Fishing wird nach dem Datenbank-Update (SQL 027) aktiv.")}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {BAITS.map((b) => {
        const style = RARITY_STYLE[b.rarity]; const fish = fishByRarity(b.rarity); const stock = baitStock(state.data, b.id);
        return <article key={b.id} data-testid={`neoshop-bait-card-${b.rarity}`} className="relative flex flex-col rounded-3xl border-2 bg-[#160A2C]/95 p-3" style={{ borderColor: style.color, boxShadow: `0 0 16px ${style.glow}` }}>
          <p className="font-display text-sm italic" style={{ color: style.color }}>{style.label}</p>
          <div className="relative mt-1 grid h-16 place-items-center"><span aria-hidden className="text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]">🪝</span><img src={fish.image} alt="" loading="lazy" className="absolute bottom-0 right-0 w-16 opacity-90" /></div>
          <h3 className="mt-1 text-sm font-bold">{b.name}</h3>
          <p data-testid={`neoshop-bait-${b.rarity}-bonus`} className="text-[11px] text-[#BFAAD9]">{tr("{0}: {1} → {2}", fish.name, pct(fish.baseChance), pct(fishingOdds(b.rarity)[fish.id]))}</p>
          <p className="text-[11px] text-[#BFAAD9]">{tr("{0} Nutzungen", b.uses)}{stock.items ? ` · ${tr("Im Inventar: {0}", stock.uses)}` : ""}</p>
          <span data-testid={`neoshop-bait-${b.rarity}-price`} className="mt-2 inline-flex w-fit items-center gap-1 font-bold text-[#FFD12A]"><span aria-hidden>🪙</span>{fmt(b.price)}</span>
          <button type="button" data-testid={`neoshop-bait-${b.rarity}-buy-button`} onClick={() => ask(b)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF2E97] to-[#B026FF] text-sm font-bold shadow-[0_0_14px_rgba(255,46,151,0.4)] transition-transform duration-150 active:scale-95"><ShoppingCart className="h-4 w-4" />{tr("Kaufen")}</button>
        </article>;
      })}
    </div>
    <p data-testid="neoshop-baits-info" className="rounded-2xl border border-border bg-card/55 p-4 text-center text-xs text-muted-foreground">{tr("Ein Köder vervierfacht die Fangchance seiner Seltenheit (+300 %) und hält 3 erfolgreiche Fänge. Die anderen Chancen sinken anteilig, zusammen immer 100 %.")}</p>

    <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && !buy.isPending) setConfirm(null); }}>
      <AlertDialogContent data-testid="neoshop-bait-dialog" className="border-[#FF2E97]/60 bg-[#1E0C38] text-white shadow-[0_0_30px_rgba(255,46,151,0.3)]">
        {confirm && (() => { const b = confirm.bait; const style = RARITY_STYLE[b.rarity]; const fish = fishByRarity(b.rarity); return <>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="neoshop-bait-dialog-title" className="font-display text-xl">{tr("{0} kaufen?", b.name)}</AlertDialogTitle>
            <AlertDialogDescription className="text-[#BFAAD9]">{tr("Es werden genau {0} Coins abgezogen.", fmt(b.price))}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 rounded-2xl border border-white/10 bg-[#120624] p-3 text-sm">
            <Row label={tr("Preis")} testId="neoshop-bait-dialog-price"><span className="text-[#FFD12A]">{tr("{0} Coins", fmt(b.price))}</span></Row>
            <Row label={tr("Seltenheit")} testId="neoshop-bait-dialog-rarity"><span style={{ color: style.color }}>{style.label}</span></Row>
            <Row label={tr("Chancenbonus")} testId="neoshop-bait-dialog-bonus">{tr("+300 % · {0} → {1}", pct(fish.baseChance), pct(fishingOdds(b.rarity)[fish.id]))}</Row>
            <Row label={tr("Nutzungen")} testId="neoshop-bait-dialog-uses">{tr("{0} erfolgreiche Fänge", b.uses)}</Row>
            <Row label={tr("Dein Guthaben")} testId="neoshop-bait-dialog-balance">{tr("{0} Coins", fmt(coins))}</Row>
            {missing === 0 && <Row label={tr("Danach")}><span className="text-[#22E4F2]">{tr("{0} Coins", fmt(coins - b.price))}</span></Row>}
          </div>
          {missing > 0 && <p data-testid="neoshop-bait-insufficient" role="alert" className="rounded-2xl border border-[#FF2E97]/50 bg-[#FF2E97]/10 p-3 text-sm text-[#FFB3D9]">{tr("Dir fehlen noch {0} Coins. Sammle Coins in Neon Highway, Leonida Fishing oder durch Levelaufstiege.", fmt(missing))}</p>}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="neoshop-bait-cancel-button" disabled={buy.isPending} className="border-white/20 bg-transparent text-white">{tr("Abbrechen")}</AlertDialogCancel>
            {missing > 0
              ? <AlertDialogAction asChild><Link to="/arcade" data-testid="neoshop-bait-earn-button" className="bg-[#22E4F2] text-[#0B0418]">{tr("Coins sammeln")}</Link></AlertDialogAction>
              : <button type="button" data-testid="neoshop-bait-confirm-button" disabled={buy.isPending} onClick={doBuy} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#FF2E97] to-[#B026FF] px-4 text-sm font-bold disabled:opacity-60"><ShoppingCart className="h-4 w-4" />{buy.isPending ? tr("Kauf läuft …") : tr("Für {0} Coins kaufen", fmt(b.price))}</button>}
          </AlertDialogFooter>
        </>; })()}
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function Row({ label, testId, children }: { label: string; testId?: string; children: React.ReactNode }) {
  return <p className="flex justify-between gap-3"><span className="text-[#BFAAD9]">{label}</span><span data-testid={testId} className="text-right font-bold">{children}</span></p>;
}
