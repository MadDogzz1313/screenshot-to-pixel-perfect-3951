import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { App } from "@capacitor/app";
import {
  AtSign, BadgeInfo, Ban, BellRing, Camera, ChevronLeft, Eye, FileText, KeyRound, Lock, LogOut, Mail, MessageSquareText,
  Settings2, ShieldCheck, Smartphone, UserRound, UserRoundPen,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AvatarEditor } from "@/components/AvatarEditor";
import { UsernameField } from "@/components/UsernameField";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { OPERATOR } from "@/components/LegalPage";
import { PushSettings } from "@/components/social/PushSettings";
import { DeleteAccount } from "@/components/social/DeleteAccount";
import { EmailChangeForm, PasswordChangeForm } from "@/components/settings/AccountForms";
import { ButtonRow, ExpandRow, InfoRow, LinkRow, SettingsGroup, SettingsSection } from "@/components/settings/SettingsUi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useInvalidate } from "@/lib/social";
import { isNativeApp } from "@/lib/native";

import { tr, locale } from "@/lib/i18n";
declare const __LEONIDA_BUILD_ID__: string;

export const Route = createFileRoute("/einstellungen")({
  // ?open=benutzername öffnet direkt einen Bereich (z. B. aus dem Benutzernamen-Hinweis)
  validateSearch: (s: Record<string, unknown>): { open?: string } => (typeof s["open"] === "string" ? { open: s["open"] } : {}),
  head: () => ({ meta: [{ title: tr("Einstellungen · Leonida Explorer") }, { name: "robots", content: "noindex" }, { name: "description", content: tr("Konto, Benachrichtigungen, Privatsphäre und App-Einstellungen.") }] }),
  component: Settings,
});

const PRIVACY = [
  { k: "is_private", f: "isPrivate", l: tr("Privates Profil"), d: tr("Andere sehen nur deinen Namen und einen Standardavatar.") },
  { k: "show_avatar", f: "showAvatar", l: tr("Profilbild öffentlich"), d: tr("Ausgeschaltet sehen andere den Standardavatar.") },
  { k: "show_join_date", f: "showJoinDate", l: tr("Beitrittsdatum öffentlich"), d: tr("„Mitglied seit …“ für andere anzeigen.") },
  { k: "show_badges", f: "showBadges", l: tr("Abzeichen öffentlich"), d: tr("Deine Abzeichen für andere anzeigen.") },
  { k: "show_friends", f: "showFriends", l: tr("Freundesliste anzeigen"), d: tr("Ein = öffentlich (Liste + Anzahl), Aus = privat, nur du siehst sie.") },
] as const;

/** App-Version: in der iPhone-App Version + Build aus Xcode, im Browser der Web-Stand */
function useAppVersion() {
  return useQuery({
    queryKey: ["app-version"], staleTime: Infinity,
    queryFn: async () => {
      const web = new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(__LEONIDA_BUILD_ID__));
      if (!isNativeApp()) return { app: tr("Web-App"), web };
      const info = await App.getInfo();
      return { app: tr("Version {0} (Build {1})", info.version, info.build), web };
    },
  });
}

function BackButton() {
  return <Link to="/profil" aria-label={tr("Zurück zum Profil")} data-testid="settings-back-button"
    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-neon/60 bg-card/80 text-neon shadow-[0_0_14px_oklch(0.7_0.3_345/0.35)] backdrop-blur transition-transform duration-150 active:scale-90"><ChevronLeft className="h-6 w-6" /></Link>;
}

