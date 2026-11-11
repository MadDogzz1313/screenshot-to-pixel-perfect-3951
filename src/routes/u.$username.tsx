import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { useStore } from "@/lib/store";
import { FriendsSection, ProfileSocialActions } from "@/components/social/SocialProfile";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `${params.username} · Leonida Explorer` }, { name: "description", content: tr("Öffentliches Profil von {0}.", params.username) }, { property: "og:title", content: `${params.username} · Leonida Explorer` }, { property: "og:description", content: tr("Öffentliches Profil von {0}.", params.username) }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" }] }),
  component: () => {
    const { username } = Route.useParams(); const { profiles, spots } = useStore();
    const p = profiles.find((x) => x.username.toLowerCase() === username.toLowerCase());
    return <AppShell title={tr("Profil")}>{p ? <div className="space-y-4"><ProfileSocialActions profile={p} /><ProfileView profile={p} spots={spots} /><FriendsSection userId={p.id} /></div> : <p className="px-3">{tr("Profil nicht gefunden.")}</p>}</AppShell>;
  },
});
