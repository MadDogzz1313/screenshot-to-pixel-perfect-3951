import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flag, MoreHorizontal, Send, Smile, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ReportDialog } from "@/components/social/SocialProfile";
import { useStore } from "@/lib/store";
import { DEFAULT_AVATAR } from "@/lib/db";
import { useChatViewport } from "@/lib/useChatViewport";
import { relationTo, socialError, useDmActions, useDirectMessages, useFriendState, type PrivateMessage } from "@/lib/friends";

export const Route = createFileRoute("/nachrichten/$userId")({
  head: () => ({ meta: [{ title: "Privatchat · Leonida Explorer" }, { name: "robots", content: "noindex" }, { name: "description", content: "Private Nachrichten mit Freunden." }] }),
  component: DirectChat,
});

const EMOJIS = ["😀", "😂", "🔥", "👀", "🙌", "🌴", "🚗", "📍", "💡", "❤️", "😎", "🐊"];
const time = (v: string) => new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(v));
const day = (v: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));

function DirectChat() {
  const { userId } = Route.useParams();
  const { user, authReady } = useStore();
  if (!authReady) return <AppShell title="Privatchat"><p className="px-3 text-sm text-muted-foreground">Wird geladen …</p></AppShell>;
  if (!user) return <AppShell title="Privatchat"><div className="neon-card mx-3 p-5 text-center"><p className="font-semibold">Privatchats sind nur für angemeldete Spieler.</p><Link to="/" data-testid="dm-login-link" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Anmelden</Link></div></AppShell>;
  return <AppShell><DirectChatRoom me={user.id} other={userId} /></AppShell>;
}

