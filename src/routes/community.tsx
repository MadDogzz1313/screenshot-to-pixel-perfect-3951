import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { CircleHelp, FileText, Mail, MapPin, MessageCircle, Sparkles, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LevelBadge } from "@/components/LevelBadge";
import { useStore } from "@/lib/store";
import { useLeaderboard } from "@/lib/social";
import { useChatPresence } from "@/lib/chat";
import { useConversations, useFriendState } from "@/lib/friends";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community · Leonida Explorer" }, { name: "description", content: "Austausch, Tipps, Fundorte und Neuigkeiten der Leonida-Community." }, { property: "og:title", content: "Community · Leonida Explorer" }, { property: "og:description", content: "Austausch, Tipps, Fundorte und Neuigkeiten der Leonida-Community." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Community,
});

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
const TOPICS = [
  { to: "/community/chat" as const, test: "community-chat-card", icon: MessageCircle, title: "Community-Chat", subtitle: "Live mit der Community schreiben", tone: "text-neon", glow: "shadow-[0_0_22px_rgba(255,46,147,0.28)]" },
  { to: "/entdecken" as const, test: "community-topics-card", icon: FileText, title: "Beiträge", subtitle: "Entdeckungen, Theorien & News", tone: "text-accent", glow: "" },
  { to: "/karte" as const, test: "community-spots-card", icon: MapPin, title: "Fundorte diskutieren", subtitle: "Über bekannte und neue Orte sprechen", tone: "text-cat-place", glow: "" },
  { to: "/community/chat" as const, test: "community-help-card", icon: CircleHelp, title: "Hilfe & Support", subtitle: "Fragen stellen und Hilfe erhalten", tone: "text-cat-collect", glow: "" },
];

function Community() {
  const { profiles, user } = useStore();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/community/chat") return <Outlet />;
  return <CommunityHub profiles={profiles} user={user} />;
}

