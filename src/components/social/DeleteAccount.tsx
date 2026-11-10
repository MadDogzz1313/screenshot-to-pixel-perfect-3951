import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isMissing, sb } from "@/lib/db";
import { useStore } from "@/lib/store";

const CONFIRM = "LÖSCHEN";

/** Konto dauerhaft löschen (App-Store-Pflicht, SQL 011 delete_my_account). Dateien werden danach best-effort entfernt. */
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
      const { error } = await sb.rpc("delete_my_account");
      if (error) {
        toast.error(isMissing(error) ? "Konto löschen wird nach dem Datenbank-Update (SQL 011) aktiv."
          : error.message.includes("ADMIN_DELETE") ? "Admin-Konten können nicht selbst gelöscht werden. Entferne zuerst die Admin-Rolle in Lovable."
          : "Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut.");
        return;
      }
      await Promise.allSettled([
        avatars.data?.length ? sb.storage.from("avatars").remove(avatars.data.map((f) => `${userId}/${f.name}`)) : null,
        photos.data?.length ? sb.storage.from("spot-photos").remove((photos.data as { path: string }[]).map((r) => r.path)) : null,
      ]);
      await signOut();
      toast.success("Dein Konto wurde gelöscht.");
      nav({ to: "/", replace: true });
    } finally { setBusy(false); }
  };
  return (
    <AlertDialog onOpenChange={(o) => !o && setText("")}>
      <AlertDialogTrigger asChild>
        <button type="button" data-testid="profile-delete-account-button" className="flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-destructive transition-opacity duration-150 active:opacity-60">
          <Trash2 className="h-4 w-4" />Konto löschen
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="delete-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>Profil, XP, Abzeichen, Fundorte, Fotos, Nachrichten und Freundschaften werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden. Tippe zur Bestätigung „{CONFIRM}“ ein.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input data-testid="delete-account-confirm-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={CONFIRM} autoCapitalize="characters" className="h-12 text-base" />
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-account-cancel-button">Abbrechen</AlertDialogCancel>
          <Button variant="destructive" data-testid="delete-account-submit-button" disabled={text.trim().toUpperCase() !== CONFIRM || busy} onClick={run}>Endgültig löschen</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
