import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { LevelBadge } from "@/components/LevelBadge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community · Leonida Explorer" }, { name: "description", content: "Die aktivsten Entdecker von Leonida im Überblick." }, { property: "og:title", content: "Community · Leonida Explorer" }, { property: "og:description", content: "Die aktivsten Entdecker von Leonida im Überblick." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => {
    const { profiles } = useStore();
    return (
      <AppShell title="Community">
        <ol className="space-y-2 px-3">
          {[...profiles].sort((a, b) => b.xp - a.xp).map((p, i) => (
            <li key={p.username}><Link to="/u/$username" params={{ username: p.username }} className="neon-card flex items-center gap-3 p-3">
              <span className="w-6 text-center font-display text-accent">{i + 1}</span>
              <img src={p.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-neon" />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.username}</span>
              <span className="text-xs text-muted-foreground">{p.xp} XP</span><LevelBadge xp={p.xp} />
            </Link></li>))}
        </ol>
      </AppShell>
    );
  },
});
