import { ArrowLeft, LockKeyhole, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { tr } from "@/lib/i18n";

const SHOP_PREVIEW = [
  { id: "neon-frame", title: tr("Neon-Profilrahmen"), description: tr("Ein leuchtender Rahmen für dein Profil."), icon: "💠" },
  { id: "map-style", title: tr("Miami-Kartenstil"), description: tr("Neue Farben für deine Leonida-Karte."), icon: "🌴" },
  { id: "arcade-boost", title: tr("Arcade-Booster"), description: tr("Zusätzliche Arcade-Erweiterungen für deine Spielsessions."), icon: "⚡" },
] as const;

/** Katalog-Oberfläche für den Neoshop. Kaufaktionen erscheinen erst, wenn dafür ein persistenter Server-Flow existiert. */
export function NeoshopView() {
  return (
    <AppShell title={tr("Neoshop")} headerLeft={<Link to="/arcade" aria-label={tr("Zurück zur Neon Arcade")} data-testid="neoshop-back-button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#22E4F2]/70 bg-[#2B0B47]/90 text-[#22E4F2] shadow-[0_0_14px_rgba(34,228,242,0.3)] transition-[transform,box-shadow] duration-150 active:scale-90"><ArrowLeft className="h-5 w-5" /></Link>}>
      <div data-testid="neoshop-page" className="space-y-5 px-3 pb-6 animate-in fade-in duration-200">
        <section className="relative overflow-hidden rounded-3xl border border-[#22E4F2]/55 bg-[#21113B]/90 p-5 shadow-[0_0_24px_rgba(34,228,242,0.18)] backdrop-blur-xl">
          <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 text-8xl opacity-15">🛒</div>
          <div className="relative flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#22E4F2]/60 bg-[#2B0B47] text-[#22E4F2] shadow-[0_0_16px_rgba(34,228,242,0.3)]"><ShoppingBag className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#22E4F2]">{tr("Sammle · Gestalte · Entdecke")}</p><h2 data-testid="neoshop-title" className="font-display text-2xl text-neon-gradient">{tr("Dein Neoshop")}</h2></div></div>
          <p className="relative mt-3 text-sm text-[#BFAAD9]">{tr("Deine Leonida Coins werden hier bald gegen exklusive Neon-Erweiterungen eingetauscht.")}</p>
          <div data-testid="neoshop-coin-balance" className="relative mt-4"><CoinBalance /></div>
        </section>
        <section data-testid="neoshop-catalog" className="space-y-3">
          <h2 className="flex items-center gap-2 px-1 font-display text-lg"><Sparkles className="h-5 w-5 text-[#22E4F2]" />{tr("Neon-Katalog")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHOP_PREVIEW.map((item) => <article key={item.id} data-testid={`neoshop-item-card-${item.id}`} className="relative overflow-hidden rounded-3xl border border-[#FF2E97]/50 bg-[#24133F]/90 p-4 shadow-[0_0_16px_rgba(255,46,151,0.16)]"><div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#22E4F2]/45 bg-[#120824] text-2xl">{item.icon}</span><div className="min-w-0 flex-1"><h3 className="font-display text-base">{item.title}</h3><p className="mt-1 text-xs text-[#BFAAD9]">{item.description}</p></div><LockKeyhole className="h-4 w-4 shrink-0 text-[#BFAAD9]" aria-label={tr("Bald verfügbar")} /></div><p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22E4F2]">{tr("Bald verfügbar")}</p></article>)}
          </div>
        </section>
        <p data-testid="neoshop-info" className="rounded-2xl border border-border bg-card/55 p-4 text-center text-xs text-muted-foreground">{tr("Coins werden weiterhin ausschließlich über die bestehenden Arcade-Belohnungen und Levelaufstiege synchronisiert.")}</p>
      </div>
    </AppShell>
  );
}
