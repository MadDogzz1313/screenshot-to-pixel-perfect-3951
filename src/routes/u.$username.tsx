import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `${params.username} · Leonida Explorer` }, { name: "description", content: `Öffentliches Profil von ${params.username}.` }, { property: "og:title", content: `${params.username} · Leonida Explorer` }, { property: "og:description", content: `Öffentliches Profil von ${params.username}.` }, { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" }] }),
  component: () => {
    const { username } = Route.useParams(); const { profiles, spots } = useStore();
    const p = profiles.find((x) => x.username === username);
    return <AppShell title="Profil">{p ? <ProfileView profile={p} spots={spots} /> : <p className="px-3">Profil nicht gefunden.</p>}</AppShell>;
  },
});