function CommunityHub({ profiles, user }: { profiles: ReturnType<typeof useStore>["profiles"]; user: ReturnType<typeof useStore>["user"] }) {
  const online = useChatPresence(user?.id, !!user);
  const friendState = useFriendState(!!user); const convs = useConversations(!!user);
  const incoming = friendState.data?.incoming.length ?? 0; const unreadDm = (convs.data ?? []).reduce((n, c) => n + Number(c.unread), 0);
  const now = new Date(); const months = [0, 1, 2].map((k) => { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; });
  const [tab, setTab] = useState<"xp" | "month">("xp"); const [month, setMonth] = useState(months[0]!);
  const board = useLeaderboard(month);
  const label = (iso: string) => new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00"));
  return (
    <AppShell>
      <div className="relative -mt-4 space-y-4 px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <header data-testid="community-header" className="relative overflow-hidden rounded-[2rem] border border-neon/30 bg-gradient-to-b from-primary/20 via-background/30 to-background/80 p-5 shadow-[0_0_28px_rgba(255,46,147,0.16)]">
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3"><div><p data-testid="community-kicker" className="text-[11px] font-bold tracking-[0.26em] text-neon">LEONIDA EXPLORER</p><h1 data-testid="community-title" className="mt-1 flex items-center gap-2 font-display text-3xl text-neon-gradient"><Users className="h-8 w-8 text-neon" />Community</h1><p data-testid="community-subtitle" className="mt-2 text-sm text-muted-foreground">Austausch · Tipps · Fundorte · News</p></div><Sparkles aria-hidden className="mt-2 h-8 w-8 text-accent drop-shadow-[0_0_9px_var(--accent)]" /></div>
          <div data-testid="community-online-summary" className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success"><span className={`h-2.5 w-2.5 rounded-full ${online === null ? "bg-muted-foreground" : "bg-success animate-pulse"}`} />{online === null ? user ? "Live-Status wird verbunden …" : "Für Online-Status anmelden" : `${online} gerade online`}</div>
        </header>

        <section data-testid="community-social-grid" className="space-y-2"><h2 className="px-1 text-xs font-bold tracking-[0.2em] text-muted-foreground">FREUNDE & NACHRICHTEN</h2><div className="grid grid-cols-3 gap-2">
          {[{ test: "community-friends-card", icon: Users, title: "Freunde", count: friendState.data?.friends.length, badge: 0, link: <Link to="/freunde" className="absolute inset-0" aria-label="Freunde" /> },
            { test: "community-requests-card", icon: UserPlus, title: "Anfragen", count: undefined, badge: incoming, link: <Link to="/freunde" search={{ tab: "anfragen" }} className="absolute inset-0" aria-label="Freundschaftsanfragen" /> },
            { test: "community-dm-card", icon: Mail, title: "Private Nachrichten", count: undefined, badge: unreadDm, link: <Link to="/nachrichten" className="absolute inset-0" aria-label="Private Nachrichten" /> }].map(({ test, icon: Icon, title, count, badge, link }) =>
            <div key={test} data-testid={test} className="relative flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-3xl border border-neon/30 bg-card/80 p-2 text-center backdrop-blur-xl transition-[transform,border-color] duration-200 active:scale-[0.97] hover:border-neon/70">
              <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-neon/40 bg-background/40 text-neon"><Icon className="h-6 w-6" />{badge > 0 && <span data-testid={`${test}-badge`} className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-[0_0_10px_var(--neon)]">{badge}</span>}</span>
              <span className="text-[11px] font-semibold leading-tight">{title}{count !== undefined && <span className="text-muted-foreground"> ({count})</span>}</span>{link}</div>)}
        </div></section>

        <section data-testid="community-topic-grid" className="space-y-2"><h2 data-testid="community-topics-heading" className="px-1 text-xs font-bold tracking-[0.2em] text-muted-foreground">COMMUNITY-BEREICHE</h2><div className="grid gap-3 sm:grid-cols-2">{TOPICS.map(({ to, test, icon: Icon, title, subtitle, tone, glow }) => <Link key={test} to={to} data-testid={test} className={`group relative flex min-h-[92px] items-center gap-4 overflow-hidden rounded-3xl border border-neon/25 bg-card/80 p-4 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-200 active:scale-[0.98] hover:-translate-y-0.5 hover:border-neon/70 ${glow}`}><span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-current/40 bg-background/40 ${tone}`}><Icon className="h-7 w-7" /></span><span className="min-w-0"><span data-testid={`${test}-title`} className="block font-display text-base">{title}</span><span data-testid={`${test}-subtitle`} className="mt-1 block text-xs text-muted-foreground">{subtitle}</span></span><span aria-hidden className="ml-auto text-2xl text-muted-foreground transition-transform duration-200 group-hover:translate-x-1">›</span></Link>)}</div></section>

        <section data-testid="community-rankings" className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 data-testid="community-rankings-heading" className="font-display text-xl">Ranglisten</h2><p data-testid="community-rankings-subtitle" className="text-xs text-muted-foreground">Die aktivsten Entdecker von Leonida</p></div><Link to="/community/chat" data-testid="community-rankings-chat-link" className="text-xs font-semibold text-neon">Chat öffnen</Link></div><div className="flex gap-2"><button type="button" data-testid="community-tab-xp" onClick={() => setTab("xp")} className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${tab === "xp" ? "border-neon bg-primary text-primary-foreground" : "border-border bg-card"}`}>Rangliste (XP)</button><button type="button" data-testid="community-tab-month" onClick={() => setTab("month")} className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${tab === "month" ? "border-neon bg-primary text-primary-foreground" : "border-border bg-card"}`}>Monatswertung</button></div>
          {tab === "xp" ? <ol data-testid="community-xp-list" className="space-y-2">{[...profiles].filter((p) => !p.restricted).sort((a, b) => b.xp - a.xp).map((p, i) => <li key={p.id}><Link to="/u/$username" params={{ username: p.username }} data-testid={`community-xp-user-${p.id}`} className="neon-card flex items-center gap-3 p-3 transition-transform duration-150 active:scale-[0.99]"><span className="w-6 text-center font-display text-accent">{i + 1}</span><img src={p.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-neon object-cover" /><span className="min-w-0 flex-1 truncate font-semibold">{p.username}</span><span className="text-xs text-muted-foreground">{p.xp} XP</span><LevelBadge xp={p.xp} /></Link></li>)}</ol> : <div data-testid="community-month-panel" className="space-y-3"><div className="flex gap-2 overflow-x-auto">{months.map((m) => <button key={m} type="button" data-testid={`community-month-${m}`} onClick={() => setMonth(m)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${m === month ? "border-neon bg-primary/30" : "border-border bg-card"}`}>{label(m)}</button>)}</div>{board.data === null && <p data-testid="community-month-unavailable" className="neon-card p-3 text-sm text-muted-foreground">Die Monatswertung startet nach dem Datenbank-Update.</p>}{board.data && <><p data-testid="community-month-period" className="text-xs text-muted-foreground">Zeitraum: {fmt(board.data[0]?.period_start ?? month)} – {board.data[0] ? fmt(board.data[0].period_end) : "Monatsende"} (deutsche Zeit) · {board.data[0]?.final ? "Endstand" : "Live-Stand"}.</p><ol data-testid="community-month-list" className="space-y-2">{board.data.map((r) => <li key={r.user_id} data-testid={`community-rank-${r.rank}`}><Link to="/u/$username" params={{ username: r.username }} className="neon-card flex items-center gap-3 p-3"><span className="w-6 text-center font-display text-accent">{r.rank}</span><span className="min-w-0 flex-1 truncate font-semibold">{r.username}</span><span className="text-xs text-muted-foreground">{r.approved_count} Fundorte</span></Link></li>)}</ol>{!board.data.length && <p data-testid="community-month-empty" className="text-sm text-muted-foreground">In diesem Monat wurden noch keine Fundorte freigegeben.</p>}</>}</div>}
        </section>
      </div>
    </AppShell>
  );
}
