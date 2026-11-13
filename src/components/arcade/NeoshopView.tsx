import { ArrowLeft, Car, Check, Fish, LockKeyhole, Package, ShoppingBag, ShoppingCart, Sparkles, Warehouse } from "lucide-react";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { BaitShop } from "@/components/arcade/fishing/BaitShop";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCoinBalance } from "@/lib/arcade";
import { locale, tr } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { readStoredSkin, useBuyVehicleSkin, useEquipVehicleSkin, useVehicleGarage, vehicleSkinError, VEHICLE_SKINS, type GarageEntry } from "@/lib/vehicle-skins";

type Tab = "skins" | "baits" | "effects" | "extras";
const COMING_SOON = {
  effects: [{ id: "arcade-boost", title: tr("Arcade-Booster"), description: tr("Zusätzliche Arcade-Erweiterungen für deine Spielsessions."), icon: "⚡" }],
  extras: [
    { id: "neon-frame", title: tr("Neon-Profilrahmen"), description: tr("Ein leuchtender Rahmen für dein Profil."), icon: "💠" },
    { id: "map-style", title: tr("Miami-Kartenstil"), description: tr("Neue Farben für deine Leonida-Karte."), icon: "🌴" },
  ],
} as const;

/** Neoshop: Fahrzeugdesigns für Neon Highway (Kauf serverseitig per buy_vehicle_skin, SQL 025). */
export function NeoshopView() {
  const search = useSearch({ from: "/neoshop" });
  const { user } = useStore();
  const garage = useVehicleGarage(user?.id);
  const balance = useCoinBalance(!!user);
  const buy = useBuyVehicleSkin(user?.id);
  const equip = useEquipVehicleSkin(user?.id);
  const [tab, setTab] = useState<Tab>(search.tab ?? "skins");
  const [confirm, setConfirm] = useState<GarageEntry | null>(null);
  const [bought, setBought] = useState<GarageEntry | null>(null);
  const fmt = (n: number) => n.toLocaleString(locale());
  const equippedId = garage.data?.equipped ?? readStoredSkin(user?.id);
  const entries: GarageEntry[] = garage.data?.entries ?? VEHICLE_SKINS.map((s) => ({ ...s, owned: s.price === 0, equipped: s.id === equippedId }));
  const setupMissing = !!garage.data?.setupMissing;
  const coins = typeof balance.data === "number" ? balance.data : 0;
  const fromGarage = search.from === "garage";

  // Aus der Garage gewähltes Design hervorheben
  useEffect(() => {
    if (!search.design) return;
    const el = document.querySelector(`[data-testid="neoshop-skin-card-${CSS.escape(search.design)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [search.design, garage.data]);

  const askBuy = (entry: GarageEntry) => {
    if (!user) { toast.error(tr("Bitte melde dich an, um Fahrzeugdesigns zu kaufen und zu speichern.")); return; }
    if (setupMissing) { toast.error(tr("Fahrzeugdesigns werden nach dem Datenbank-Update (SQL 025) aktiv.")); return; }
    setBought(null); setConfirm(entry);
  };
  const doBuy = () => {
    const entry = confirm; if (!entry || buy.isPending) return;
    buy.mutate(entry.id, {
      onSuccess: (result) => {
        if (result?.already_owned) toast.info(tr("{0} gehört dir bereits – es wurden keine Coins abgezogen.", entry.name));
        else toast.success(tr("{0} gehört jetzt dir! −{1} Coins", entry.name, fmt(result?.charged ?? entry.price)));
        setBought(entry);
      },
      onError: (error) => { toast.error(vehicleSkinError(error as { code?: string; message?: string })); setConfirm(null); },
    });
  };
  const doEquip = (entry: GarageEntry, close = false) => {
    equip.mutate(entry.id, {
      onSuccess: () => { toast.success(tr("{0} ist jetzt ausgerüstet.", entry.name)); if (close) { setConfirm(null); setBought(null); } },
      onError: (error) => toast.error(vehicleSkinError(error as { code?: string; message?: string })),
    });
  };
  const missing = confirm ? Math.max(0, confirm.price - coins) : 0;

  const back = fromGarage
    ? <Link to="/arcade/highway" search={{ garage: 1 }} aria-label={tr("Zurück zur Neon Garage")} data-testid="neoshop-back-button" className={BACK}><ArrowLeft className="h-5 w-5" /></Link>
    : <Link to="/arcade" aria-label={tr("Zurück zur Neon Arcade")} data-testid="neoshop-back-button" className={BACK}><ArrowLeft className="h-5 w-5" /></Link>;

  return (
    <AppShell title={tr("Neoshop")} headerLeft={back}>
      <div data-testid="neoshop-page" className="space-y-5 px-3 pb-6 animate-in fade-in duration-200">
        <section className="relative overflow-hidden rounded-3xl border border-[#22E4F2]/55 bg-[#21113B]/90 p-5 shadow-[0_0_24px_rgba(34,228,242,0.18)] backdrop-blur-xl">
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 text-8xl opacity-15">🛒</div>
          <div className="relative flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#22E4F2]/60 bg-[#2B0B47] text-[#22E4F2] shadow-[0_0_16px_rgba(34,228,242,0.3)]"><ShoppingBag className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#22E4F2]">{tr("Sammle · Gestalte · Entdecke")}</p><h2 data-testid="neoshop-title" className="font-display text-2xl text-neon-gradient">{tr("Dein Neoshop")}</h2></div></div>
          <p className="relative mt-3 text-sm text-[#BFAAD9]">{tr("Tausche deine Leonida Coins gegen Fahrzeugdesigns für Neon Highway und Angelköder für Leonida Fishing.")}</p>
          <div className="relative mt-4 flex flex-wrap items-center gap-2"><div data-testid="neoshop-coin-balance"><CoinBalance /></div><Link to="/arcade/highway" search={{ garage: 1 }} data-testid="neoshop-garage-link" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#FF2E97]/60 bg-[#2B0B47]/80 px-3 text-xs font-bold text-[#FFB3D9] transition-[transform,background-color] duration-150 active:scale-95 active:bg-[#FF2E97]/15"><Warehouse className="h-4 w-4" />{tr("Neon Garage")}</Link></div>
        </section>

        <div role="tablist" aria-label={tr("Neoshop-Bereiche")} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([["skins", tr("Fahrzeugdesigns"), Car], ["baits", tr("Angelköder"), Fish], ["effects", tr("Effekte"), Sparkles], ["extras", tr("Extras"), Package]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} data-testid={`neoshop-tab-${id}`} onClick={() => setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-[border-color,background-color,box-shadow,color] duration-150 ${tab === id ? "border-[#FF2E97] bg-[#3A0F55] text-white shadow-[0_0_16px_rgba(255,46,151,0.45)]" : "border-white/15 bg-[#1C0B36]/80 text-[#BFAAD9]"}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>

        {tab === "skins" ? (
          <section data-testid="neoshop-skins" className="space-y-3">
            {setupMissing && <p data-testid="neoshop-setup-hint" className="rounded-2xl border border-[#FFD12A]/40 bg-[#FFD12A]/10 p-3 text-xs text-[#FFE38A]">{tr("Fahrzeugdesigns werden nach dem Datenbank-Update (SQL 025) aktiv.")}</p>}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {entries.map((e) => {
                const eq = e.id === equippedId; const highlight = search.design === e.id;
                return <article key={e.id} data-testid={`neoshop-skin-card-${e.id}`} className={`relative flex flex-col overflow-hidden rounded-3xl border bg-[#1E0C38]/90 p-2.5 transition-[box-shadow,border-color] duration-300 ${highlight ? "border-[#22E4F2] shadow-[0_0_24px_rgba(34,228,242,0.5)]" : "border-[#FF2E97]/55 shadow-[0_0_16px_rgba(255,46,151,0.2)]"}`}>
                  <div className="relative grid aspect-[16/11] place-items-center overflow-hidden rounded-2xl bg-[#120624]" style={{ backgroundImage: `radial-gradient(circle at 50% 85%, ${e.glow}55, transparent 65%)` }}>
                    <img src={e.rear} alt={e.name} loading="lazy" draggable={false} className="w-[92%] select-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]" />
                    {e.basePrice > 0 && !e.owned && <span className="absolute right-1.5 top-1.5 rounded-full bg-[#FFD12A] px-2 py-0.5 text-[10px] font-black text-[#2B0B47]">−50 %</span>}
                    {eq && <span data-testid={`neoshop-skin-${e.id}-equipped`} className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-[#22E4F2] px-2 py-0.5 text-[10px] font-black uppercase text-[#0B0418]"><Check className="h-3 w-3" />{tr("Ausgerüstet")}</span>}
                  </div>
                  <h3 className="mt-2 truncate px-0.5 font-display text-sm italic">{e.name}</h3>
                  <div className="mt-1 flex min-h-8 items-center gap-1.5 px-0.5">
                    {e.price === 0 ? <span className="text-xs font-bold text-[#22E4F2]">{tr("Kostenlos")}</span> : <>
                      <span data-testid={`neoshop-skin-${e.id}-price`} className="inline-flex items-center gap-1 font-bold text-[#FFD12A]"><span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-[#FFD12A] text-[9px] text-[#2B0B47]">🪙</span>{fmt(e.price)}</span>
                      <span data-testid={`neoshop-skin-${e.id}-base-price`} className="text-[11px] text-[#BFAAD9] line-through">{fmt(e.basePrice)}</span>
                    </>}
                  </div>
                  <div className="mt-auto pt-2">
                    {!e.owned
                      ? <button type="button" data-testid={`neoshop-skin-${e.id}-buy-button`} onClick={() => askBuy(e)} className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF2E97] to-[#B026FF] text-sm font-bold shadow-[0_0_14px_rgba(255,46,151,0.4)] transition-transform duration-150 active:scale-95"><ShoppingCart className="h-4 w-4" />{tr("Kaufen")}</button>
                      : eq
                        ? <span className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#22E4F2]/40 text-xs font-bold text-[#22E4F2]"><Check className="h-4 w-4" />{tr("In deiner Garage")}</span>
                        : <button type="button" data-testid={`neoshop-skin-${e.id}-equip-button`} disabled={!user || equip.isPending} onClick={() => doEquip(e)} className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#22E4F2]/70 text-sm font-bold text-[#22E4F2] transition-[transform,background-color] duration-150 active:scale-95 active:bg-[#22E4F2]/15 disabled:opacity-50">{tr("Ausrüsten")}</button>}
                  </div>
                </article>;
              })}
            </div>
            <p data-testid="neoshop-info" className="rounded-2xl border border-border bg-card/55 p-4 text-center text-xs text-muted-foreground">{tr("Designs ändern nur das Aussehen deines Autos – Geschwindigkeit, Steuerung, Highscores und Belohnungen bleiben gleich.")}</p>
          </section>
        ) : tab === "baits" ? <BaitShop /> : (
          <section data-testid="neoshop-catalog" className="grid gap-3 sm:grid-cols-2">
            {COMING_SOON[tab].map((item) => <article key={item.id} data-testid={`neoshop-item-card-${item.id}`} className="relative overflow-hidden rounded-3xl border border-[#FF2E97]/50 bg-[#24133F]/90 p-4 shadow-[0_0_16px_rgba(255,46,151,0.16)]"><div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#22E4F2]/45 bg-[#120824] text-2xl">{item.icon}</span><div className="min-w-0 flex-1"><h3 className="font-display text-base">{item.title}</h3><p className="mt-1 text-xs text-[#BFAAD9]">{item.description}</p></div><LockKeyhole className="h-4 w-4 shrink-0 text-[#BFAAD9]" aria-label={tr("Bald verfügbar")} /></div><p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22E4F2]">{tr("Bald verfügbar")}</p></article>)}
          </section>
        )}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(open) => { if (!open && !buy.isPending) { setConfirm(null); setBought(null); } }}>
        <AlertDialogContent data-testid="neoshop-buy-dialog" className="border-[#FF2E97]/60 bg-[#1E0C38] text-white shadow-[0_0_30px_rgba(255,46,151,0.3)]">
          {confirm && (bought ? <>
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="neoshop-buy-success-title" className="font-display text-2xl text-neon-gradient">{tr("{0} gehört dir!", confirm.name)}</AlertDialogTitle>
              <AlertDialogDescription className="text-[#BFAAD9]">{tr("Das Design liegt jetzt dauerhaft in deiner Neon Garage.")}</AlertDialogDescription>
            </AlertDialogHeader>
            <img src={confirm.rear} alt="" className="mx-auto w-3/4 animate-in zoom-in-90 fade-in duration-300" />
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel data-testid="neoshop-buy-close-button" className="border-white/20 bg-transparent text-white">{tr("Schließen")}</AlertDialogCancel>
              <button type="button" data-testid="neoshop-buy-equip-button" disabled={equip.isPending} onClick={() => doEquip(confirm, true)} className="inline-flex min-h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF2E97] to-[#B026FF] px-4 text-sm font-bold disabled:opacity-60">{tr("Jetzt ausrüsten")}</button>
            </AlertDialogFooter>
          </> : <>
            <AlertDialogHeader>
              <AlertDialogTitle data-testid="neoshop-buy-dialog-title" className="font-display text-xl">{tr("{0} kaufen?", confirm.name)}</AlertDialogTitle>
              <AlertDialogDescription className="text-[#BFAAD9]">{tr("Einmal kaufen, für immer in deiner Garage. Es werden genau {0} Coins abgezogen.", fmt(confirm.price))}</AlertDialogDescription>
            </AlertDialogHeader>
            <img src={confirm.rear} alt="" className="mx-auto w-2/3" />
            <div className="space-y-1 rounded-2xl border border-white/10 bg-[#120624] p-3 text-sm">
              <p className="flex justify-between"><span className="text-[#BFAAD9]">{tr("Preis")}</span><span data-testid="neoshop-buy-dialog-price" className="font-bold text-[#FFD12A]">{tr("{0} Coins", fmt(confirm.price))} <span className="ml-1 text-xs font-normal text-[#BFAAD9] line-through">{fmt(confirm.basePrice)}</span></span></p>
              <p className="flex justify-between"><span className="text-[#BFAAD9]">{tr("Dein Guthaben")}</span><span data-testid="neoshop-buy-dialog-balance" className="font-bold">{tr("{0} Coins", fmt(coins))}</span></p>
              {missing === 0 && <p className="flex justify-between"><span className="text-[#BFAAD9]">{tr("Danach")}</span><span className="font-bold text-[#22E4F2]">{tr("{0} Coins", fmt(coins - confirm.price))}</span></p>}
            </div>
            {missing > 0 && <p data-testid="neoshop-insufficient-coins" role="alert" className="rounded-2xl border border-[#FF2E97]/50 bg-[#FF2E97]/10 p-3 text-sm text-[#FFB3D9]">{tr("Dir fehlen noch {0} Coins. Sammle Coins in Neon Highway, Leonida Fishing oder durch Levelaufstiege.", fmt(missing))}</p>}
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel data-testid="neoshop-buy-cancel-button" disabled={buy.isPending} className="border-white/20 bg-transparent text-white">{tr("Abbrechen")}</AlertDialogCancel>
              {missing > 0
                ? <AlertDialogAction asChild><Link to="/arcade" data-testid="neoshop-earn-coins-button" className="bg-[#22E4F2] text-[#0B0418]">{tr("Coins sammeln")}</Link></AlertDialogAction>
                : <button type="button" data-testid="neoshop-buy-confirm-button" disabled={buy.isPending} onClick={doBuy} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#FF2E97] to-[#B026FF] px-4 text-sm font-bold disabled:opacity-60"><ShoppingCart className="h-4 w-4" />{buy.isPending ? tr("Kauf läuft …") : tr("Für {0} Coins kaufen", fmt(confirm.price))}</button>}
            </AlertDialogFooter>
          </>)}
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

const BACK = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#22E4F2]/70 bg-[#2B0B47]/90 text-[#22E4F2] shadow-[0_0_14px_rgba(34,228,242,0.3)] transition-[transform,box-shadow] duration-150 active:scale-90";
