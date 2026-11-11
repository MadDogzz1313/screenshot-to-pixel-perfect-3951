import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, Lock, Shield } from "lucide-react";
import { isNativeApp } from "@/lib/native";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { AvatarEditor } from "@/components/AvatarEditor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useInvalidate, useMyProgress } from "@/lib/social";
import { NotificationBell } from "@/components/social/NotificationBell";
import { FriendsSection } from "@/components/social/SocialProfile";
import { PushSettings } from "@/components/social/PushSettings";
import { DeleteAccount } from "@/components/social/DeleteAccount";
import { UsernameField } from "@/components/UsernameField";
import { CoinBalance } from "@/components/arcade/CoinBalance";
import { LanguageSwitch } from "@/components/LanguageSwitch";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: tr("Mein Profil · Leonida Explorer") }, { name: "description", content: tr("Dein Profil, Level, Abzeichen und eingereichte Fundorte.") }, { property: "og:title", content: tr("Mein Profil · Leonida Explorer") }, { property: "og:description", content: tr("Dein Profil, Level, Abzeichen und eingereichte Fundorte.") }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Profil,
});

const PRIVACY = [
  { k: "is_private", f: "isPrivate", l: tr("Privates Profil"), d: tr("Andere sehen nur deinen Namen und einen Standardavatar.") },
  { k: "show_avatar", f: "showAvatar", l: tr("Profilbild öffentlich"), d: tr("Ausgeschaltet sehen andere den Standardavatar.") },
  { k: "show_join_date", f: "showJoinDate", l: tr("Beitrittsdatum öffentlich"), d: tr("„Mitglied seit …“ für andere anzeigen.") },
  { k: "show_badges", f: "showBadges", l: tr("Abzeichen öffentlich"), d: tr("Deine Abzeichen für andere anzeigen.") },
  { k: "show_friends", f: "showFriends", l: tr("Freundesliste anzeigen"), d: tr("Ein = öffentlich (Liste + Anzahl), Aus = privat, nur du siehst sie.") },
] as const;

function Profil() {
  const { user, authReady, profiles, spots, signOut, updateProfile, updateUsername } = useStore(); const nav = useNavigate();
  const me = profiles.find((p) => p.id === user?.id);
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const progress = useMyProgress(!!user);
  const invalidate = useInvalidate();
  if (!authReady) return <AppShell title={tr("Profil")}>{null}</AppShell>;
  if (!user || !me) return (
    <AppShell title={tr("Profil")}><div className="neon-card mx-3 space-y-3 p-5 text-center"><p>{tr("Du bist als Gast unterwegs.")}</p>
      <Link to="/" data-testid="profile-login-link" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">{tr("Anmelden / Registrieren")}</Link></div>
      <LanguageSwitch className="neon-card mx-3 mt-3 space-y-3 p-4" /></AppShell>);
  const pending = spots.filter((s) => s.author === me.username && s.status === "pending");
  const save = async (fields: Record<string, unknown>, ok = tr("Gespeichert")) => { const err = await updateProfile(fields); if (err) toast.error(err); else toast.success(ok); return err; };
  const usernameValue = username ?? (user?.needsUsername ? "" : user?.username ?? "");
  const saveUsername = async () => { const err = await updateUsername(usernameValue); if (err) toast.error(err); else { setUsername(null); toast.success(tr("Benutzername gespeichert")); } };
  return (
    <AppShell title={tr("Mein Profil")} headerRight={<NotificationBell />}>
      <ProfileView profile={me} spots={spots} own progress={progress.data} onFeature={(ids) => updateProfile({ featured_badges: ids }).then(async (e) => { await invalidate("badges"); return e; })} />
      <div className="px-3"><CoinBalance /></div>
      <div className="mt-4"><FriendsSection userId={user.id} own /></div>
      <div className="mt-4 space-y-3 px-3">
        {!!pending.length && <p className="neon-card p-3 text-sm">{tr("{0} Beitrag/Beiträge warten auf Freigabe.", pending.length)}</p>}
        <section data-testid="profile-edit" className="neon-card space-y-3 p-4">
          <p className="font-display">{tr("Profil bearbeiten")}</p>
          <section data-testid="profile-username-settings" className="space-y-2 rounded-2xl border border-neon/30 bg-background/30 p-3">
            <div><p className="font-semibold">{tr("Benutzername")}</p><p className="text-xs text-muted-foreground">{tr("Dein öffentlicher Name in Profilen, Chats, Freundeslisten und Fundorten.")}</p></div>
            <UsernameField value={usernameValue} onChange={setUsername} excludeId={user.id} inputTestId="profile-username-input" />
            <Button data-testid="profile-username-save-button" disabled={!usernameValue.trim()} onClick={() => void saveUsername()} className="w-full">{tr("Benutzernamen speichern")}</Button>
          </section>
          <AvatarEditor userId={user.id} path={me.avatarPath} hasAvatar={!!me.avatarPath} onDone={() => invalidate("profiles")} />
          <Textarea data-testid="profile-bio-input" value={bio ?? me.bio} maxLength={200} placeholder={tr("Über dich (max. 200 Zeichen)")} onChange={(e) => setBio(e.target.value)} />
          <Button data-testid="profile-bio-save-button" onClick={async () => { if (!(await save({ bio: (bio ?? me.bio).trim() }))) setBio(null); }} className="w-full">{tr("Bio speichern")}</Button>
          <div data-testid="profile-privacy" className="space-y-3 border-t border-border pt-3">
            <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-neon" />{tr("Privatsphäre")}</p>
            {PRIVACY.map(({ k, f, l, d }) => (
              <label key={k} className="flex items-center justify-between gap-3">
                <span className="min-w-0"><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                <Switch data-testid={`privacy-${k}`} checked={me[f]} onCheckedChange={(v) => save({ [k]: v })} />
              </label>))}
            <p className="text-[11px] text-muted-foreground">{tr("Deine E-Mail-Adresse und Spendeninformationen sind nie öffentlich.")}</p>
          </div>
          <PushSettings />
          <LanguageSwitch />
          <Link to="/datenschutz" data-testid="profile-privacy-settings-link" className="block border-t border-border pt-3 text-center text-xs font-semibold text-neon underline">{tr("Datenschutzerklärung")}</Link>
        </section>
        {!isNativeApp() && <Link to="/spenden" data-testid="profile-donate-link" className="neon-card flex items-center gap-2 p-4 font-semibold"><Heart className="h-5 w-5 text-accent" />{tr("Leonida Explorer unterstützen")}</Link>}
        {user.isAdmin && <Link to="/admin" data-testid="profile-admin-link" className="neon-card flex items-center gap-2 p-4 font-semibold"><Shield className="h-5 w-5 text-accent" />{tr("Admin-Bereich")}</Link>}
        <Button variant="outline" data-testid="profile-logout-button" className="w-full" onClick={async () => { await signOut(); nav({ to: "/", replace: true }); }}>{tr("Abmelden")}</Button>
        <DeleteAccount userId={user.id} />
        <p className="text-center text-[11px] text-muted-foreground"><Link to="/nutzungsbedingungen" data-testid="profile-terms-link" className="underline">{tr("Nutzungsbedingungen")}</Link></p>
      </div>
    </AppShell>
  );
}
