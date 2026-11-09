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

export const Route = createFileRoute("/fundort/$id")({
  head: () => ({ meta: [{ title: "Fundort · Leonida Explorer" }, { name: "description", content: "Details zu einem Fundort in Leonida." }, { property: "og:title", content: "Fundort · Leonida Explorer" }, { property: "og:description", content: "Details zu einem Fundort in Leonida." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { spots, profiles, liked, saved, toggleLike, toggleSave, user } = useStore();
  const [fix, setFix] = useState(""); const [fixOpen, setFixOpen] = useState(false); const [busy, setBusy] = useState(false);
  const s = spots.find((x) => x.id === id);
  if (!s) return <AppShell title="Fundort"><p className="px-3">Nicht gefunden.</p></AppShell>;
  const cat = categoryById(s.category); const author = profiles.find((p) => p.username === s.author);
  const need = () => { if (!user) { toast.error("Bitte anmelden"); return false; } return true; };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: s.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success("Link kopiert"); }
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
            {s.hour !== undefined && <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-neon" />{String(s.hour).padStart(2, "0")}:00 Uhr</span>}
          </div>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{s.description}</p>
          <div className="flex gap-2">
            <button data-testid="spot-like-button" onClick={() => need() && toggleLike(s.id)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 ${liked.includes(s.id) ? "bg-primary text-primary-foreground" : ""}`}><Heart className="h-4 w-4" />{s.likes}</button>
            <button onClick={() => need() && toggleSave(s.id)} className={`flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 ${saved.includes(s.id) ? "bg-accent text-accent-foreground" : ""}`}><Bookmark className="h-4 w-4" />Merken</button>
            <button onClick={share} className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2"><Share2 className="h-4 w-4" />Teilen</button>
          </div>
        </div>
        <div className="neon-card space-y-2 p-3">
          <button type="button" data-testid="spot-correction-toggle" onClick={() => need() && setFixOpen((v) => !v)} className="flex w-full items-center gap-2 text-sm font-semibold"><PencilLine className="h-4 w-4 text-neon" />Korrektur melden</button>
          {fixOpen && <>
            <Textarea data-testid="spot-correction-input" value={fix} maxLength={500} placeholder="Was stimmt nicht? (z. B. genaue Position, Uhrzeit, Fahrzeug)" onChange={(e) => setFix(e.target.value)} />
            <Button data-testid="spot-correction-submit" disabled={busy || fix.trim().length < 5} className="w-full" onClick={async () => {
              setBusy(true); const err = await submitCorrection(s.id, user!.id, fix.trim()); setBusy(false);
              if (err) toast.error(err); else { toast.success("Danke! Ein Admin prüft deine Korrektur."); setFix(""); setFixOpen(false); }
            }}>Korrektur senden</Button></>}
        </div>
        {author && (
          <Link to="/u/$username" params={{ username: author.username }} className="neon-card flex items-center gap-3 p-3">
            <img src={author.avatar} alt="" className="h-12 w-12 rounded-full border-2 border-neon" />
            <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Entdeckt von</p><p className="truncate font-semibold">{author.username}</p></div>
            <LevelBadge xp={author.xp} />
          </Link>)}
      </div>
    </AppShell>
  );
}
