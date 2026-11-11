import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { deleteAvatar, uploadAvatar } from "@/lib/social";

import { tr } from "@/lib/i18n";
/** Zugeschnittenes Quadrat als 512 × 512 JPEG (~50 KB) für schnelle Ladezeiten. */
async function cropToJpeg(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  c.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
}

export function AvatarEditor({ userId, path, hasAvatar, onDone }: { userId: string; path: string | null; hasAvatar: boolean; onDone: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null); const [busy, setBusy] = useState(false);
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error(tr("Bitte ein Bild auswählen")); return; }
    if (f.size > 20_000_000) { toast.error(tr("Bild ist zu groß (max. 20 MB)")); return; }
    setZoom(1); setCrop({ x: 0, y: 0 }); setSrc(URL.createObjectURL(f));
  };
  const save = async () => {
    if (!src || !area) return;
    setBusy(true);
    try { const err = await uploadAvatar(userId, await cropToJpeg(src, area), path); if (err) toast.error(err); else { toast.success(tr("Profilbild gespeichert")); setSrc(null); onDone(); } }
    catch { toast.error(tr("Bild konnte nicht verarbeitet werden")); }
    setBusy(false);
  };
  const remove = async () => { const err = await deleteAvatar(userId, path); if (err) toast.error(err); else { toast.success(tr("Profilbild gelöscht")); onDone(); } };
  return (
    <div className="flex gap-2">
      <label data-testid="avatar-upload-button" className="neon-card flex flex-1 cursor-pointer items-center justify-center gap-2 !rounded-xl py-2.5 text-sm font-semibold">
        <Camera className="h-4 w-4 text-neon" />{hasAvatar ? tr("Bild ändern") : tr("Bild hochladen")}
        <input type="file" accept="image/*" className="hidden" data-testid="avatar-file-input" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {hasAvatar && <Button variant="outline" data-testid="avatar-delete-button" onClick={remove}><Trash2 className="h-4 w-4" />{tr("Löschen")}</Button>}
      <Dialog open={!!src} onOpenChange={(o) => !o && setSrc(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{tr("Profilbild zuschneiden")}</DialogTitle></DialogHeader>
          <div className="relative h-72 overflow-hidden rounded-2xl bg-black">
            {src && <Cropper image={src} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
              onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)} />}
          </div>
          <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} aria-label="Zoom" data-testid="avatar-zoom-slider" />
          <Button onClick={save} disabled={busy || !area} data-testid="avatar-save-button" className="bg-sunset font-bold">{busy ? tr("Wird gespeichert …") : tr("Speichern")}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
