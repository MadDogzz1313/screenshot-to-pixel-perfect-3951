import { Coins } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCoinBalance } from "@/lib/arcade";
import { locale, tr } from "@/lib/i18n";

export function CoinBalance({ compact = false }: { compact?: boolean }) {
  const { user } = useStore();
  const balance = useCoinBalance(!!user);
  return <div data-testid="coin-balance-display" className={`inline-flex items-center gap-1.5 rounded-full border border-[#FFD12A]/60 bg-[#FFD12A]/10 px-3 py-1.5 font-bold text-[#FFD12A] shadow-[0_0_14px_rgba(255,209,42,0.18)] ${compact ? "text-xs" : "text-sm"}`}>
    <Coins className="h-4 w-4" /><span>{typeof balance.data === "number" ? balance.data.toLocaleString(locale()) : "0"}</span>{!compact && <span className="font-normal">{tr("Coins")}</span>}
  </div>;
}
