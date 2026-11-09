import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Ban, Bell, Flag, MapPin, MoreHorizontal, Paperclip, Send, Shield, Smile, Trash2, UserRound, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { categoryById } from "@/lib/demo-data";
import { chatErrorMessage, isChatUnavailable, useChatActions, useChatMessages, useChatPresence, useChatReports, useChatRestriction, type ChatMessage } from "@/lib/chat";

const EMOJIS = ["😀", "😂", "🔥", "👀", "🙌", "🌴", "🚗", "📍", "💡", "❤️"];
const time = (value: string) => new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const date = (value: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

function UserAvatar({ src, username }: { src?: string | undefined; username: string }) {
  return src ? <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-full border border-neon/70 object-cover shadow-[0_0_12px_oklch(0.7_0.3_345/0.28)]" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neon/70 bg-card text-neon"><UserRound className="h-5 w-5" aria-label={`${username} Profilbild`} /></span>;
}

function MessageMenu({ message, own, admin, onClose, onDelete, onReport, onBlock, onMute, onBan, onClearRestriction }: { message: ChatMessage; own: boolean; admin: boolean; onClose: () => void; onDelete: () => void; onReport: () => void; onBlock: () => void; onMute: () => void; onBan: () => void; onClearRestriction: () => void }) {
  return <div className={`absolute z-20 mt-1 w-48 rounded-2xl border border-neon/40 bg-[#160E22] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)] ${own ? "right-0" : "left-0"}`}>
    {own && <button type="button" data-testid="chat-message-delete-button" onClick={() => { onDelete(); onClose(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Trash2 className="h-4 w-4 text-neon" />Eigene Nachricht löschen</button>}
    {!own && <>
      <button type="button" data-testid="chat-message-report-button" onClick={() => { onReport(); onClose(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Flag className="h-4 w-4 text-accent" />Nachricht melden</button>
      <button type="button" data-testid="chat-user-block-button" onClick={() => { onBlock(); onClose(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Ban className="h-4 w-4 text-destructive" />Nutzer blockieren</button>
      {admin && <>
        <div className="my-1 border-t border-border" />
        <button type="button" data-testid="chat-admin-delete-button" onClick={() => { onDelete(); onClose(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Trash2 className="h-4 w-4 text-destructive" />Als Admin löschen</button>
        <button type="button" data-testid="chat-admin-mute-button" onClick={() => { onMute(); onClose(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><VolumeX className="h-4 w-4 text-accent" />15 Minuten stummschalten</button>
        <button type="button" data-testid="chat-admin-unrestrict-button" onClick={() => { onClearRestriction(); onClose(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-primary/15"><Shield className="h-4 w-4 text-success" />Chat-Sperre aufheben</button>
      </>}
    </>}
    <button type="button" aria-label="Menü schließen" data-testid="chat-message-menu-close-button" onClick={onClose} className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-border bg-background"><X className="h-3.5 w-3.5" /></button>
  </div>;
}

function SpotPreview({ spotId }: { spotId: string }) {
  const { spots } = useStore();
  const spot = spots.find((item) => item.id === spotId && item.status === "approved");
  if (!spot) return <span className="mt-2 block rounded-xl bg-black/20 px-3 py-2 text-xs text-muted-foreground">Fundort nicht mehr verfügbar</span>;
  const category = categoryById(spot.category);
  return <Link to="/fundort/$id" params={{ id: spot.id }} data-testid="spot-preview-card" className="mt-2 flex items-center gap-2 rounded-xl bg-black/25 p-2 text-left transition-transform duration-150 active:scale-[0.98]">
    <span className={`grid h-8 w-8 place-items-center rounded-lg ${category.color}`}><category.icon className="h-4 w-4" /></span>
    <span className="min-w-0"><span className="block truncate text-xs font-bold">{spot.title}</span><span className="block text-[11px] text-white/70">{category.label} · {spot.area}</span></span>
  </Link>;
}

function ModerationPanel({ reports, onClose, onReview }: { reports: ReturnType<typeof useChatReports>["data"]; onClose: () => void; onReview: (id: string, status: "reviewed" | "dismissed") => void }) {
  return <div className="absolute inset-x-3 top-16 z-30 rounded-3xl border border-accent/50 bg-[#160E22]/[.98] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl" data-testid="chat-moderation-panel">
    <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold">Meldungen</p><p className="text-xs text-muted-foreground">Nur Admins sehen diesen Bereich</p></div><button type="button" aria-label="Meldungen schließen" data-testid="chat-moderation-close-button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-border"><X className="h-4 w-4" /></button></div>
    {!reports?.length ? <p data-testid="chat-moderation-empty" className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">Keine offenen Meldungen.</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{reports.map((report) => <div key={report.id} data-testid={`chat-report-${report.id}`} className="rounded-2xl border border-border bg-card p-3"><p className="text-sm">{report.reason}</p><p className="mt-1 text-[11px] text-muted-foreground">{date(report.created_at)} · Meldung offen</p><div className="mt-2 flex gap-2"><button type="button" data-testid={`chat-report-review-${report.id}`} onClick={() => onReview(report.id, "reviewed")} className="rounded-full border border-neon/50 px-3 py-1.5 text-xs font-semibold text-neon">Bearbeitet</button><button type="button" data-testid={`chat-report-dismiss-${report.id}`} onClick={() => onReview(report.id, "dismissed")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Verwerfen</button></div></div>)}</div>}
  </div>;
}

export function GlobalChatRoom() {
  const { user, profiles, spots } = useStore();
  const nav = useNavigate();
  const presence = useChatPresence(user?.id, !!user);
  const messagesQuery = useChatMessages(!!user);
  const restrictionQuery = useChatRestriction(user?.id, !!user);
  const reportsQuery = useChatReports(!!user && !!user?.isAdmin);
  const actions = useChatActions();
  const [body, setBody] = useState(""); const [emojiOpen, setEmojiOpen] = useState(false); const [spotPickerOpen, setSpotPickerOpen] = useState(false); const [menuId, setMenuId] = useState<string | null>(null); const [reportMessage, setReportMessage] = useState<ChatMessage | null>(null); const [reportReason, setReportReason] = useState(""); const [moderationOpen, setModerationOpen] = useState(false); const [attachSpot, setAttachSpot] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null); const stickRef = useRef(true);
  const messages = messagesQuery.messages;
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const publicSpots = useMemo(() => spots.filter((spot) => spot.status === "approved").slice(0, 12), [spots]);
  const restriction = restrictionQuery.data;
  const restricted = restriction && (restriction.kind === "ban" || !restriction.until_at || new Date(restriction.until_at).getTime() > Date.now());

  // Layout: der Chat füllt exakt den sichtbaren Bereich (visualViewport) oberhalb der echten Navigationsleiste.
  // Bei geöffneter Tastatur liegt die Leiste hinter der Tastatur – dann sitzt das Eingabefeld direkt über der Tastatur.
  useEffect(() => {
    const root = document.documentElement; const viewport = window.visualViewport;
    const navEl = document.querySelector<HTMLElement>("[data-testid='app-bottom-nav']");
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const keyboardOpen = window.innerHeight - height > 120;
      root.style.setProperty("--chat-vh", `${height}px`);
      root.style.setProperty("--chat-top", `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty("--chat-nav-h", `${keyboardOpen ? 0 : navEl?.offsetHeight ?? 0}px`);
      if (stickRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    };
    update();
    const observer = navEl ? new ResizeObserver(update) : null; if (navEl) observer?.observe(navEl);
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update); window.addEventListener("resize", update);
    return () => { observer?.disconnect(); viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); window.removeEventListener("resize", update); ["--chat-vh", "--chat-top", "--chat-nav-h"].forEach((key) => root.style.removeProperty(key)); };
  }, []);
  useEffect(() => { if (stickRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length]);
  const lastDate = useRef<string>("");

  if (!user) return null;
  const schemaMissing = isChatUnavailable(messagesQuery.error as { code?: string } | null);
  const sendMessage = async () => {
    const clean = body.trim(); if (!clean || restricted || actions.send.isPending) return;
    try { await actions.send.mutateAsync({ body: clean, spotId: attachSpot }); setBody(""); setAttachSpot(null); setSpotPickerOpen(false); setEmojiOpen(false); } catch (error) { toast.error(chatErrorMessage(error as { code?: string; message?: string })); }
  };
  const run = async (promise: Promise<unknown>, success: string) => { try { await promise; toast.success(success); } catch (error) { toast.error(chatErrorMessage(error as { code?: string; message?: string })); } };

  return <div className="fixed inset-x-0 top-[var(--chat-top,0px)] z-30 mx-auto flex h-[var(--chat-vh,100dvh)] w-full max-w-3xl flex-col overflow-hidden px-3 pb-[calc(var(--chat-nav-h,0px)+0.5rem)]" data-testid="community-chat-room">
    <header className="relative flex shrink-0 items-center gap-3 border-b border-neon/25 px-1 pb-3 pt-[max(env(safe-area-inset-top),0.7rem)]"><button type="button" aria-label="Zur Community zurück" data-testid="chat-back-button" onClick={() => nav({ to: "/community" })} className="grid h-11 w-11 place-items-center rounded-full border border-neon/40 bg-card/80 active:scale-95"><ArrowLeft className="h-5 w-5" /></button><div className="min-w-0 flex-1"><h1 data-testid="chat-title" className="truncate font-display text-xl text-neon-gradient">Community-Chat</h1><p data-testid="chat-online-counter" className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${presence === null ? "bg-muted-foreground" : "bg-success shadow-[0_0_8px_var(--success)] animate-pulse"}`} />{presence === null ? "Verbinde …" : `${presence} online`}</p></div>{user.isAdmin && <button type="button" aria-label="Chatmeldungen öffnen" data-testid="chat-moderation-button" onClick={() => setModerationOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-full border border-accent/50 bg-card/80"><Shield className="h-5 w-5 text-accent" /></button>}<button type="button" aria-label="Chat-Info" data-testid="chat-info-button" onClick={() => toast.message("Bitte respektvoll, ohne persönliche Daten und ohne Spam schreiben.")} className="grid h-11 w-11 place-items-center rounded-full border border-neon/40 bg-card/80"><MoreHorizontal className="h-5 w-5" /></button>{moderationOpen && <ModerationPanel reports={reportsQuery.data} onClose={() => setModerationOpen(false)} onReview={(id, status) => void run(actions.review.mutateAsync({ reportId: id, status }), status === "reviewed" ? "Meldung bearbeitet" : "Meldung verworfen")} />}</header>
    {restriction?.kind === "mute" && restriction.until_at && new Date(restriction.until_at).getTime() > Date.now() && <div data-testid="chat-muted-banner" className="my-2 flex shrink-0 items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent"><VolumeX className="h-4 w-4" />Du bist bis {time(restriction.until_at)} stummgeschaltet.</div>}
    {schemaMissing ? <div data-testid="chat-setup-message" className="my-auto rounded-3xl border border-neon/30 bg-card/80 p-5 text-center shadow-[0_0_24px_oklch(0.7_0.3_345/0.15)]"><Bell className="mx-auto mb-3 h-8 w-8 text-neon" /><h2 className="font-display text-lg">Chat-Datenbank noch nicht verbunden</h2><p className="mt-2 text-sm text-muted-foreground">Die Oberfläche ist bereit. Für Nachrichten und Realtime muss die Migration <code className="text-neon">007_community_chat.sql</code> einmal in deiner Supabase-Datenbank ausgeführt werden.</p></div> : <>
      <div ref={listRef} data-testid="chat-message-list" onScroll={(event) => { const el = event.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4 pr-1 [scrollbar-width:thin]">
        {messagesQuery.hasNextPage && <button type="button" data-testid="chat-load-older-button" onClick={() => void messagesQuery.fetchNextPage()} className="mx-auto block rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">Ältere Nachrichten laden</button>}
        {!messages.length && !messagesQuery.isLoading && <p data-testid="chat-empty-state" className="py-14 text-center text-sm text-muted-foreground">Noch keine Nachrichten. Starte den Austausch.</p>}
        {messages.map((message) => {
          const profile = profileMap.get(message.author_id); const own = message.author_id === user.id; const messageDate = date(message.created_at); const showDate = messageDate !== lastDate.current; lastDate.current = messageDate;
          return <div key={message.id}>{showDate && <div data-testid="chat-date-divider" className="my-3 text-center text-[11px] font-semibold tracking-widest text-muted-foreground">{messageDate}</div>}<div className={`group flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}><Link to="/u/$username" params={{ username: profile?.username ?? "spieler" }} data-testid="chat-user-profile-link" className={own ? "order-2" : "order-1"}><UserAvatar src={profile?.avatar} username={profile?.username ?? "Spieler"} /></Link><div className={`relative max-w-[82%] ${own ? "order-1 items-end" : "order-2 items-start"}`}><div className={`mb-1 flex items-center gap-2 text-[11px] ${own ? "justify-end" : ""}`}><span data-testid="chat-message-username" className={`font-semibold ${own ? "text-neon" : "text-accent"}`}>{own ? "Du" : profile?.username ?? "Spieler"}</span><time data-testid="chat-message-timestamp" className="text-muted-foreground">{time(message.created_at)}</time></div><div className={`relative rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-[0_5px_18px_rgba(0,0,0,0.22)] ${own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-[#1C142A]"}`}><p data-testid={own ? "chat-message-bubble-own" : "chat-message-bubble-peer"} className="whitespace-pre-wrap break-words">{message.body}</p>{message.spot_id && <SpotPreview spotId={message.spot_id} />}</div><button type="button" aria-label="Nachrichtenaktionen" data-testid="chat-message-menu-button" onClick={() => setMenuId(menuId === message.id ? null : message.id)} className={`mt-1 grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-70 hover:bg-card ${own ? "ml-auto" : ""}`}><MoreHorizontal className="h-4 w-4" /></button>{menuId === message.id && <MessageMenu message={message} own={own} admin={user.isAdmin} onClose={() => setMenuId(null)} onDelete={() => void run(actions.remove.mutateAsync(message.id), "Nachricht gelöscht")} onReport={() => setReportMessage(message)} onBlock={() => void run(actions.block.mutateAsync(message.author_id), "Nutzer blockiert")} onMute={() => void run(actions.restriction.mutateAsync({ userId: message.author_id, kind: "mute", untilAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), reason: "Chatmoderation" }), "Nutzer stummgeschaltet")} onBan={() => void run(actions.restriction.mutateAsync({ userId: message.author_id, kind: "ban", reason: "Chatmoderation" }), "Nutzer gesperrt")} onClearRestriction={() => void run(actions.restriction.mutateAsync({ userId: message.author_id, kind: "clear" }), "Chat-Sperre aufgehoben")} />}</div></div></div>;
        })}
      </div>
      {reportMessage && <div data-testid="chat-report-form" className="mb-2 shrink-0 rounded-2xl border border-accent/40 bg-card p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Nachricht melden</p><button type="button" aria-label="Meldung schließen" data-testid="chat-report-close-button" onClick={() => setReportMessage(null)}><X className="h-4 w-4" /></button></div><textarea data-testid="chat-report-reason-input" value={reportReason} onChange={(event) => setReportReason(event.target.value.slice(0, 500))} placeholder="Was ist passiert?" maxLength={500} className="mt-2 min-h-16 w-full resize-none rounded-xl border border-border bg-background/60 p-2 text-sm outline-none focus:border-neon" /><button type="button" data-testid="chat-report-submit-button" disabled={reportReason.trim().length < 3 || actions.report.isPending} onClick={() => void run(actions.report.mutateAsync({ messageId: reportMessage.id, reason: reportReason.trim() }).then(() => { setReportMessage(null); setReportReason(""); }), "Meldung gesendet")} className="mt-2 min-h-10 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">Meldung senden</button></div>}
      {spotPickerOpen && <div data-testid="chat-spot-picker" className="mb-2 max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-neon/30 bg-card p-2">{publicSpots.length ? publicSpots.map((spot) => <button key={spot.id} type="button" data-testid={`chat-spot-option-${spot.id}`} onClick={() => { setAttachSpot(spot.id); setSpotPickerOpen(false); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-primary/15"><span className={`grid h-8 w-8 place-items-center rounded-lg ${categoryById(spot.category).color}`}><MapPin className="h-4 w-4" /></span><span className="min-w-0 truncate text-xs font-semibold">{spot.title}<span className="block truncate font-normal text-muted-foreground">{spot.area}</span></span></button>) : <p data-testid="chat-no-public-spots" className="p-2 text-xs text-muted-foreground">Noch keine freigegebenen Fundorte verfügbar.</p>}</div>}
      {attachSpot && <div data-testid="chat-attached-spot" className="mb-2 flex items-center justify-between rounded-2xl border border-neon/40 bg-primary/10 px-3 py-2 text-xs"><span>Fundort wird angehängt</span><button type="button" aria-label="Fundort entfernen" data-testid="chat-remove-spot-button" onClick={() => setAttachSpot(null)}><X className="h-4 w-4" /></button></div>}
      {emojiOpen && <div data-testid="chat-emoji-picker" className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-neon/30 bg-card p-2">{EMOJIS.map((emoji) => <button key={emoji} type="button" data-testid={`chat-emoji-${emoji}`} onClick={() => setBody((value) => `${value}${emoji}`)} className="grid h-10 w-10 place-items-center rounded-xl text-xl active:scale-90">{emoji}</button>)}</div>}
      <div data-testid="chat-input-bar" className="flex shrink-0 items-end gap-2 rounded-3xl border border-neon/35 bg-[#11091C]/95 p-2 shadow-[0_0_20px_rgba(255,46,147,0.12)] backdrop-blur-2xl"><button type="button" aria-label="Freigegebenen Fundort anhängen" data-testid="chat-attach-spot-button" onClick={() => setSpotPickerOpen((value) => !value)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${spotPickerOpen || attachSpot ? "border-neon bg-primary/20 text-neon" : "border-border"}`}><Paperclip className="h-5 w-5" /></button><textarea data-testid="chat-message-input" value={body} onChange={(event) => setBody(event.target.value.slice(0, 500))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={500} placeholder={restricted ? "Chat momentan gesperrt" : "Nachricht schreiben …"} disabled={!!restricted} className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-neon/45 bg-background/50 px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground focus:border-neon" /><button type="button" aria-label="Emoji auswählen" data-testid="chat-emoji-button" onClick={() => setEmojiOpen((value) => !value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border"><Smile className="h-5 w-5" /></button><button type="button" aria-label="Nachricht senden" data-testid="chat-send-button" disabled={!body.trim() || !!restricted || actions.send.isPending} onClick={() => void sendMessage()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_rgba(255,46,147,0.4)] transition-transform duration-150 active:scale-90 disabled:opacity-40"><Send className="h-5 w-5" /></button></div>
    </>}
  </div>;
}
