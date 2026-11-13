// Kontodaten ändern (Einstellungen → Konto & Profil): E-Mail-Adresse und Passwort über Supabase Auth.
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

import { tr } from "@/lib/i18n";
const field = "h-12 text-base";

export function EmailChangeForm({ current }: { current: string }) {
  const { changeEmail } = useStore();
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [sentTo, setSentTo] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!z.string().email().safeParse(next).success) { toast.error(tr("Bitte gib eine gültige E-Mail-Adresse ein.")); return; }
    if (next === current.toLowerCase()) { toast.error(tr("Das ist bereits deine aktuelle E-Mail-Adresse.")); return; }
    setBusy(true); const res = await changeEmail(next); setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setSentTo(next); setEmail("");
    toast.success(tr("Bestätigungslink gesendet."));
  };
  return (
    <form onSubmit={submit} data-testid="settings-email-form" className="space-y-2">
      <p className="text-xs text-muted-foreground">{tr("Aktuell:")}{" "}<span data-testid="settings-email-current" className="font-semibold text-foreground">{current}</span></p>
      <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" data-testid="settings-email-input" placeholder={tr("Neue E-Mail-Adresse")} value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      <Button type="submit" disabled={busy || !email.trim()} data-testid="settings-email-save-button" className="h-12 w-full font-bold">{busy ? tr("Wird gesendet …") : tr("E-Mail-Adresse ändern")}</Button>
      {sentTo && <p data-testid="settings-email-pending" className="rounded-2xl border border-neon/40 bg-primary/10 p-3 text-xs">{tr("Fast geschafft: Öffne den Bestätigungslink, den wir an {0} gesendet haben. Bis dahin bleibt deine bisherige Adresse aktiv.", sentTo)}</p>}
      <p className="text-[11px] text-muted-foreground">{tr("Deine E-Mail-Adresse ist nie öffentlich sichtbar.")}</p>
    </form>
  );
}

const schema = z.object({
  current: z.string().min(1, tr("Bitte gib dein aktuelles Passwort ein.")),
  next: z.string().min(6, tr("Mindestens 6 Zeichen")).max(72, tr("Maximal 72 Zeichen")),
  confirm: z.string(),
}).refine((d) => d.next === d.confirm, { message: tr("Die Passwörter stimmen nicht überein.") });

export function PasswordChangeForm() {
  const { changePassword } = useStore();
  const [v, setV] = useState({ current: "", next: "", confirm: "" }); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(v);
    if (!r.success) { toast.error(r.error.issues[0]?.message ?? tr("Ungültige Eingabe")); return; }
    setBusy(true); const res = await changePassword(r.data.current, r.data.next); setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    setV({ current: "", next: "", confirm: "" });
    toast.success(tr("Dein neues Passwort ist gespeichert!"));
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form onSubmit={submit} data-testid="settings-password-form" className="space-y-2">
      <Input type="password" autoComplete="current-password" data-testid="settings-password-current-input" placeholder={tr("Aktuelles Passwort")} value={v.current} onChange={set("current")} className={field} />
      <Input type="password" autoComplete="new-password" data-testid="settings-password-new-input" placeholder={tr("Neues Passwort")} value={v.next} onChange={set("next")} className={field} />
      <Input type="password" autoComplete="new-password" data-testid="settings-password-confirm-input" placeholder={tr("Passwort wiederholen")} value={v.confirm} onChange={set("confirm")} className={field} />
      <Button type="submit" disabled={busy} data-testid="settings-password-save-button" className="h-12 w-full font-bold">{busy ? tr("Wird gespeichert …") : tr("Passwort speichern")}</Button>
      <p className="text-[11px] text-muted-foreground">{tr("Aktuelles Passwort vergessen? Melde dich ab und nutze auf der Anmeldeseite „Passwort vergessen?“.")}</p>
    </form>
  );
}
