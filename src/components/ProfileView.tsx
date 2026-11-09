import { Heart, MapPin } from "lucide-react";
import { LevelBadge } from "./LevelBadge";
import { SpotCard } from "./SpotCard";
import { levelProgress } from "@/lib/levels";
import type { Profile, Spot } from "@/lib/demo-data";

export function ProfileView({ profile, spots }: { profile: Profile; spots: Spot[] }) {
  const { pct, next } = levelProgress(profile.xp);
  const confirmed = spots.filter((s) => s.author === profile.username && s.status === "approved");
  return (
    <div className="space-y-4 px-3">
      <div className="neon-card flex flex-col items-center gap-2 p-5 text-center">
        <img src={profile.avatar} alt="" className="h-24 w-24 rounded-full border-4 border-neon object-cover" />
        <div className="flex items-center gap-2"><h2 className="font-display text-2xl">{profile.username}</h2><LevelBadge xp={profile.xp} size="lg" /></div>
        {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
        <div className="w-full">
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-sunset" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{profile.xp} / {next} XP</p>
        </div>
        <div className="flex gap-6 text-sm"><span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-neon" />{confirmed.length} Fundorte</span>
          <span className="flex items-center gap-1"><Heart className="h-4 w-4 text-neon" />{profile.likes} Likes</span></div>
      </div>
      <h3 className="font-display">Bestätigte Fundorte</h3>
      <div className="grid gap-2 sm:grid-cols-2">{confirmed.map((s) => <SpotCard key={s.id} spot={s} />)}</div>
      {!confirmed.length && <p className="text-sm text-muted-foreground">Noch keine bestätigten Fundorte.</p>}
    </div>
  );
}
