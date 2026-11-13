import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, LockKeyhole, ShoppingCart, Warehouse } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { locale, tr } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { readStoredSkin, useEquipVehicleSkin, useVehicleGarage, vehicleSkinError, VEHICLE_SKINS, type GarageEntry, type VehicleSkinId } from "@/lib/vehicle-skins";

/** Neon Garage: freigeschaltete Fahrzeugdesigns wechseln. Rein optisch – Spielwerte bleiben unverändert. */
export function NeonGarage({ onClose }: { onClose: () => void }) {
  const { user } = useStore();
  const garage = useVehicleGarage(user?.id);
  const equip = useEquipVehicleSkin(user?.id);
  const equippedId: VehicleSkinId = garage.data?.equipped ?? readStoredSkin(user?.id);
  const entries: GarageEntry[] = garage.data?.entries ?? VEHICLE_SKINS.map((s) => ({ ...s, owned: s.price === 0, equipped: s.id === equippedId }));
  const [selectedId, setSelectedId] = useState<VehicleSkinId | null>(null);
  const selected = entries.find((e) => e.id === (selectedId ?? equippedId)) ?? entries[0]!;
  const isEquipped = selected.id === equippedId;
  const fmt = (n: number) => n.toLocaleString(locale());

  const onEquip = () => {
    if (!selected.owned || isEquipped) return;
    if (!user) { toast.error(tr("Bitte melde dich an, um Fahrzeugdesigns zu kaufen und zu speichern.")); return; }
    equip.mutate(selected.id, {
      onSuccess: () => toast.success(tr("{0} ist jetzt ausgerüstet.", selected.name)),
      onError: (error) => toast.error(vehicleSkinError(error as { code?: string; message?: string })),
    });
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div data-testid="neon-garage" role="dialog" aria-modal="true" aria-label="Neon Garage" className="fixed inset-0 z-[70] flex flex-col overflow-y-auto overscroll-contain bg-[#12052A] text-white animate-in fade-in duration-200">
      {/* Neonbeleuchtung + Garagentor-Lamellen */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#3A0E63_0%,#1A0733_45%,#0B0418_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-25 [background:repeating-linear-gradient(180deg,rgba(191,170,217,0.22)_0_2px,transparent_2px_18px)]" />
      <div aria-hidden className="pointer-events-none absolute left-6 right-1/2 top-[calc(env(safe-area-inset-top)+4.25rem)] h-1 rounded-full bg-[#FF2E97] shadow-[0_0_18px_4px_rgba(255,46,151,0.65)]" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 right-6 top-[calc(env(safe-area-inset-top)+4.25rem)] h-1 rounded-full bg-[#22E4F2] shadow-[0_0_18px_4px_rgba(34,228,242,0.6)]" />

      <header className="relative flex items-center justify-between gap-2 px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button type="button" data-testid="garage-close-button" aria-label={tr("Garage schließen")} onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#22E4F2]/70 bg-[#2B0B47]/90 text-[#22E4F2] shadow-[0_0_14px_rgba(34,228,242,0.3)] transition-transform duration-150 active:scale-90"><ArrowLeft className="h-5 w-5" /></button>
        <h2 data-testid="garage-title" className="flex items-center gap-2 font-display text-2xl text-neon-gradient"><Warehouse className="h-6 w-6 text-[#FF2E97]" />Neon Garage</h2>
        <div data-testid="garage-coin-balance"><CoinBalance compact /></div>
      </header>

      <section className="relative mt-6 px-4" aria-live="polite">
        <div className="relative mx-auto flex aspect-[16/10] w-full max-w-md items-end justify-center">
          <div aria-hidden className="absolute inset-x-6 bottom-1 h-14 rounded-[50%] blur-xl transition-[background-color] duration-300" style={{ backgroundColor: `${selected.glow}66` }} />
          <div aria-hidden className="absolute inset-x-2 bottom-0 h-6 rounded-[50%] border border-[#22E4F2]/50 bg-[#22E4F2]/10 shadow-[0_0_24px_rgba(34,228,242,0.35)]" />
          <img key={selected.id} data-testid="garage-preview-image" src={selected.rear} alt={selected.name} draggable={false} className={`relative w-[88%] select-none drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)] animate-in zoom-in-95 fade-in duration-300 ${selected.owned ? "" : "brightness-[0.55] saturate-50"}`} />
          {!selected.owned && <span aria-hidden className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-[#0B0418]/70 backdrop-blur-sm"><LockKeyhole className="h-6 w-6 text-white/90" /></span></span>}
          <span data-testid="garage-preview-status" className={`absolute left-1 top-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${isEquipped ? "bg-[#22E4F2] text-[#0B0418] shadow-[0_0_16px_rgba(34,228,242,0.6)]" : selected.owned ? "border border-[#22E4F2]/60 bg-[#0B0418]/70 text-[#22E4F2]" : "border border-white/25 bg-[#0B0418]/70 text-[#BFAAD9]"}`}>
            {isEquipped ? <><Check className="h-3.5 w-3.5" />{tr("Ausgerüstet")}</> : selected.owned ? tr("Freigeschaltet") : <><LockKeyhole className="h-3.5 w-3.5" />{tr("Gesperrt")}</>}
          </span>
        </div>
        <div className="mx-auto mt-3 max-w-md text-center">
          <h3 data-testid="garage-preview-name" className="font-display text-2xl">{selected.name}</h3>
          <p className="mt-1 text-sm text-[#BFAAD9]">{selected.tagline}</p>
        </div>
      </section>

      <section className="relative mt-5" aria-label={tr("Fahrzeugdesigns")}>
        <div data-testid="garage-skin-list" className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {entries.map((e) => {
            const active = e.id === selected.id; const eq = e.id === equippedId;
            return <button key={e.id} type="button" data-testid={`garage-skin-${e.id}`} aria-pressed={active} onClick={() => setSelectedId(e.id)} className={`relative w-[7.5rem] shrink-0 snap-start rounded-2xl border p-2 text-left transition-[border-color,box-shadow,transform] duration-150 active:scale-95 ${active ? "border-[#FF2E97] bg-[#2A0F4A] shadow-[0_0_18px_rgba(255,46,151,0.45)]" : "border-white/10 bg-[#1C0B36]/80"}`}>
              <span className="grid h-16 place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.08),transparent_70%)]"><img src={e.rear} alt="" draggable={false} className={`w-full select-none ${e.owned ? "" : "brightness-50 saturate-50"}`} /></span>
              <span className="mt-1.5 block truncate text-xs font-bold">{e.name}</span>
              <span data-testid={`garage-skin-${e.id}-status`} className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${eq ? "text-[#22E4F2]" : e.owned ? "text-[#BFAAD9]" : "text-[#FFD12A]"}`}>
                {eq ? <><Check className="h-3 w-3" />{tr("Ausgerüstet")}</> : e.owned ? tr("Freigeschaltet") : <><LockKeyhole className="h-3 w-3" />{tr("{0} Coins", fmt(e.price))}</>}
              </span>
            </button>;
          })}
        </div>
      </section>

      <section className="relative mx-auto mt-auto w-full max-w-md space-y-2 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
        {garage.data?.setupMissing && <p data-testid="garage-setup-hint" className="rounded-2xl border border-[#FFD12A]/40 bg-[#FFD12A]/10 p-3 text-center text-xs text-[#FFE38A]">{tr("Fahrzeugdesigns werden nach dem Datenbank-Update (SQL 025) aktiv.")}</p>}
        {!user && <p data-testid="garage-login-hint" className="text-center text-xs text-[#BFAAD9]">{tr("Melde dich an, um Designs zu kaufen und deine Auswahl zu speichern.")}</p>}
        {selected.owned
          ? <button type="button" data-testid="garage-equip-button" disabled={isEquipped || equip.isPending} onClick={onEquip} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF2E97] to-[#B026FF] font-bold shadow-[0_0_22px_rgba(255,46,151,0.45)] transition-[transform,opacity,box-shadow] duration-150 active:scale-95 disabled:opacity-60 disabled:shadow-none">
              {isEquipped ? <><Check className="h-4 w-4" />{tr("Ausgerüstet")}</> : equip.isPending ? tr("Wird ausgerüstet …") : tr("Design ausrüsten")}
            </button>
          : <Link to="/neoshop" search={{ design: selected.id, from: "garage" }} data-testid="garage-buy-in-shop-button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF2E97] to-[#B026FF] font-bold shadow-[0_0_22px_rgba(255,46,151,0.45)] transition-transform duration-150 active:scale-95"><ShoppingCart className="h-4 w-4" />{tr("Im Neoshop kaufen · {0} Coins", fmt(selected.price))}</Link>}
        <Link to="/neoshop" search={{ from: "garage" }} data-testid="garage-neoshop-button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#22E4F2]/70 bg-[#0B0418]/60 font-semibold text-[#22E4F2] shadow-[0_0_14px_rgba(34,228,242,0.25)] transition-[transform,background-color] duration-150 active:scale-95 active:bg-[#22E4F2]/15"><ShoppingCart className="h-4 w-4" />{tr("Zum Neoshop")}</Link>
      </section>
    </div>,
    document.body,
  );
}