function DirectChatRoom({ me, other }: { me: string; other: string }) {
  const { profiles } = useStore(); const nav = useNavigate();
  const partner = profiles.find((p) => p.id === other);
  const dm = useDirectMessages(me, other);
  const actions = useDmActions(other);
  const state = useFriendState(true);
  const rel = relationTo(state.data, other).rel;
  const [body, setBody] = useState(""); const [emoji, setEmoji] = useState(false); const [menuId, setMenuId] = useState<string | null>(null); const [reportId, setReportId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null); const stickRef = useRef(true);
  useChatViewport(listRef, stickRef);
  const messages = dm.messages;
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => { if (stickRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [lastId]);
  // Gespräch angesehen -> empfangene Nachrichten + zugehörige Glocken-Benachrichtigung als gelesen speichern
  const unreadIncoming = messages.some((m) => m.sender_id === other && !m.read_at);
  useEffect(() => { if (unreadIncoming) actions.markRead.mutate(); }, [unreadIncoming, lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canWrite = rel === "friends";
  const send = () => {
    const clean = body.trim(); if (!clean || !canWrite || actions.send.isPending) return;
    stickRef.current = true;
    actions.send.mutate(clean, { onSuccess: () => { setBody(""); setEmoji(false); }, onError: (e) => toast.error(socialError(e)) });
  };
  let lastDay = "";
  return <div className="fixed inset-x-0 top-[var(--chat-top,0px)] z-30 mx-auto flex h-[var(--chat-vh,100dvh)] w-full max-w-3xl flex-col overflow-hidden px-3 pb-[calc(var(--chat-nav-h,0px)+0.5rem)]" data-testid="dm-room">
    <header className="flex shrink-0 items-center gap-3 border-b border-neon/25 px-1 pb-3 pt-[max(env(safe-area-inset-top),0.7rem)]">
      <button type="button" aria-label="Zurück zu den Nachrichten" data-testid="dm-back-button" onClick={() => nav({ to: "/nachrichten" })} className="grid h-11 w-11 place-items-center rounded-full border border-neon/40 bg-card/80 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
      {partner ? <Link to="/u/$username" params={{ username: partner.username }} data-testid="dm-partner-link" className="flex min-w-0 flex-1 items-center gap-3"><img src={partner.avatar} alt="" className="h-11 w-11 rounded-full border-2 border-neon object-cover" />
        <span className="min-w-0"><span data-testid="dm-partner-name" className="block truncate font-display text-lg text-neon-gradient">{partner.username}</span><span className="block text-[11px] text-muted-foreground">{canWrite ? "Privatchat unter Freunden" : "Schreiben nur unter Freunden"}</span></span></Link>
        : <span className="flex-1 font-display">Privatchat</span>}
    </header>
    <div ref={listRef} data-testid="dm-message-list" onScroll={(e) => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4 pr-1">
      {dm.hasNextPage && <button type="button" data-testid="dm-load-older-button" onClick={() => { stickRef.current = false; void dm.fetchNextPage(); }} className="mx-auto block rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">Ältere Nachrichten laden</button>}
      {dm.isError && <p data-testid="dm-error" className="rounded-2xl bg-card p-3 text-center text-sm text-muted-foreground">{socialError(dm.error)}</p>}
      {!messages.length && dm.isSuccess && <p data-testid="dm-empty" className="py-14 text-center text-sm text-muted-foreground">Noch keine Nachrichten. Sag Hallo! 👋</p>}
      {messages.map((m: PrivateMessage) => {
        const own = m.sender_id === me; const d = day(m.created_at); const showDay = d !== lastDay; lastDay = d;
        return <div key={m.id}>{showDay && <div data-testid="dm-date-divider" className="my-3 text-center text-[11px] font-semibold tracking-widest text-muted-foreground">{d}</div>}
          <div className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
            {!own && <img src={partner?.avatar ?? DEFAULT_AVATAR} alt="" className="h-9 w-9 shrink-0 rounded-full border border-neon/70 object-cover" />}
            <div className={`relative max-w-[80%] ${own ? "items-end" : "items-start"}`}>
              <div className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-[0_5px_18px_rgba(0,0,0,0.22)] ${m.deleted_at ? "border border-dashed border-border bg-transparent italic text-muted-foreground" : own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-[#1C142A]"}`}>
                <p data-testid={own ? "dm-bubble-own" : "dm-bubble-peer"} className="whitespace-pre-wrap break-words">{m.deleted_at ? "Nachricht gelöscht" : m.body}</p>
              </div>
              <div className={`mt-1 flex items-center gap-2 text-[11px] text-muted-foreground ${own ? "justify-end" : ""}`}>
                <time data-testid="dm-timestamp">{time(m.created_at)}</time>{own && !m.deleted_at && <span data-testid="dm-read-state">{m.read_at ? "Gelesen" : "Gesendet"}</span>}
                {!m.deleted_at && <button type="button" aria-label="Nachrichtenaktionen" data-testid="dm-message-menu-button" onClick={() => setMenuId(menuId === m.id ? null : m.id)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-card"><MoreHorizontal className="h-4 w-4" /></button>}
              </div>
              {menuId === m.id && <div className={`absolute z-20 w-48 rounded-2xl border border-neon/40 bg-[#160E22] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)] ${own ? "right-0" : "left-0"}`}>
                {own ? <button type="button" data-testid="dm-delete-button" onClick={() => { setMenuId(null); actions.remove.mutate(m.id, { onSuccess: () => toast.success("Nachricht gelöscht"), onError: (e) => toast.error(socialError(e)) }); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Trash2 className="h-4 w-4 text-neon" />Nachricht löschen</button>
                  : <button type="button" data-testid="dm-report-button" onClick={() => { setMenuId(null); setReportId(m.id); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Flag className="h-4 w-4 text-accent" />Nachricht melden</button>}
              </div>}
            </div>
          </div></div>;
      })}
    </div>
    {!canWrite && state.data !== undefined && <p data-testid="dm-locked-note" className="mb-2 shrink-0 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">{rel === "blocked" ? "Du hast diesen Spieler blockiert – keine neuen Nachrichten möglich." : "Neue private Nachrichten sind nur zwischen bestätigten Freunden möglich. Der bisherige Verlauf bleibt erhalten."}</p>}
    {emoji && <div data-testid="dm-emoji-picker" className="mb-2 flex shrink-0 flex-wrap gap-1 rounded-2xl border border-neon/30 bg-card p-2">{EMOJIS.map((e) => <button key={e} type="button" data-testid={`dm-emoji-${e}`} onClick={() => setBody((v) => `${v}${e}`)} className="grid h-10 w-10 place-items-center rounded-xl text-xl active:scale-90">{e}</button>)}</div>}
    <div data-testid="dm-input-bar" className="flex shrink-0 items-end gap-2 rounded-3xl border border-neon/35 bg-[#11091C]/95 p-2 shadow-[0_0_20px_rgba(255,46,147,0.12)] backdrop-blur-2xl">
      <textarea data-testid="dm-message-input" value={body} onChange={(e) => setBody(e.target.value.slice(0, 1000))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} maxLength={1000} disabled={!canWrite}
        placeholder={canWrite ? "Private Nachricht …" : "Schreiben nicht möglich"} className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-neon/45 bg-background/50 px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus:border-neon disabled:opacity-60" />
      <button type="button" aria-label="Emoji auswählen" data-testid="dm-emoji-button" disabled={!canWrite} onClick={() => setEmoji((v) => !v)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border disabled:opacity-40"><Smile className="h-5 w-5" /></button>
      <button type="button" aria-label="Nachricht senden" data-testid="dm-send-button" disabled={!body.trim() || !canWrite || actions.send.isPending} onClick={send} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_rgba(255,46,147,0.4)] transition-transform duration-150 active:scale-90 disabled:opacity-40"><Send className="h-5 w-5" /></button>
    </div>
    {reportId && <ReportDialog open onOpenChange={(v) => { if (!v) setReportId(null); }} targetId={reportId} mode="message" username={partner?.username ?? "Spieler"} />}
  </div>;
}
