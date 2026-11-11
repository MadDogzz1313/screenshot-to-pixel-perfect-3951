import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, Check, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FriendsSection } from "@/components/social/SocialProfile";
import { useStore } from "@/lib/store";
import { DEFAULT_AVATAR } from "@/lib/db";
import { SETUP_HINT, socialError, useFriendState, useSocialActions, timeAgo } from "@/lib/friends";

import { tr } from "@/lib/i18n";
type Tab = "freunde" | "anfragen" | "blockiert";
export const Route = createFileRoute("/freunde")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => { const t = s["tab"]; return t === "anfragen" || t === "blockiert" ? { tab: t } : {}; },
  head: () => ({ meta: [{ title: tr("Freunde · Leonida Explorer") }, { name: "robots", content: "noindex" }, { name: "description", content: tr("Freunde, Freundschaftsanfragen und Blockierliste.") }] }),
  component: Friends,
});

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [{ id: "freunde", label: tr("Freunde"), icon: Users }, { id: "anfragen", label: tr("Anfragen"), icon: UserPlus }, { id: "blockiert", label: tr("Blockiert"), icon: Ban }];

function Friends() {
  const { user, authReady, profiles } = useStore();
  const { tab = "freunde" } = Route.useSearch();
  const state = useFriendState(!!user);
  const actions = useSocialActions();
  if (!authReady) return <AppShell title={tr("Freunde")}>{null}</AppShell>;
  if (!user) return <AppShell title={tr("Freunde")}><div className="neon-card mx-3 p-5 text-center"><p className="font-semibold">{tr("Melde dich an, um Freunde hinzuzufügen.")}</p><Link to="/" data-testid="friends-login-link" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">{tr("Anmelden")}</Link></div></AppShell>;
  const p = (id: string) => profiles.find((x) => x.id === id) ?? { id, username: tr("Spieler"), avatar: DEFAULT_AVATAR };
  const done = (msg: string) => ({ onSuccess: () => toast.success(msg), onError: (e: Error) => toast.error(socialError(e)) });
  const incoming = state.data?.incoming ?? []; const outgoing = state.data?.outgoing ?? []; const blocked = state.data?.blocked ?? [];
  const row = "flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-2.5";
  const UserLink = ({ id, sub }: { id: string; sub?: string }) => { const u = p(id); return <Link to="/u/$username" params={{ username: u.username }} className="flex min-w-0 flex-1 items-center gap-3"><img src={u.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-neon object-cover" /><span className="min-w-0"><span className="block truncate font-semibold">{u.username}</span>{sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}</span></Link>; };
  return <AppShell title={tr("Freunde")}>
    <div className="space-y-4">
      <nav data-testid="friends-tabs" className="mx-3 grid grid-cols-3 gap-1 rounded-full border border-neon/30 bg-card/70 p-1">{TABS.map(({ id, label, icon: Icon }) =>
        <Link key={id} to="/freunde" search={id === "freunde" ? {} : { tab: id }} data-testid={`friends-tab-${id}`} className={`relative flex min-h-10 items-center justify-center gap-1.5 rounded-full text-xs font-bold transition-colors duration-150 ${tab === id ? "bg-primary text-primary-foreground shadow-[0_0_14px_var(--neon)]" : "text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />{label}{id === "anfragen" && incoming.length > 0 && <span data-testid="friends-incoming-count" className="grid h-5 min-w-5 place-items-center rounded-full bg-background px-1 text-[10px] text-neon">{incoming.length}</span>}</Link>)}</nav>
      {state.data === null && <p className="neon-card mx-3 p-4 text-sm text-muted-foreground">{SETUP_HINT}</p>}
      {tab === "freunde" && state.data !== null && <FriendsSection userId={user.id} own />}
      {tab === "anfragen" && state.data && <div className="space-y-4 px-3">
        <section data-testid="friends-incoming" className="neon-card space-y-2 p-4"><h3 className="font-display">{tr("Eingehende Anfragen")}</h3>
          {!incoming.length && <p className="text-sm text-muted-foreground">{tr("Keine offenen Anfragen.")}</p>}
          {incoming.map((r) => <div key={r.id} data-testid={`incoming-request-${r.id}`} className={row}><UserLink id={r.user_id} sub={tr("Möchte mit dir befreundet sein · {0}", timeAgo(r.created_at))} />
            <button type="button" aria-label={tr("Annehmen")} data-testid="incoming-accept-button" disabled={actions.respond.isPending} onClick={() => actions.respond.mutate({ id: r.id, accept: true }, done(tr("Ihr seid jetzt Freunde")))} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_12px_var(--neon)] active:scale-90"><Check className="h-4 w-4" /></button>
            <button type="button" aria-label={tr("Ablehnen")} data-testid="incoming-decline-button" disabled={actions.respond.isPending} onClick={() => actions.respond.mutate({ id: r.id, accept: false }, done(tr("Anfrage abgelehnt")))} className="grid h-10 w-10 place-items-center rounded-full border border-border active:scale-90"><X className="h-4 w-4" /></button></div>)}
        </section>
        <section data-testid="friends-outgoing" className="neon-card space-y-2 p-4"><h3 className="font-display">{tr("Gesendete Anfragen")}</h3>
          {!outgoing.length && <p className="text-sm text-muted-foreground">{tr("Keine gesendeten Anfragen.")}</p>}
          {outgoing.map((r) => <div key={r.id} data-testid={`outgoing-request-${r.id}`} className={row}><UserLink id={r.user_id} sub={tr("Gesendet {0}", timeAgo(r.created_at))} />
            <button type="button" data-testid="outgoing-cancel-button" disabled={actions.cancel.isPending} onClick={() => actions.cancel.mutate(r.id, done(tr("Anfrage zurückgezogen")))} className="min-h-9 rounded-full border border-border px-3 text-xs font-semibold active:scale-95">{tr("Zurückziehen")}</button></div>)}
        </section></div>}
      {tab === "blockiert" && state.data && <section data-testid="friends-blocked" className="neon-card mx-3 space-y-2 p-4"><h3 className="font-display">{tr("Blockierte Spieler")}</h3>
        <p className="text-xs text-muted-foreground">{tr("Nur du siehst diese Liste. Blockierte Spieler können dir keine Anfragen oder Nachrichten senden.")}</p>
        {!blocked.length && <p className="text-sm text-muted-foreground">{tr("Du hast niemanden blockiert.")}</p>}
        {blocked.map((id) => <div key={id} data-testid={`blocked-user-${id}`} className={row}><UserLink id={id} />
          <button type="button" data-testid="blocked-unblock-button" disabled={actions.unblock.isPending} onClick={() => actions.unblock.mutate(id, done(tr("Blockierung aufgehoben")))} className="min-h-9 rounded-full border border-border px-3 text-xs font-semibold active:scale-95">{tr("Aufheben")}</button></div>)}
      </section>}
    </div>
  </AppShell>;
}