function Settings() {
  const { user, authReady, profiles, signOut, updateProfile, updateUsername } = useStore(); const nav = useNavigate();
  const { open: initial = "" } = Route.useSearch();
  const [open, setOpen] = useState(initial);
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const invalidate = useInvalidate();
  const version = useAppVersion();
  const me = profiles.find((p) => p.id === user?.id);
  const shell = (body: React.ReactNode) => <AppShell title={tr("Einstellungen")} headerLeft={<BackButton />}><div className="space-y-6 px-3 pb-6">{body}</div></AppShell>;

  const support = (delay: number) => (
    <SettingsSection icon={BadgeInfo} title={tr("Support & Informationen")} testId="settings-section-support" delay={delay}>
      <LinkRow icon={MessageSquareText} label={tr("Hilfe & Kontakt")} hint={OPERATOR.email} href={`mailto:${OPERATOR.email}?subject=${encodeURIComponent("Leonida Explorer – Support")}`} testId="settings-contact-link" />
      <LinkRow icon={ShieldCheck} label={tr("Datenschutzerklärung")} to="/datenschutz" testId="settings-privacy-policy-link" />
      <LinkRow icon={FileText} label={tr("Nutzungsbedingungen")} to="/nutzungsbedingungen" testId="settings-terms-link" />
      <InfoRow icon={Smartphone} label={tr("App-Version")} testId="settings-app-version"
        value={version.isPending ? "…" : version.data ? <><span className="block text-foreground">{version.data.app}</span><span className="block">{tr("Stand {0}", version.data.web)}</span></> : tr("Unbekannt")} />
    </SettingsSection>
  );
  const appPrefs = (delay: number) => (
    <SettingsSection icon={Settings2} title={tr("App")} testId="settings-section-app" delay={delay}>
      <LanguageSwitch className="space-y-3 p-4" />
    </SettingsSection>
  );

  if (!authReady) return shell(<p data-testid="settings-loading" className="neon-card p-4 text-sm text-muted-foreground">{tr("Wird geladen …")}</p>);
  if (!user || !me) return shell(<>
    <div data-testid="settings-guest" className="neon-card space-y-3 p-5 text-center"><p>{tr("Melde dich an, um Konto, Benachrichtigungen und Privatsphäre einzustellen.")}</p>
      <Link to="/" data-testid="settings-login-link" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">{tr("Anmelden / Registrieren")}</Link></div>
    {appPrefs(60)}{support(120)}
  </>);

  const save = async (fields: Record<string, unknown>, ok = tr("Gespeichert")) => { const err = await updateProfile(fields); if (err) toast.error(err); else toast.success(ok); return err; };
  const usernameValue = username ?? (user.needsUsername ? "" : user.username);
  const saveUsername = async () => { const err = await updateUsername(usernameValue); if (err) toast.error(err); else { setUsername(null); toast.success(tr("Benutzername gespeichert")); } };
  const logout = async () => { setLeaving(true); try { await signOut(); nav({ to: "/", replace: true }); } finally { setLeaving(false); } };

  return shell(<>
    <Link to="/profil" data-testid="settings-profile-card" className="neon-card flex items-center gap-3 p-3 animate-in fade-in duration-300 transition-transform active:scale-[0.99]">
      <img src={me.avatar} alt="" className="h-14 w-14 shrink-0 rounded-full border-2 border-neon object-cover shadow-[0_0_14px_oklch(0.7_0.3_345/0.5)]" />
      <span className="min-w-0 flex-1"><span data-testid="settings-profile-username" className="block truncate font-display text-lg italic">{user.needsUsername ? tr("Benutzername fehlt") : user.username}</span>
        <span data-testid="settings-profile-email" className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
    </Link>

    <SettingsGroup value={open} onChange={setOpen}>
      <div className="space-y-6">
        <SettingsSection icon={UserRound} title={tr("Konto & Profil")} testId="settings-section-account" delay={40}>
          <ExpandRow value="benutzername" icon={AtSign} label={tr("Benutzername")} hint={user.needsUsername ? tr("Noch nicht gewählt") : user.username} testId="settings-username-row">
            <p className="text-xs text-muted-foreground">{tr("Dein öffentlicher Name in Profilen, Chats, Freundeslisten und Fundorten.")}</p>
            <UsernameField value={usernameValue} onChange={setUsername} excludeId={user.id} inputTestId="profile-username-input" />
            <Button data-testid="profile-username-save-button" disabled={!usernameValue.trim()} onClick={() => void saveUsername()} className="h-12 w-full font-bold">{tr("Benutzernamen speichern")}</Button>
          </ExpandRow>
          <ExpandRow value="profilbild" icon={Camera} label={tr("Profilbild")} hint={me.avatarPath ? tr("Eigenes Bild") : tr("Standardbild")} testId="settings-avatar-row">
            <AvatarEditor userId={user.id} path={me.avatarPath} hasAvatar={!!me.avatarPath} onDone={() => invalidate("profiles")} />
          </ExpandRow>
          <ExpandRow value="bio" icon={UserRoundPen} label={tr("Biografie")} hint={me.bio || tr("Noch leer")} testId="settings-bio-row">
            <Textarea data-testid="profile-bio-input" value={bio ?? me.bio} maxLength={200} placeholder={tr("Über dich (max. 200 Zeichen)")} onChange={(e) => setBio(e.target.value)} className="min-h-24 text-base" />
            <p className="text-right text-[11px] text-muted-foreground">{(bio ?? me.bio).length} / 200</p>
            <Button data-testid="profile-bio-save-button" onClick={async () => { if (!(await save({ bio: (bio ?? me.bio).trim() }))) setBio(null); }} className="h-12 w-full font-bold">{tr("Bio speichern")}</Button>
          </ExpandRow>
          <ExpandRow value="email" icon={Mail} label={tr("E-Mail-Adresse")} hint={user.email} testId="settings-email-row">
            <EmailChangeForm current={user.email} />
          </ExpandRow>
          <ExpandRow value="passwort" icon={KeyRound} label={tr("Passwort ändern")} hint={tr("Aktuelles Passwort erforderlich")} testId="settings-password-row">
            <PasswordChangeForm />
          </ExpandRow>
          <DeleteAccount userId={user.id} />
        </SettingsSection>

        <SettingsSection icon={BellRing} title={tr("Benachrichtigungen")} testId="settings-section-notifications" delay={80}>
          <ExpandRow value="push" icon={BellRing} label={tr("Push-Mitteilungen")} hint={tr("Freunde, Chats, Postfach, Community")} testId="settings-push-row">
            <PushSettings embedded />
          </ExpandRow>
        </SettingsSection>

        <SettingsSection icon={Lock} title={tr("Privatsphäre & Sicherheit")} testId="settings-section-privacy" delay={120}>
          <ExpandRow value="sichtbarkeit" icon={Eye} label={tr("Profil-Sichtbarkeit")} hint={me.isPrivate ? tr("Privat") : tr("Öffentlich")} testId="settings-visibility-row">
            <div data-testid="profile-privacy" className="space-y-3">
              {PRIVACY.map(({ k, f, l, d }) => (
                <label key={k} className="flex items-center justify-between gap-3">
                  <span className="min-w-0"><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                  <Switch data-testid={`privacy-${k}`} checked={me[f]} onCheckedChange={(v) => save({ [k]: v })} />
                </label>))}
              <p className="text-[11px] text-muted-foreground">{tr("Deine E-Mail-Adresse und Spendeninformationen sind nie öffentlich.")}</p>
            </div>
          </ExpandRow>
          <LinkRow icon={Ban} label={tr("Blockierte Nutzer")} hint={tr("Blockierungen ansehen und aufheben")} to="/freunde" search={{ tab: "blockiert" }} testId="settings-blocked-link" />
          <ButtonRow icon={LogOut} label={leaving ? tr("Wird abgemeldet …") : tr("Abmelden")} hint={tr("Auf diesem Gerät abmelden")} onClick={() => void logout()} disabled={leaving} testId="profile-logout-button" />
        </SettingsSection>
      </div>
    </SettingsGroup>

    {appPrefs(160)}
    {support(200)}
  </>);
}
