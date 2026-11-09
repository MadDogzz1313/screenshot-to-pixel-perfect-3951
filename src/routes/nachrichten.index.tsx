import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { DEFAULT_AVATAR } from "@/lib/db";
import { SETUP_HINT, useConversations, useFriendState, timeAgo } from "@/lib/friends";

export const Route = createFileRoute("/nachrichten/")({
  head: () => ({ meta: [{ title: "Private Nachrichten · Leonida Explorer" }, { name: "robots", content: "noindex" }, { name: "description", content: "Deine privaten Chats mit Freunden." }] }),
  component: Inbox,
});

function Inbox() {
  const { user, authReady, profiles } = useStore();
  const convs = useConversations(!!user);
  const state = useFriendState(!!user);
  if (!authReady) return <AppShell title="Private Nachrichten">{null}</AppShell>;
  if (!user) return <AppShell title="Private Nachrichten"><div className="neon-card mx-3 p-5 text-center"><p className="font-semibold">Melde dich an, um privat mit Freunden zu schreiben.</p><Link to="/" data-testid="inbox-login-link" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Anmelden</Link></div></AppShell>;
  const profileOf = (id: string) => profiles.find((p) => p.id === id);
  const withChat = new Set((convs.data ?? []).map((c) => c.other_id));
  const newChats = (state.data?.friends ?? []).filter((f) => !withChat.has(f.id)).map((f) => profileOf(f.id)).filter((p) => !!p);
  return <AppShell title="Private Nachrichten">
    <div className="space-y-4 px-3">
      {convs.data === null && <p data-testid="inbox-setup-hint" className="neon-card p-4 text-sm text-muted-foreground">{SETUP_HINT}</p>}
      {convs.data && !convs.data.length && <p data-testid="inbox-empty" className="neon-card p-4 text-sm text-muted-foreground">Noch keine Unterhaltungen. Starte einen Chat mit einem Freund.</p>}
      <ul data-testid="inbox-list" className="space-y-2">{(convs.data ?? []).map((c) => {
        const p = profileOf(c.other_id);
        return <li key={c.other_id}><Link to="/nachrichten/$userId" params={{ userId: c.other_id }} data-testid={`inbox-conversation-${c.other_id}`} className={`neon-card flex items-center gap-3 p-3 transition-transform duration-150 active:scale-[0.99] ${c.unread ? "!border-neon" : ""}`}>
          <img src={p?.avatar ?? DEFAULT_AVATAR} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 border-neon object-cover" />
          <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{p?.username ?? "Spieler"}</span><span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.last_at)}</span></span>
            <span className={`block truncate text-xs ${c.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{c.last_from_me ? "Du: " : ""}{c.last_deleted ? "Nachricht gelöscht" : c.last_body}</span></span>
          {c.unread > 0 && <span data-testid="inbox-unread-badge" className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-[0_0_10px_var(--neon)]">{c.unread}</span>}
        </Link></li>;
      })}</ul>
      {!!newChats.length && <section className="space-y-2"><h2 className="px-1 text-xs font-bold tracking-[0.2em] text-muted-foreground">NEUEN CHAT STARTEN</h2>
        <div className="flex gap-3 overflow-x-auto pb-1">{newChats.map((p) => <Link key={p!.id} to="/nachrichten/$userId" params={{ userId: p!.id }} data-testid={`inbox-start-${p!.id}`} className="flex w-20 shrink-0 flex-col items-center gap-1 text-center">
          <span className="relative"><img src={p!.avatar} alt="" className="h-14 w-14 rounded-full border-2 border-neon object-cover" /><MessageCircle className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary p-0.5 text-primary-foreground" /></span>
          <span className="w-full truncate text-xs">{p!.username}</span></Link>)}</div></section>}
    </div>
  </AppShell>;
}
