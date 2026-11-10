import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { badgeImg } from "@/lib/badges";
import { isNativeApp } from "@/lib/native";
import { euro, startCheckout, useDonationTiers } from "@/lib/payments";

export const Route = createFileRoute("/spenden")({
  validateSearch: (s: Record<string, unknown>): { abgebrochen?: 1 } => (s["abgebrochen"] ? { abgebrochen: 1 } : {}),
  head: () => ({ meta: [{ title: "Unterstützen · Leonida Explorer" }, { name: "description", content: "Unterstütze Leonida Explorer mit einer Spende und erhalte ein Unterstützer-Abzeichen." }] }),
  component: Donate,
});

function Donate() {
  const { user, authReady } = useStore();
  const { abgebrochen } = Route.useSearch();
  const tiers = useDonationTiers();
  const [selected, setSelected] = useState<string | null>("bronze");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const cfg = tiers.data;
  const customCents = Math.round(Number(custom.replace(",", ".")) * 100);
  const customValid = !!cfg && custom.trim() !== "" && Number.isFinite(customCents) && customCents >= cfg.custom_min_cents && customCents <= cfg.custom_max_cents;
  const amount = selected ? cfg?.tiers.find((t) => t.id === selected)?.amount_cents : customValid ? customCents : undefined;

  const pay = async () => {
    setBusy(true);
    try {
      const r = await startCheckout(selected ? { tier_id: selected } : { custom_amount_cents: customCents });
      window.location.href = r.checkout_url;
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  if (!authReady) return <AppShell title="Unterstützen">{null}</AppShell>;
  if (isNativeApp()) return (
    <AppShell title="Unterstützen"><div data-testid="donate-native-hint" className="neon-card mx-3 space-y-2 p-5 text-center text-sm">
      <p className="font-display">Spenden in der App nicht verfügbar</p><p className="text-muted-foreground">Spenden sind nur über die Website von Leonida Explorer möglich.</p></div></AppShell>);
  return (
    <AppShell title="Unterstützen">
      <div data-testid="donate-page" className="space-y-3 px-3 pb-4">
        <section className="neon-card space-y-2 p-4">
          <p className="flex items-center gap-2 font-display text-lg"><Heart className="h-5 w-5 text-accent" />Leonida Explorer unterstützen</p>
          <p className="text-sm text-muted-foreground">Mit deiner Spende hilfst du, Server und neue Funktionen zu finanzieren. Als Dank gibt es ein Unterstützer-Abzeichen – die Stufe richtet sich nach der Summe aller deiner bestätigten Spenden.</p>
          {cfg?.test_mode && <p data-testid="donate-test-mode-hint" className="rounded-xl border border-[#FFD12A]/50 bg-[#FFD12A]/10 p-2 text-xs text-[#FFD12A]">Testmodus: Es wird kein echtes Geld abgebucht. Testkarte 4242 4242 4242 4242, beliebiges Datum in der Zukunft, beliebige Prüfziffer.</p>}
          {abgebrochen && <p data-testid="donate-cancelled-hint" className="rounded-xl border border-border bg-background/40 p-2 text-xs">Zahlung abgebrochen – es wurde nichts abgebucht.</p>}
        </section>

        {!user ? (
          <div className="neon-card space-y-3 p-5 text-center"><p>Melde dich an, damit wir deine Spende deinem Profil zuordnen können.</p>
            <Link to="/" data-testid="donate-login-link" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Anmelden / Registrieren</Link></div>
        ) : tiers.isError ? (
          <p data-testid="donate-error" className="neon-card p-4 text-sm text-destructive">Spenden sind gerade nicht erreichbar. Bitte versuche es später erneut.</p>
        ) : !cfg ? (
          <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-neon" /></div>
        ) : (
          <section className="neon-card space-y-3 p-4">
            <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground">BETRAG WÄHLEN</p>
            <div className="grid grid-cols-3 gap-2">
              {cfg.tiers.map((t) => {
                const on = selected === t.id;
                return (
                  <button key={t.id} type="button" data-testid={`donate-tier-${t.id}`} aria-pressed={on} onClick={() => { setSelected(t.id); setCustom(""); }}
                    className={`flex flex-col items-center gap-1 rounded-2xl border p-2 transition-[transform,border-color,box-shadow] duration-150 active:scale-95 ${on ? "border-neon shadow-[0_0_16px_oklch(0.8_0.2_200/0.35)]" : "border-border bg-background/30"}`}>
                    <img src={badgeImg(t.id)} alt="" loading="lazy" className={`h-14 w-full object-contain ${on ? "" : "opacity-70"}`} />
                    <span className="font-display text-base">{euro(t.amount_cents)}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground">{t.badge}</span>
                  </button>);
              })}
            </div>
            <div className="space-y-1">
              <label htmlFor="donate-custom" className="text-sm font-semibold">Eigener Betrag</label>
              <Input id="donate-custom" data-testid="donate-custom-amount-input" inputMode="decimal" placeholder={`${cfg.custom_min_cents / 100} – ${cfg.custom_max_cents / 100} €`} value={custom}
                onFocus={() => setSelected(null)} onChange={(e) => { setSelected(null); setCustom(e.target.value.replace(/[^\d.,]/g, "")); }} />
              {!selected && custom.trim() !== "" && !customValid && <p data-testid="donate-custom-amount-error" className="text-xs text-destructive">Bitte einen Betrag zwischen {euro(cfg.custom_min_cents)} und {euro(cfg.custom_max_cents)} eingeben.</p>}
            </div>
            <Button data-testid="donate-pay-button" className="w-full" disabled={busy || !amount} onClick={() => void pay()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}{amount ? `${euro(amount)} spenden` : "Betrag wählen"}
            </Button>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />Sichere Zahlung über Stripe. Nach der Zahlung prüft ein Admin deine Spende und schaltet dein Abzeichen frei. Spenden bringen keine XP und keine Vorteile im Spiel.</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
