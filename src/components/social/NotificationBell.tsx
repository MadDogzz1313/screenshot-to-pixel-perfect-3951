import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, MessageCircle, Megaphone, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { socialError, timeAgo, useFriendState, useMarkNotificationsRead, useNotifications, useSocialActions, type AppNotification } from "@/lib/friends";

const ICON = { friend_request: UserPlus, friend_accepted: Check, private_message: MessageCircle, community: Megaphone, admin: ShieldAlert } as const;

/** Glocke oben rechts im eigenen Profil. Zähler = ungelesene Benachrichtigungen (Realtime über useSocialRealtime). */
export function NotificationBell() {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const list = useNotifications(!!user);
  const items = list.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const markRead = useMarkNotificationsRead();
  // Beim Öffnen der Übersicht: die tatsächlich angezeigten ungelesenen Einträge merken ("Neu") und als gelesen speichern
  const seenNew = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!open || !list.data) return;
    const ids = list.data.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length) return;
    ids.forEach((id) => seenNew.current.add(id));
    markRead.mutate(ids);
  }, [open, list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  return <>
    <button type="button" aria-label={unread ? `${unread} ungelesene Benachrichtigungen` : "Benachrichtigungen"} data-testid="notification-bell-button" onClick={() => setOpen(true)}
      className="relative grid h-11 w-11 place-items-center rounded-full border border-neon/50 bg-card/80 text-neon shadow-[0_0_14px_oklch(0.7_0.3_345/0.35)] backdrop-blur transition-transform duration-150 active:scale-90">
      <Bell className="h-5 w-5" />
      {unread > 0 && <span data-testid="notification-bell-count" className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground shadow-[0_0_10px_var(--neon)]">{unread > 99 ? "99+" : unread}</span>}
    </button>
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) seenNew.current = new Set(); }}>
      <SheetContent side="right" data-testid="notification-panel" className="w-[92vw] max-w-md overflow-y-auto border-neon/40 bg-[#140c20]/95 pt-[max(env(safe-area-inset-top),1.5rem)] backdrop-blur-xl">
        <SheetHeader><SheetTitle className="font-display text-neon-gradient">Benachrichtigungen</SheetTitle><SheetDescription>Anfragen, Nachrichten und Mitteilungen</SheetDescription></SheetHeader>
        <div className="mt-4 space-y-2">
          {list.data === null && <p data-testid="notification-setup-hint" className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">Benachrichtigungen werden nach dem Datenbank-Update (SQL 008) aktiv.</p>}
          {list.data && !items.length && <p data-testid="notification-empty" className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">Keine Benachrichtigungen.</p>}
          {items.map((n) => <NotificationItem key={n.id} n={n} isNew={seenNew.current.has(n.id) || !n.read_at} onNavigate={() => setOpen(false)} />)}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}

function NotificationItem({ n, isNew, onNavigate }: { n: AppNotification; isNew: boolean; onNavigate: () => void }) {
  const { profiles, user } = useStore();
  const state = useFriendState(!!user);
  const actions = useSocialActions();
  const actor = useMemo(() => profiles.find((p) => p.id === n.actor_id), [profiles, n.actor_id]);
  const Icon = ICON[n.kind];
  const pending = n.kind === "friend_request" && state.data?.incoming.some((r) => r.id === n.ref_id);
  const respond = (accept: boolean) => actions.respond.mutate({ id: n.ref_id!, accept }, {
    onSuccess: () => toast.success(accept ? "Ihr seid jetzt Freunde" : "Anfrage abgelehnt"), onError: (e) => toast.error(socialError(e)) });
  const text = n.kind === "friend_request" ? "Möchte mit dir befreundet sein" : n.kind === "friend_accepted" ? "Hat deine Freundschaftsanfrage angenommen" : n.kind === "private_message" ? "Hat dir eine private Nachricht geschrieben" : n.body;
  const showActor = actor && ["friend_request", "friend_accepted", "private_message"].includes(n.kind);
  return <div data-testid={`notification-item-${n.id}`} className={`rounded-2xl border p-3 transition-colors duration-200 ${isNew ? "border-neon/60 bg-primary/10" : "border-border bg-card/70"}`}>
    <div className="flex items-start gap-3">
      {showActor ? <Link to="/u/$username" params={{ username: actor.username }} onClick={onNavigate} data-testid="notification-actor-link" className="shrink-0"><img src={actor.avatar} alt="" className="h-11 w-11 rounded-full border-2 border-neon object-cover" /></Link>
        : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-accent/50 bg-background/60 text-accent"><Icon className="h-5 w-5" /></span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm"><span data-testid="notification-title" className="font-semibold">{showActor ? actor.username : n.title}</span>{isNew && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEU</span>}</p>
        {text && <p data-testid="notification-text" className="text-xs text-muted-foreground">{text}</p>}
        <p data-testid="notification-time" className="mt-0.5 text-[11px] text-muted-foreground/80">{timeAgo(n.created_at)}</p>
        {n.kind === "friend_request" && (pending ? <div className="mt-2 flex gap-2">
          <button type="button" data-testid="notification-accept-button" disabled={actions.respond.isPending} onClick={() => respond(true)} className="min-h-9 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-[0_0_12px_var(--neon)] active:scale-95 disabled:opacity-50">Annehmen</button>
          <button type="button" data-testid="notification-decline-button" disabled={actions.respond.isPending} onClick={() => respond(false)} className="min-h-9 rounded-full border border-border px-4 text-xs font-semibold active:scale-95 disabled:opacity-50">Ablehnen</button>
        </div> : <p className="mt-1 text-[11px] text-muted-foreground">Anfrage beantwortet oder zurückgezogen</p>)}
        {n.kind === "private_message" && n.actor_id && <Link to="/nachrichten/$userId" params={{ userId: n.actor_id }} onClick={onNavigate} data-testid="notification-open-chat" className="mt-2 inline-block text-xs font-semibold text-neon">Chat öffnen ›</Link>}
      </div>
      {showActor && <Link to="/u/$username" params={{ username: actor.username }} onClick={onNavigate} aria-label="Profil öffnen" data-testid="notification-profile-link" className="text-xs text-muted-foreground">Profil ›</Link>}
    </div>
  </div>;
}
