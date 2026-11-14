import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adErrorDetail, adErrorMessage, adRewardKey, watchRewardedAd, type AdPlacement } from "@/lib/ads";
import { fishingKey, type FishingState } from "@/lib/fishing";
import { tr } from "@/lib/i18n";

/** Gemeinsamer Ablauf „Werbung ansehen → Server-Belohnung“ (Spiel + Köder-Shop teilen sich das Tageslimit). */
export function useWatchAdReward(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: AdPlacement) => watchRewardedAd(p, userId),
    onSuccess: (r, p) => {
      const casts = r.reward?.["bonus_casts"]; // Zähler sofort aktualisieren (Server-Wert), Refetch folgt
      if (typeof casts === "number") qc.setQueryData<FishingState>(fishingKey(userId), (old) => (old ? { ...old, bonus_casts: casts } : old));
      toast.success(p === "fishing_bonus_casts" ? tr("+5 Bonus-Angelversuche erhalten!") : tr("Epischer Köder erhalten!"), { description: r.already_processed ? tr("Bereits gutgeschrieben.") : undefined });
    },
    onError: (e) => {
      const msg = adErrorMessage(e); const detail = adErrorDetail(e);
      if (msg.includes("überprüft") || msg.includes("Verifying")) toast.info(msg); else toast.error(msg, { description: detail ? tr("Code: {0}", detail) : undefined });
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: adRewardKey(userId) }); void qc.invalidateQueries({ queryKey: fishingKey(userId) }); },
  });
}
