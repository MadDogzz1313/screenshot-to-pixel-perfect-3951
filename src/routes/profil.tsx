import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: "Mein Profil · Leonida Explorer" }, { name: "description", content: "Dein Profil, Level und eingereichte Fundorte." }, { property: "og:title", content: "Mein Profil · Leonida Explorer" }, { property: "og:description", content: "Dein Profil, Level und eingereichte Fundorte." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Profil,
});

function Profil() {
  const { user, profiles, spots, signOut, updateProfile } = useStore(); const nav = useNavigate();
  const me = profiles.find((p) => p.username === user?.username);
  const [bio, setBio] = useState(me?.bio ?? "");
  if (!user || !me) return (
    <AppShell title="Profil"><div className="neon-card mx-3 space-y-3 p-5 text-center"><p>Du bist als Gast unterwegs.</p>
      <Link to="/" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Anmelden / Registrieren</Link></div></AppShell>);
  const pending = spots.filter((s) => s.author === me.username && s.status === "pending");
  return (
    <AppShell title="Mein Profil">
      <ProfileView profile={me} spots={spots} />
      <div className="mt-4 space-y-3 px-3">
        {!!pending.length && <p className="neon-card p-3 text-sm">{pending.length} Beitrag/Beiträge warten auf Freigabe.</p>}
        <div className="neon-card space-y-2 p-4"><p className="font-semibold">Bio bearbeiten</p>
          <Textarea value={bio} maxLength={200} onChange={(e) => setBio(e.target.value)} />
          <Button onClick={() => { updateProfile({ bio: bio.trim() }); toast.success("Gespeichert"); }} className="w-full">Speichern</Button></div>
        {user.isAdmin && <Link to="/admin" className="neon-card flex items-center gap-2 p-4 font-semibold"><Shield className="h-5 w-5 text-accent" />Admin-Bereich</Link>}
        <Button variant="outline" className="w-full" onClick={() => { signOut(); nav({ to: "/", replace: true }); }}>Abmelden</Button>
      </div>
    </AppShell>
  );
}
