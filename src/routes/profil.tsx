import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Settings, Shield } from "lucide-react";
import { isNativeApp } from "@/lib/native";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { useStore } from "@/lib/store";
import { useInvalidate, useMyProgress } from "@/lib/social";
import { NotificationBell } from "@/components/social/NotificationBell";
import { FriendsSection } from "@/components/social/SocialProfile";
import { CoinBalance } from "@/components/arcade/CoinBalance";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: tr("Mein Profil · Leonida Explorer") }, { name: "description", content: tr("Dein Profil, Level, Abzeichen und eingereichte Fundorte.") }, { property: "og:title", content: tr("Mein Profil · Leonida Explorer") }, { property: "og:description", content: tr("Dein Profil, Level, Abzeichen und eingereichte Fundorte.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Profil,
});

function Profil() {
  const { user, authReady, profiles, spots, updateProfile } = useStore();
  const me = profiles.find((p) => p.id === user?.id);
  const progress = useMyProgress(!!user);
  const invalidate = useInvalidate();
  if (!authReady) return <AppShell title={tr("Profil")}>{null}</AppShell>;
  if (!user || !me) return (
    <AppShell title={tr("Profil")}><div className="neon-card mx-3 space-y-3 p-5 text-center"><p>{tr("Du bist als Gast unterwegs.")}</p>
      <Link to="/" data-testid="profile-login-link" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">{tr("Anmelden / Registrieren")}</Link></div>
      <Link to="/einstellungen" data-testid="profile-guest-settings-link" className="neon-card mx-3 mt-3 flex items-center gap-3 p-4 font-semibold transition-transform duration-150 active:scale-[0.99]"><Settings className="h-5 w-5 text-neon" /><span className="flex-1">{tr("Einstellungen")}</span><span className="text-xs font-normal text-muted-foreground">{tr("Sprache, Rechtliches, Version")}</span></Link></AppShell>);
  const pending = spots.filter((s) => s.author === me.username && s.status === "pending");
  return (
    <AppShell title={tr("Mein Profil")} headerRight={<NotificationBell />}>
      <ProfileView profile={me} spots={spots} own progress={progress.data} onFeature={(ids) => updateProfile({ featured_badges: ids }).then(async (e) => { await invalidate("badges"); return e; })} />
      <div className="px-3"><CoinBalance /></div>
      <div className="mt-4"><FriendsSection userId={user.id} own /></div>
      <div className="mt-4 space-y-3 px-3">
        {!!pending.length && <p className="neon-card p-3 text-sm">{tr("{0} Beitrag/Beiträge warten auf Freigabe.", pending.length)}</p>}
        {!isNativeApp() && <Link to="/spenden" data-testid="profile-donate-link" className="neon-card flex items-center gap-2 p-4 font-semibold"><Heart className="h-5 w-5 text-accent" />{tr("Leonida Explorer unterstützen")}</Link>}
        {user.isAdmin && <Link to="/admin" data-testid="profile-admin-link" className="neon-card flex items-center gap-2 p-4 font-semibold"><Shield className="h-5 w-5 text-accent" />{tr("Admin-Bereich")}</Link>}
      </div>
    </AppShell>
  );
}
