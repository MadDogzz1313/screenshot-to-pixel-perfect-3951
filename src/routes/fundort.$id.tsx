import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Bookmark, Share2, Clock, MapPin, Car } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { LevelBadge } from "@/components/LevelBadge";
import { categoryById } from "@/lib/demo-data";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitCorrection } from "@/lib/social";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { arcadeError, spotUnlockError, useSpotAccess, useSpotUnlockPreview, useUnlockSpot } from "@/lib/arcade";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/fundort/$id")({
  head: () => ({ meta: [{ title: tr("Fundort · Leonida Explorer") }, { name: "description", content: tr("Details zu einem Fundort in Leonida.") }, { property: "og:title", content: tr("Fundort · Leonida Explorer") }, { property: "og:description", content: tr("Details zu einem Fundort in Leonida.") }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { spots, profiles, liked, saved, toggleLike, toggleSave, user, authReady } = useStore();
  const s = spots.find((x) => x.id === id);
  const ownSpot = !!user && s?.authorId === user.id;
  const [fix, setFix] = useState(""); const [fixOpen, setFixOpen] = useState(false); const [busy, setBusy] = useState(false);
  const access = useSpotAccess(id, !!user && !ownSpot); const unlockPreview = useSpotUnlockPreview(id, !!user && !ownSpot); const unlock = useUnlockSpot();
  if (!authReady) return <AppShell title={tr("Fundort")}><p data-testid="spot-auth-loading" className="px-3 text-sm text-muted-foreground">{tr("Fundort wird geladen …")}</p></AppShell>;
  if (!user) return <AppShell title={tr("Fundort")}><div data-testid="spot-login-required" className="mx-3 space-y-4 rounded-3xl border border-[#FF2E97]/60 bg-[#21113B]/95 p-5 text-center shadow-[0_0_28px_rgba(255,46,151,0.22)]"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-[#FF2E97] bg-[#120A24] text-4xl shadow-[0_0_24px_rgba(255,46,151,0.5)]">🔒</div><h1 data-testid="spot-login-required-title" className="font-display text-2xl text-neon-gradient">{tr("Anmeldung erforderlich")}</h1><p data-testid="spot-login-required-text" className="text-sm text-muted-foreground">{tr("Bitte anmelden, um Fundortdetails zu sehen.")}</p><Link to="/" data-testid="spot-login-required-link" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 font-bold text-primary-foreground transition-transform duration-150 active:scale-95">{tr("Anmelden / Registrieren")}</Link><Link to="/karte" data-testid="spot-login-required-back-link" className="block text-sm text-[#22E4F2]">{tr("Zurück zur Karte")}</Link></div></AppShell>;
  if (!s) return <AppShell title={tr("Fundort")}><p className="px-3">{tr("Nicht gefunden.")}</p></AppShell>;
  if (user && !ownSpot && access.data === false) return <AppShell title={tr("Fundort")}><div data-testid="spot-locked-panel" className="mx-3 space-y-4 rounded-3xl border border-[#FF2E97]/60 bg-[#21113B]/95 p-5 text-center shadow-[0_0_28px_rgba(255,46,151,0.22)]"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-[#FF2E97] bg-[#120A24] text-4xl shadow-[0_0_24px_rgba(255,46,151,0.5)]">🔒</div><h1 className="font-display text-2xl text-neon-gradient">{tr("Fundort freischalten?")}</h1><p className="text-sm text-muted-foreground">{tr("Schalte die vollständigen Details dieses Fundorts dauerhaft frei. Die ersten fünf Fundorte anderer Spieler sind kostenlos, danach kostet jeder weitere exakt 500 Leonida Coins.")}</p><div className="flex justify-center"><CoinBalance /></div><p data-testid="spot-unlock-price" className="text-sm font-semibold text-[#FFD12A]">{unlockPreview.data?.cost === 0 ? tr("Kostenlos freischalten") : unlockPreview.data ? tr("Freischaltung für 500 Coins") : tr("Freischaltstatus wird geprüft …")}</p><button type="button" data-testid="spot-unlock-button" disabled={!unlockPreview.data || unlock.isPending} aria-busy={unlock.isPending} onClick={() => { if (!confirm(tr("Fundort freischalten? Die ersten fünf Fundorte anderer Spieler sind kostenlos, danach werden exakt 500 Leonida Coins abgezogen."))) return; unlock.mutate(id, { onSuccess: (r) => toast.success(r?.cost ? tr("Fundort freigeschaltet · −{0} Coins", r.cost) : tr("Fundort kostenlos freigeschaltet")), onError: (e) => toast.error(spotUnlockError(e as { code?: string; message?: string; details?: string })) }); }} className="min-h-12 w-full rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-50">{unlock.isPending ? tr("Wird freigeschaltet …") : unlockPreview.data?.cost === 0 ? tr("Kostenlos freischalten") : unlockPreview.data ? tr("Für 500 Coins freischalten") : tr("Freischaltstatus wird geprüft …")}</button><Link to="/karte" data-testid="spot-locked-back-link" className="block text-sm text-[#22E4F2]">{tr("Zurück zur Karte")}</Link></div></AppShell>;
  if (user && !ownSpot && access.isPending) return <AppShell title={tr("Fundort")}><p data-testid="spot-access-loading" className="px-3 text-sm text-muted-foreground">{tr("Fundort wird geladen …")}</p></AppShell>;
  const cat = categoryById(s.category); const author = profiles.find((p) => p.username === s.author);
  const need = () => { if (!user) { toast.error(tr("Bitte anmelden")); return false; } return true; };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: s.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success(tr("Link kopiert")); }
  };
  return (
    <AppShell>
      <div className="flex snap-x snap-mandatory overflow-x-auto">
        {s.images.map((src) => <img key={src} src={src} alt={s.title} className="aspect-[16/10] w-full shrink-0 snap-center object-cover" />)}
      </div>
      <div className="-mt-6 space-y-4 px-3">
        <div className="neon-card space-y-3 p-4">
          <span className={`inline-flex items-center gap-1 rounded-full ${cat.color} px-2 py-0.5 text-xs font-semibold`}><cat.icon className="h-3 w-3" />{cat.label}</span>
          <h1 className="font-display text-2xl">{s.title}</h1>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-neon" />{s.area}</span>
            {s.vehicleType && <span className="flex items-center gap-1"><Car className="h-4 w-4 text-neon" />{s.vehicleType}</span>}
            {s.hour !== undefined && <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-neon" />{String(s.hour).padStart(2, "0")}{tr(":00 Uhr")}</span>}
          </div>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{s.description}</p>
          <div className="flex gap-2">
            <button data-testid="spot-like-button" onClick={() => need() && toggleLike(s.id)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 ${liked.includes(s.id) ? "bg-primary text-primary-foreground" : ""}`}><Heart className="h-4 w-4" />{s.likes}</button>
            <button onClick={() => need() && toggleSave(s.id)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 ${saved.includes(s.id) ? "bg-accent text-accent-foreground" : ""}`}><Bookmark className="h-4 w-4" />{tr("Merken")}</button>
            <button onClick={share} className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2"><Share2 className="h-4 w-4" />{tr("Teilen")}</button>
          </div>
        </div>
        <div className="neon-card space-y-2 p-3">
          <button type="button" data-testid="spot-correction-toggle" onClick={() => need() && setFixOpen((v) => !v)} className="flex w-full items-center gap-2 text-sm font-semibold"><PencilLine className="h-4 w-4 text-neon" />{tr("Korrektur melden")}</button>
          {fixOpen && <>
            <Textarea data-testid="spot-correction-input" value={fix} maxLength={500} placeholder={tr("Was stimmt nicht? (z. B. genaue Position, Uhrzeit, Fahrzeug)")} onChange={(e) => setFix(e.target.value)} />
            <Button data-testid="spot-correction-submit" disabled={busy || fix.trim().length < 5} className="w-full" onClick={async () => {
              setBusy(true); const err = await submitCorrection(s.id, user!.id, fix.trim()); setBusy(false);
              if (err) toast.error(err); else { toast.success(tr("Danke! Ein Admin prüft deine Korrektur.")); setFix(""); setFixOpen(false); }
            }}>{tr("Korrektur senden")}</Button></>}
        </div>
        {author && (
          <Link to="/u/$username" params={{ username: author.username }} className="neon-card flex items-center gap-3 p-3">
            <img src={author.avatar} alt="" className="h-12 w-12 rounded-full border-2 border-neon" />
            <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{tr("Entdeckt von")}</p><p className="truncate font-semibold">{author.username}</p></div>
            <LevelBadge xp={author.xp} />
          </Link>)}
      </div>
    </AppShell>
  );
}
