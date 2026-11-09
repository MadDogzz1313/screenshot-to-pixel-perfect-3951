import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import bg from "@/assets/bg-sunset.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Anmelden · Leonida Explorer" }, { name: "description", content: "Melde dich an und entdecke Fundorte auf der Leonida-Karte." }, { property: "og:title", content: "Anmelden · Leonida Explorer" }, { property: "og:description", content: "Melde dich an und entdecke Fundorte auf der Leonida-Karte." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Login,
});

const schema = z.object({ email: z.string().trim().email("Ungültige E-Mail").max(255), password: z.string().min(6, "Mindestens 6 Zeichen").max(72) });

function Login() {
  const { user, authReady, recovery, signIn, signUp, continueAsGuest, requestPasswordReset } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      const m = schema.shape.email.safeParse(email);
      if (!m.success) { toast.error(m.error.issues[0]?.message ?? "Ungültige E-Mail"); return; }
      setBusy(true); const res = await requestPasswordReset(m.data); setBusy(false);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Bitte schau in dein Postfach.", { duration: 9000 });
      setMode("login"); return;
    }
    const r = schema.safeParse({ email, password });
    if (!r.success) { toast.error(r.error.issues[0]?.message ?? "Ungültige Eingabe"); return; }
    setBusy(true);
    const res = mode === "login" ? await signIn(r.data.email, r.data.password) : await signUp(r.data.email, r.data.password);
    setBusy(false);
    if (res.error) { toast.error(res.error); return; }
    if (res.needsConfirm) {
      toast.success("Fast geschafft! Bitte bestätige deine E-Mail über den Link in deinem Postfach und melde dich dann an.", { duration: 8000 });
      setMode("login"); setPassword(""); return;
    }
    toast.success(mode === "login" ? "Willkommen zurück!" : "Konto erstellt!");
    nav({ to: "/karte" });
  };
  if (authReady && user) return <Navigate to={recovery ? "/passwort-neu" : "/karte"} replace />;
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-end px-5 pb-10">
      <img src={bg} alt="" className="fixed inset-0 -z-10 h-full w-full object-cover" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background/90" />
      <div className="mb-auto mt-[18vh] text-center">
        <h1 className="font-display text-5xl leading-none text-neon-gradient">LEONIDA<br />EXPLORER</h1>
        <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-foreground/90">COMMUNITY MAP</p>
      </div>
      <form onSubmit={submit} data-testid="auth-form" className="neon-card w-full max-w-sm space-y-3 p-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" data-testid={`auth-mode-${m}`} onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold ${mode === m || (mode === "forgot" && m === "login") ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>
        <Input type="email" autoComplete="email" data-testid="auth-email-input" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        {mode === "forgot" ? (
          <p data-testid="auth-forgot-info" className="text-sm text-muted-foreground">Gib deine E-Mail ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegen kannst.</p>
        ) : (
          <Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} data-testid="auth-password-input" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
        )}
        {mode === "login" && (
          <button type="button" data-testid="auth-forgot-link" onClick={() => setMode("forgot")} className="block w-full text-right text-xs font-semibold text-neon">Passwort vergessen?</button>
        )}
        <Button type="submit" disabled={busy} data-testid="auth-submit-button" className="h-12 w-full bg-sunset text-base font-bold">{mode === "login" ? "Anmelden" : mode === "register" ? "Konto erstellen" : "Link senden"}</Button>
        {mode === "forgot" && (
          <button type="button" data-testid="auth-forgot-back-button" onClick={() => setMode("login")} className="block w-full text-center text-xs font-semibold text-muted-foreground">Zurück zur Anmeldung</button>
        )}
        <Button type="button" variant="outline" data-testid="auth-guest-button" className="h-12 w-full" onClick={() => { continueAsGuest(); nav({ to: "/karte" }); }}>Ohne Anmeldung zur Karte</Button>
        <p className="text-center text-[11px] text-muted-foreground">{mode === "register" ? "Nach der Registrierung erhältst du eine E-Mail zur Bestätigung." : "Noch kein Konto? Tippe oben auf „Registrieren“."}</p>
      </form>
    </div>
  );
}
