import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MapCanvas } from "@/components/MapCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type CategoryId } from "@/lib/demo-data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/beitrag")({
  head: () => ({ meta: [{ title: "Beitrag · Leonida Explorer" }, { name: "description", content: "Schlage einen neuen Fundort für die Community-Karte vor." }, { property: "og:title", content: "Beitrag · Leonida Explorer" }, { property: "og:description", content: "Schlage einen neuen Fundort für die Community-Karte vor." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Beitrag,
});

const schema = z.object({
  title: z.string().trim().min(3, "Titel zu kurz").max(80),
  area: z.string().trim().min(2, "Gebiet angeben").max(60),
  description: z.string().trim().min(10, "Beschreibung zu kurz").max(1000),
  vehicleType: z.string().trim().max(60).optional(),
});

function Beitrag() {
  const { user, authReady, addSpot } = useStore(); const nav = useNavigate();
  const [cat, setCat] = useState<CategoryId>("vehicle");
  const [f, setF] = useState({ title: "", area: "", description: "", vehicleType: "", hour: "12" });
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!authReady) return <AppShell title="Beitrag">{null}</AppShell>;
  if (!user) return (
    <AppShell title="Beitrag"><div className="neon-card mx-3 space-y-3 p-5 text-center"><p>Melde dich an, um Fundorte vorzuschlagen.</p>
      <Link to="/" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Anmelden</Link></div></AppShell>);
  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const ok = [...files].filter((x) => ["image/jpeg", "image/png", "image/webp"].includes(x.type) && x.size < 8_000_000).slice(0, 5);
    if (ok.length < files.length) toast.error("Nur JPG/PNG/WEBP bis 8 MB, max. 5 Bilder");
    setFiles(ok); setImages(ok.map((x) => URL.createObjectURL(x)));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(f);
    if (!r.success) { toast.error(r.error.issues[0]?.message ?? "Ungültige Eingabe"); return; }
    if (!pick) { toast.error("Bitte Standort auf der Karte setzen"); return; }
    if (cat === "vehicle" && !images.length) { toast.error("Bitte ein Foto hochladen"); return; }
    setBusy(true);
    const res = await addSpot({ ...r.data, category: cat, x: pick.x, y: pick.y,
      vehicleType: cat === "vehicle" ? r.data.vehicleType || undefined : undefined, hour: cat === "vehicle" ? +f.hour : undefined }, files);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    if (res.photoWarning) toast.warning("Fundort gespeichert, aber nicht alle Fotos konnten hochgeladen werden.");
    toast.success("Eingereicht! Wird nach Admin-Freigabe veröffentlicht.");
    nav({ to: "/profil" });
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <AppShell title="Fundort vorschlagen">
      <form onSubmit={submit} className="space-y-4 px-3">
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.id} data-testid={`spot-category-${c.id}`} onClick={() => setCat(c.id)}
              className={`neon-card flex flex-col items-center gap-1 !rounded-xl p-3 text-xs font-semibold ${cat === c.id ? "!bg-primary text-primary-foreground" : ""}`}>
              <c.icon className="h-6 w-6" />{c.label}
            </button>))}
        </div>
        <label className="neon-card flex cursor-pointer flex-col items-center gap-2 p-5 text-sm text-muted-foreground">
          <ImagePlus className="h-8 w-8 text-neon" />{images.length ? `${images.length} Foto(s) ausgewählt` : "Fotos hochladen"}
          <input type="file" data-testid="spot-photo-input" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        </label>
        {!!images.length && <div className="flex gap-2 overflow-x-auto">{images.map((s) => <img key={s} src={s} alt="" className="h-16 w-16 rounded-lg object-cover" />)}</div>}
        <Input placeholder="Titel" data-testid="spot-title-input" value={f.title} onChange={set("title")} className="h-12" />
        {cat === "vehicle" && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input placeholder="Fahrzeug-Typ (z. B. Sportwagen)" value={f.vehicleType} onChange={set("vehicleType")} className="h-12" />
            <select value={f.hour} onChange={set("hour")} aria-label="Uhrzeit" className="h-12 rounded-md border border-input bg-card px-3">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </div>)}
        <Input placeholder="Gebiet (z. B. Vice City Beach)" data-testid="spot-area-input" value={f.area} onChange={set("area")} className="h-12" />
        <Textarea placeholder="Beschreibung / Vorgehensweise" data-testid="spot-description-input" value={f.description} onChange={set("description")} rows={4} />
        <div><p className="mb-2 text-sm font-semibold">Standort auf Karte setzen {pick && <span className="text-muted-foreground">({pick.x}%, {pick.y}%)</span>}</p>
          <MapCanvas spots={[]} pick={pick} onPick={setPick} /></div>
        <Button type="submit" disabled={busy} data-testid="spot-submit-button" className="h-12 w-full bg-sunset text-base font-bold">{busy ? "Wird eingereicht …" : "Zur Prüfung einreichen"}</Button>
      </form>
    </AppShell>
  );
}
