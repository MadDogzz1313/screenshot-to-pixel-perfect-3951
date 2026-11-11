import { Link } from "@tanstack/react-router";
import { Award, CalendarDays, Heart, Lock, MapPin } from "lucide-react";
import { LevelBadge } from "./LevelBadge";
import { SpotCard } from "./SpotCard";
import { BadgeGallery, featuredDefs } from "./BadgeGallery";
import { levelFromXp, levelProgress, toRoman } from "@/lib/levels";
import { badgeImg, type Progress } from "@/lib/badges";
import { useUserBadges } from "@/lib/social";
import type { Profile, Spot } from "@/lib/demo-data";
import banner from "@/assets/bg-sunset.jpg";

import { tr, locale } from "@/lib/i18n";
const monthYear = (iso: string) => new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(iso));

export function ProfileView({ profile, spots, own, progress, onFeature }: {
  profile: Profile; spots: Spot[]; own?: boolean; progress?: Progress | undefined; onFeature?: ((ids: string[]) => Promise<string | null>) | undefined;
}) {
  const badges = useUserBadges(profile.id);
  const unlocked = badges.data?.ids ?? [];
  if (profile.restricted) return (
    <div className="space-y-4 px-3">
      <div className="neon-card flex flex-col items-center gap-3 p-6 text-center">
        <img src={profile.avatar} alt="" className="h-24 w-24 rounded-full border-4 border-neon object-cover" />
        <h2 data-testid="profile-username" className="font-display text-2xl">{profile.username}</h2>
        <p data-testid="profile-private-note" className="flex items-center gap-1 text-sm text-muted-foreground"><Lock className="h-4 w-4" />{tr("Dieses Profil ist privat.")}</p>
      </div>
    </div>);
  const { pct, next } = levelProgress(profile.xp);
  const confirmed = spots.filter((s) => s.author === profile.username && s.status === "approved");
  const likes = confirmed.reduce((n, s) => n + s.likes, 0);
  const featured = featuredDefs(profile.featured).filter((b) => unlocked.includes(b.id));
  const showBadges = own || profile.featured !== null;
  return (
    <div className="space-y-4 px-3">
      <div className="neon-card overflow-hidden !p-0">
        <div className="relative h-28"><img src={banner} alt="" className="h-full w-full object-cover object-[50%_70%]" /><div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" /></div>
        <div className="relative z-10 -mt-14 flex items-end gap-3 px-4">
          <img data-testid="profile-avatar" src={profile.avatar} alt="" className="h-28 w-28 shrink-0 rounded-full border-4 border-neon object-cover shadow-[0_0_24px_oklch(0.7_0.3_345/0.6)]" />
          <div className="min-w-0 pb-1">
            <h2 data-testid="profile-username" className="truncate font-display text-2xl italic">{profile.username}</h2>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-neon/70 px-3 py-0.5 text-xs font-bold">LEVEL {toRoman(levelFromXp(profile.xp))}</span>
          </div>
        </div>
        <div className="space-y-2 p-4">
          {profile.bio && <p data-testid="profile-bio" className="text-sm">{profile.bio}</p>}
          {profile.joinedAt && <p data-testid="profile-joined" className="flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />{tr("Mitglied seit")}{" "}{monthYear(profile.joinedAt)}</p>}
          <div className="flex justify-between text-xs"><span data-testid="profile-xp">{profile.xp.toLocaleString(locale())} / {next.toLocaleString(locale())} XP</span><LevelBadge xp={profile.xp} /></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-sunset shadow-[0_0_10px_var(--neon)]" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[{ i: MapPin, n: confirmed.length, l: tr("Fundorte"), s: tr("(bestätigt)"), t: "spots" }, { i: Heart, n: likes, l: "Likes", s: tr("(öffentlich)"), t: "likes" },
          { i: Award, n: showBadges ? unlocked.length : "–", l: tr("Abzeichen"), s: showBadges ? "(freigeschaltet)" : "(verborgen)", t: "badges" }].map(({ i: I, n, l, s, t }) => (
          <div key={l} data-testid={`profile-stat-${t}`} className="neon-card flex flex-col items-center p-3"><I className="h-5 w-5 text-neon" /><span className="font-display text-2xl">{n}</span><span className="text-xs">{l}</span><span className="text-[10px] text-muted-foreground">{s}</span></div>))}
      </div>
      {showBadges && (
        <section className="neon-card space-y-3 p-4">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-display"><Award className="h-5 w-5 text-neon" />{tr("Abzeichen")}</h3>
            <span data-testid="profile-badge-count" className="text-xs text-muted-foreground">{tr("{0} / 18 freigeschaltet", unlocked.length)}</span></div>
          {featured.length > 0 && <div data-testid="profile-featured" className="flex justify-center gap-3">{featured.map((b) => <img key={b.id} src={badgeImg(b.id)} alt={b.name} className="h-20 object-contain drop-shadow-[0_0_10px_oklch(0.7_0.3_345/0.5)]" />)}</div>}
          {badges.data && !badges.data.ready && <p className="text-xs text-muted-foreground">{tr("Abzeichen werden nach dem Datenbank-Update freigeschaltet.")}</p>}
          {own ? <BadgeGallery unlocked={unlocked} progress={progress} featured={profile.featured} onFeature={onFeature} />
            : <BadgeGallery unlocked={unlocked} />}
        </section>)}
      <h3 className="flex items-center gap-2 font-display"><MapPin className="h-5 w-5 text-neon" />{tr("Bestätigte Fundorte (")}{confirmed.length})</h3>
      <div className="grid gap-2 sm:grid-cols-2">{confirmed.map((s) => <SpotCard key={s.id} spot={s} />)}</div>
      {!confirmed.length && <p className="text-sm text-muted-foreground">{tr("Noch keine bestätigten Fundorte.")}{" "}<Link to="/beitrag" className="text-neon">{tr("Jetzt einen vorschlagen")}</Link></p>}
    </div>
  );
}
