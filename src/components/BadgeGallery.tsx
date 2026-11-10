import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { isNativeApp } from "@/lib/native";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BADGES, badgeById, badgeImg, progressOf, type BadgeDef, type Progress } from "@/lib/badges";

/** Galerie: freigeschaltet = farbig, gesperrt = grau; Antippen zeigt Name, Bedingung, Fortschritt. */
export function BadgeGallery({ unlocked, progress, featured, onFeature }: {
  unlocked: string[]; progress?: Progress | undefined; featured?: string[] | null | undefined; onFeature?: ((ids: string[]) => Promise<string | null>) | undefined;
}) {
  const [open, setOpen] = useState<BadgeDef | null>(null);
  const fav = featured ?? [];
  const toggleFav = async (id: string) => {
    if (!onFeature) return;
    const next = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id];
    if (next.length > 3) { toast.error("Du kannst höchstens 3 Abzeichen hervorheben"); return; }
    const err = await onFeature(next); if (err) toast.error(err); else toast.success(fav.includes(id) ? "Nicht mehr hervorgehoben" : "Hervorgehoben");
  };
  const section = (kind: "community" | "donation", title: string) => (
    <div className="space-y-2">
      <p className="text-xs font-bold tracking-[0.2em] text-muted-foreground">{title}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {BADGES.filter((b) => b.kind === kind).map((b) => {
          const on = unlocked.includes(b.id); const pr = progressOf(b, progress);
          return (
            <button key={b.id} type="button" onClick={() => setOpen(b)} data-testid={`badge-${b.id}`} data-unlocked={on}
              className="relative flex flex-col items-center gap-1 rounded-2xl p-1 transition-transform duration-150 active:scale-95">
              <img src={badgeImg(b.id)} alt={b.name} loading="lazy" className={`h-20 w-full object-contain ${on ? "drop-shadow-[0_0_10px_oklch(0.7_0.3_345/0.5)]" : "opacity-45 grayscale"}`} />
              {fav.includes(b.id) && <Star className="absolute right-1 top-1 h-4 w-4 fill-accent text-accent" />}
              {!on && pr && <span className="h-1 w-4/5 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-sunset" style={{ width: `${pr.pct * 100}%` }} /></span>}
            </button>);
        })}
      </div>
    </div>
  );
  const pr = open ? progressOf(open, progress) : null; const isOn = !!open && unlocked.includes(open.id);
  return (
    <div className="space-y-4">
      {section("community", "COMMUNITY-ABZEICHEN")}
      {section("donation", "UNTERSTÜTZER")}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-xs text-center">
          {open && <>
            <img src={badgeImg(open.id)} alt="" className={`mx-auto h-36 object-contain ${isOn ? "" : "opacity-50 grayscale"}`} />
            <DialogHeader><DialogTitle data-testid="badge-dialog-name" className="text-center">{open.name}</DialogTitle>
              <DialogDescription data-testid="badge-dialog-requirement" className="text-center">{open.requirement}</DialogDescription></DialogHeader>
            <p data-testid="badge-dialog-status" className={`text-sm font-semibold ${isOn ? "text-neon" : "text-muted-foreground"}`}>
              {isOn ? "Freigeschaltet" : open.kind === "donation" ? "Wird von einem Admin nach geprüfter Spende vergeben" : pr ? `Fortschritt: ${pr.label}` : "Gesperrt"}
            </p>
            {!isOn && onFeature && open.kind === "donation" && !isNativeApp() && <Link to="/spenden" data-testid="badge-donate-link" className="inline-block rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Jetzt unterstützen</Link>}
            {isOn && onFeature && <Button variant="outline" data-testid="badge-feature-button" onClick={() => toggleFav(open.id)}>
              <Star className="h-4 w-4" />{fav.includes(open.id) ? "Nicht mehr hervorheben" : "Im Profil hervorheben"}</Button>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export const featuredDefs = (ids: string[] | null | undefined) => (ids ?? []).map(badgeById).filter((b): b is BadgeDef => !!b);
