import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { adPrivacyOptionsRequired, adRewardKey, adsSupported, resumePendingAdReward, showAdPrivacyOptions, useAdRewardState, type AdPlacement } from "@/lib/ads";
import { useWatchAdReward } from "./useWatchAdReward";
import { fishById, fishingKey, fishingOdds } from "@/lib/fishing";
import { locale, tr } from "@/lib/i18n";

const OFFERS: Record<AdPlacement, { title: string; reward: string; color: string }> = {
  fishing_bonus_casts: { title: "Werbung ansehen – 5 Bonus-Fänge", reward: "5 Bonus-Angelversuche", color: "#22E4F2" },
  fishing_special_bait: { title: "Werbung ansehen – Spezialköder erhalten", reward: "1 Epischer Köder (3 Würfe)", color: "#FF2E97" },
};

/** Freiwillige Rewarded Ads in Leonida Fishing (nur iPhone-App, nur nach bewusstem Tippen). */
export function AdRewards({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const supported = adsSupported();
  const state = useAdRewardState(userId, supported);
  const [ask, setAsk] = useState<AdPlacement | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const s = state.data;

  const refresh = () => { void qc.invalidateQueries({ queryKey: adRewardKey(userId) }); void qc.invalidateQueries({ queryKey: fishingKey(userId) }); };
  // Unterbrochene Bestätigung (App-Wechsel/Verbindung weg) beim Öffnen nachholen
  useEffect(() => {
    if (!supported) return;
    void resumePendingAdReward().then((r) => { if (r) { toast.success(tr("Werbebelohnung gutgeschrieben!")); refresh(); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, userId]);
  useEffect(() => {
    if (!supported || !s || s.mode === "off") return;
    void adPrivacyOptionsRequired().then(setPrivacy).catch(() => undefined); // nur Status, kein Formular, keine Anzeige
  }, [supported, s?.mode]);

  const watch = useWatchAdReward(userId);

  if (!supported || !s || s.mode === "off" || !s.logged_in || !s.bonus || !s.bait) return null;
  const left = { fishing_bonus_casts: s.bonus.limit - s.bonus.used, fishing_special_bait: s.bait.limit - s.bait.used } as const;
  const limits = { fishing_bonus_casts: s.bonus.limit, fishing_special_bait: s.bait.limit } as const;
  const epic = fishById("palmenschnapper")!;
  const odds = fishingOdds("epic");

  return <div data-testid="fishing-ad-rewards" className="flex flex-col gap-1.5">
    {(["fishing_bonus_casts", "fishing_special_bait"] as const).map((p) => {
      const o = OFFERS[p]; const busy = watch.isPending && watch.variables === p;
      return <button key={p} type="button" data-testid={`fishing-ad-${p}`} disabled={left[p] <= 0 || watch.isPending} onClick={() => setAsk(p)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-[#120A24]/85 px-3 text-left text-xs font-bold backdrop-blur-sm transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-45"
        style={{ borderColor: `${o.color}99`, color: o.color, boxShadow: `0 0 12px ${o.color}33` }}>
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Clapperboard className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{busy ? tr("Belohnung wird überprüft …") : tr(o.title)}</span>
        <span data-testid={`fishing-ad-${p}-left`} className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/85">{tr("{0}/{1} verfügbar", Math.max(0, left[p]), limits[p])}</span>
      </button>;
    })}
    <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-white/55">
      {s.mode === "test" ? <span data-testid="fishing-ad-test-mode" className="rounded-full border border-[#FFD12A]/50 px-2 py-0.5 font-bold text-[#FFD12A]">{tr("TESTANZEIGEN")}</span> : <span />}
      {privacy && <button type="button" data-testid="fishing-ad-privacy" onClick={() => void showAdPrivacyOptions()} className="inline-flex min-h-8 items-center gap-1 underline-offset-2 hover:underline"><ShieldCheck className="h-3 w-3" />{tr("Werbe-Datenschutz")}</button>}
    </div>

    <AlertDialog open={!!ask} onOpenChange={(o) => { if (!o) setAsk(null); }}>
      <AlertDialogContent data-testid="fishing-ad-confirm" className="rounded-3xl border-2 border-[#FF2E97]/70 bg-[#120A24]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-display"><Clapperboard className="h-5 w-5 text-[#22E4F2]" />{tr("Werbung ansehen?")}</AlertDialogTitle>
          <AlertDialogDescription data-testid="fishing-ad-confirm-text" className="space-y-2 text-sm">
            <span className="block">{tr("Nach vollständigem Ansehen erhältst du:")} <b className="text-white">{ask ? tr(OFFERS[ask].reward) : ""}</b></span>
            {ask === "fishing_special_bait" && <span className="block text-xs">{tr("Der Köder erhöht nur die Chance auf {0}: {1} % statt {2} %. Kein Fang ist garantiert.", epic.name, odds.palmenschnapper.toLocaleString(locale(), { maximumFractionDigits: 1 }), epic.baseChance.toLocaleString(locale()))}</span>}
            {ask === "fishing_bonus_casts" && <span className="block text-xs">{tr("Bonus-Angelversuche gelten nach den 15 täglichen Versuchen. Fangchancen bleiben unverändert.")}</span>}
            <span className="block text-xs">{tr("Vorzeitiges Schließen gibt keine Belohnung.")}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel data-testid="fishing-ad-cancel" className="min-h-12">{tr("Abbrechen")}</AlertDialogCancel>
          <AlertDialogAction data-testid="fishing-ad-start" className="min-h-12 bg-[#FF2E97] font-bold text-white hover:bg-[#FF2E97]/90"
            onClick={() => { const p = ask; setAsk(null); if (p) watch.mutate(p); }}>{tr("Werbung starten")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
