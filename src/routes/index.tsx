import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  const { signIn, continueAsGuest } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({ email, password });
    if (!r.success) { toast.error(r.error.issues[0]?.message ?? "Ungültige Eingabe"); return; }
    signIn(r.data.email);
    toast.success(mode === "login" ? "Willkommen zurück!" : "Konto erstellt (Demo)");
    nav({ to: "/karte" });
  };
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-end px-5 pb-10">
      <img src={bg} alt="" className="fixed inset-0 -z-10 h-full w-full object-cover" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-background/90" />
      <div className="mb-auto mt-[18vh] text-center">
        <h1 className="font-display text-5xl leading-none text-neon-gradient">LEONIDA<br />EXPLORER</h1>
        <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-foreground/90">COMMUNITY MAP</p>
      </div>
      <form onSubmit={submit} className="neon-card w-full max-w-sm space-y-3 p-5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>
        <Input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        <Input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
        <Button type="submit" className="h-12 w-full bg-sunset text-base font-bold">{mode === "login" ? "Anmelden" : "Konto erstellen"}</Button>
        <Button type="button" variant="outline" className="h-12 w-full" onClick={() => { continueAsGuest(); nav({ to: "/karte" }); }}>Ohne Anmeldung zur Karte</Button>
        {mode === "register" && (
          <div className="rounded-xl border border-neon/30 bg-card/60 p-3">
            <p className="font-display text-[11px] tracking-[0.18em] text-neon">E-MAIL VON LEONIDA EXPLORER</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Nach dem Registrieren schicken wir dir eine Bestätigungs-E-Mail im Namen von <span className="font-semibold text-foreground">Leonida Explorer</span>.
              Derzeit kommt sie über den Standard-Absender von Lovable – ein Absender wie <span className="text-foreground">noreply@deine-domain.de</span> braucht deine eigene Domain.
            </p>
          </div>
        )}
        <p className="text-center text-[11px] text-muted-foreground">Demo: beliebige E-Mail. Mit „admin@…“ siehst du die Admin-Ansicht.</p>
      </form>
    </div>
  );
}
