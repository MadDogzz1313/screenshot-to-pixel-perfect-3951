import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GlobalChatRoom } from "@/components/chat/GlobalChatRoom";
import { Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/community/chat")({
  head: () => ({ meta: [{ title: tr("Community-Chat · Leonida Explorer") }, { name: "description", content: tr("Echtzeit-Chat für die Leonida-Explorer-Community.") }] }),
  component: CommunityChat,
});

function CommunityChat() {
  const { user, authReady } = useStore();
  if (!authReady) return <AppShell title={tr("Community-Chat")}><div data-testid="chat-loading" className="px-3 text-sm text-muted-foreground">{tr("Chat wird geladen …")}</div></AppShell>;
  if (!user) return <AppShell title={tr("Community-Chat")}><div data-testid="chat-auth-required" className="neon-card mx-3 space-y-3 p-5 text-center"><p className="font-semibold">{tr("Der Community-Chat ist nur für registrierte Nutzer.")}</p><p className="text-sm text-muted-foreground">{tr("Melde dich an, um Nachrichten zu lesen, zu schreiben und live dabei zu sein.")}</p><Link to="/" data-testid="chat-login-link" className="inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">{tr("Anmelden / Registrieren")}</Link></div></AppShell>;
  return <AppShell><GlobalChatRoom /></AppShell>;
}
