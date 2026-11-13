import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { RowBody, rowCls } from "@/components/settings/SettingsUi";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isMissing, sb } from "@/lib/db";
import { useStore } from "@/lib/store";

import { tr } from "@/lib/i18n";
const CONFIRM = tr("LÖSCHEN");

/** Konto dauerhaft löschen (App-Store-Pflicht, SQL 011/020 delete_my_account). Dateien werden danach best-effort entfernt.
 *  Ab SQL 020 liefert die Datenbank die zu löschenden Fotopfade; Fotos freigegebener Fundorte bleiben anonym erhalten. */
export function DeleteAccount({ userId }: { userId: string }) {
  const { signOut } = useStore(); const nav = useNavigate();
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const [avatars, photos] = await Promise.all([
        sb.storage.from("avatars").list(userId, { limit: 1000 }),
        sb.from("spot_photos").select("path").eq("uploader_id", userId),
      ]);
      const { data, error } = await sb.rpc("delete_my_account");
      if (error) {
        toast.error(isMissing(error) ? tr("Konto löschen wird nach dem Datenbank-Update (SQL 011) aktiv.")
          : error.message.includes("ADMIN_DELETE") ? tr("Admin-Konten können nicht selbst gelöscht werden. Entferne zuerst die Admin-Rolle in Lovable.")
          : tr("Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut."));
        return;
      }
      // SQL 020: nur die vom Server genannten Fotos; vor SQL 020 (alles wird gelöscht): alle eigenen Fotos
      const serverPaths = (data as { photo_paths?: string[] } | null)?.photo_paths;
      const photoPaths = (serverPaths ?? ((photos.data ?? []) as { path: string }[]).map((r) => r.path)).filter((p) => p.startsWith(`${userId}/`));
      await Promise.allSettled([
        avatars.data?.length ? sb.storage.from("avatars").remove(avatars.data.map((f) => `${userId}/${f.name}`)) : null,
        photoPaths.length ? sb.storage.from("spot-photos").remove(photoPaths) : null,
      ]);
      await signOut();
      toast.success(tr("Dein Konto wurde gelöscht."));
      nav({ to: "/", replace: true });
    } finally { setBusy(false); }
  };
  return (
    <AlertDialog onOpenChange={(o) => !o && setText("")}>
      <AlertDialogTrigger asChild>
        <button type="button" data-testid="settings-delete-account-button" className={rowCls}>
          <RowBody icon={Trash2} label={tr("Konto löschen")} hint={tr("Alle Daten dauerhaft entfernen")} danger /></button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="delete-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Konto endgültig löschen?")}</AlertDialogTitle>
          <AlertDialogDescription>{tr("Profil, Profilbild, XP, Abzeichen, Coins, Community-Chat- und Privatnachrichten (das ganze Gespräch für beide), Freundschaften, Meldungen und nicht freigegebene Fundorte werden dauerhaft gelöscht. Bereits freigegebene Fundorte bleiben ohne deinen Namen als „Gelöschter Nutzer“ auf der Karte. Das kann nicht rückgängig gemacht werden. Tippe zur Bestätigung „{0}“ ein.", CONFIRM)}</AlertDialogDescription>
        </AlertDialogHeader>
        <Input data-testid="delete-account-confirm-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={CONFIRM} autoCapitalize="characters" className="h-12 text-base" />
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-account-cancel-button">{tr("Abbrechen")}</AlertDialogCancel>
          <Button variant="destructive" data-testid="delete-account-submit-button" disabled={text.trim().toUpperCase() !== CONFIRM || busy} onClick={run}>{tr("Endgültig löschen")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
