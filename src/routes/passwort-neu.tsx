import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import bg from "@/assets/bg-sunset.jpg";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/passwort-neu")({
  head: () => ({ meta: [{ title: tr("Neues Passwort · Leonida Explorer") }, { name: "robots", content: "noindex" }, { name: "description", content: tr("Lege ein neues Passwort für deinen Leonida-Explorer-Account fest.") }, { property: "og:title", content: tr("Neues Passwort · Leonida Explorer") }, { property: "og:description", content: tr("Lege ein neues Passwort fest.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NewPassword,
});

const schema = z.object({ password: z.string().min(6, tr("Mindestens 6 Zeichen")).max(72, tr("Maximal 72 Zeichen")), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: tr("Die Passwörter stimmen nicht überein"), path: ["confirm"] });

function NewPassword() {
  const { user, authReady, updatePassword } = useStore();
  const nav = useNavigate();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState(false);
  // Abgelaufene/ungültige Links liefert Supabase als #error=...&error_code=otp_expired
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    if (h.get("error") || q.get("error")) setLinkError(true);
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({ password, confirm });
    if (!r.success) { toast.error(r.error.issues[0]?.message ?? tr("Ungültige Eingabe")); return; }
    setBusy(true); const res = await updatePassword(r.data.password); setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(tr("Dein neues Passwort ist gespeichert!"));
    nav({ to: "/karte", replace: true });
  };
  const invalid = authReady && !user;
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-end px-5 pb-10">
      <img src={bg} alt="" className="fixed inset-0 -z-10 h-full w-full object-cover" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background/90" />
      <div className="mb-auto mt-[18vh] text-center">
        <h1 className="font-display text-5xl leading-none text-neon-gradient">LEONIDA<br />EXPLORER</h1>
        <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-foreground/90">{tr("NEUES PASSWORT")}</p>
      </div>
      {!authReady ? (
        <div data-testid="reset-loading" className="neon-card w-full max-w-sm p-5 text-center text-sm text-muted-foreground">{tr("Link wird geprüft …")}</div>
      ) : invalid || linkError ? (
        <div data-testid="reset-invalid" className="neon-card w-full max-w-sm space-y-3 p-5 text-center">
          <p className="font-semibold">{tr("Der Link ist ungültig oder abgelaufen.")}</p>
          <p className="text-sm text-muted-foreground">{tr("Fordere auf der Anmeldeseite über „Passwort vergessen?“ einfach einen neuen Link an.")}</p>
          <Link to="/" data-testid="reset-back-link" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">{tr("Zur Anmeldung")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} data-testid="reset-form" className="neon-card w-full max-w-sm space-y-3 p-5">
          <p data-testid="reset-account" className="text-sm text-muted-foreground">{tr("Neues Passwort für")}{" "}<span className="font-semibold text-foreground">{user?.email}</span></p>
          <Input type="password" autoComplete="new-password" data-testid="reset-password-input" placeholder={tr("Neues Passwort")} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          <Input type="password" autoComplete="new-password" data-testid="reset-confirm-input" placeholder={tr("Passwort wiederholen")} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12" />
          <Button type="submit" disabled={busy} data-testid="reset-submit-button" className="h-12 w-full bg-sunset text-base font-bold">{tr("Passwort speichern")}</Button>
        </form>
      )}
    </div>
  );
}
