import { Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adErrorMessage, bonusAdsLeft, type AdRewardState } from "@/lib/ads";
import { tr } from "@/lib/i18n";
import { useWatchAdReward } from "./useWatchAdReward";

/** Fenster „Keine Angelversuche mehr“ – freiwillige Rewarded Ad für +5 Bonus-Angelversuche (max. 2× pro Tag). */
export function BonusCastsDialog({ open, onOpenChange, userId, adState }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; adState: AdRewardState | undefined }) {
  const watch = useWatchAdReward(userId);
  const left = bonusAdsLeft(adState);
  const limit = adState?.bonus?.limit ?? 2;
  const busy = watch.isPending;
  const close = (o: boolean) => { if (!o && busy) return; if (!o) watch.reset(); onOpenChange(o); };
  const start = () => {
    if (busy || left <= 0) return;
    watch.mutate("fishing_bonus_casts", { onSuccess: () => onOpenChange(false) });
  };

  return <AlertDialog open={open} onOpenChange={close}>
    <AlertDialogContent data-testid="fishing-bonus-offer" onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
      className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border-2 border-[#FF2E97] bg-gradient-to-b from-[#2B0B47] to-[#140726] p-5 text-white shadow-[0_0_28px_rgba(255,46,151,0.55),0_0_60px_rgba(176,38,255,0.35)]">
      <div aria-hidden className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-[#B026FF]/80 bg-[#0B0418]/70 shadow-[0_0_24px_rgba(176,38,255,0.55)]">
        <span className="fishing-hook-swing text-4xl">🎣</span>
      </div>
      <AlertDialogHeader className="text-center sm:text-center">
        <AlertDialogTitle data-testid="fishing-bonus-offer-title" className="font-display text-2xl italic text-[#FF5FB4] [text-shadow:0_0_14px_rgba(255,46,151,0.8)]">{tr("🎣 KEINE ANGELVERSUCHE MEHR!")}</AlertDialogTitle>
        <AlertDialogDescription data-testid="fishing-bonus-offer-text" className="text-sm text-[#E9DDF7]">
          {tr("Du hast deine täglichen 15 Fänge verbraucht. Möchtest du 5 weitere Angelversuche erhalten?")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <p data-testid="fishing-bonus-offer-left" className="text-center text-xs font-semibold text-[#22E4F2]">{tr("Heute noch {0} von {1} Werbe-Belohnungen verfügbar", left, limit)}</p>
      {watch.isError && <p data-testid="fishing-bonus-offer-error" role="alert" className="rounded-2xl border border-[#FF2E97]/50 bg-[#FF2E97]/10 p-3 text-center text-xs text-[#FFB3D9]">{adErrorMessage(watch.error)}</p>}
      <div className="flex flex-col gap-2">
        <button type="button" data-testid="fishing-bonus-offer-watch" disabled={busy || left <= 0} onClick={start}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF2E97] to-[#B026FF] px-4 text-base font-black tracking-wide shadow-[0_0_20px_rgba(255,46,151,0.6)] transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-60">
          {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr("Belohnung wird überprüft …")}</> : tr("🎬 WERBUNG ANSEHEN – +5 FÄNGE")}
        </button>
        <button type="button" data-testid="fishing-bonus-offer-decline" disabled={busy} onClick={() => close(false)}
          className="min-h-11 w-full rounded-xl text-sm font-semibold text-[#BFAAD9] transition-[color,opacity] duration-150 hover:text-white disabled:opacity-50">{tr("Nein danke")}</button>
      </div>
      <p className="text-center text-[10px] text-white/50">{tr("Vorzeitiges Schließen gibt keine Belohnung.")}{adState?.mode === "test" ? ` · ${tr("TESTANZEIGEN")}` : ""}</p>
    </AlertDialogContent>
  </AlertDialog>;
}
