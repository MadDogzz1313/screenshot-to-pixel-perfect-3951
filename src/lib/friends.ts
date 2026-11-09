// Freunde, Privatchats, Benachrichtigungen, Meldungen, Blockieren und Kontosperren (SQL 008).
// Alle Schreibaktionen laufen über geprüfte Datenbank-Funktionen (RLS + security definer), nie direkt in Tabellen.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissing, sb } from "./db";

type DbError = { code?: string; message?: string } | null | undefined;
export interface FriendRequest { id: string; user_id: string; created_at: string }
export interface FriendState { friends: { id: string; since: string }[]; incoming: FriendRequest[]; outgoing: FriendRequest[]; blocked: string[] }
export interface FriendsOf { visible: boolean; count: number | null; friends: string[] }
export interface AppNotification { id: string; kind: "friend_request" | "friend_accepted" | "private_message" | "community" | "admin"; actor_id: string | null; ref_id: string | null; title: string; body: string | null; created_at: string; read_at: string | null }
export interface PrivateMessage { id: string; sender_id: string; receiver_id: string; body: string; created_at: string; read_at: string | null; deleted_at: string | null }
export interface Conversation { other_id: string; last_body: string; last_at: string; last_from_me: boolean; last_deleted: boolean; unread: number }
export interface AccountBan { until_at: string | null; permanent: boolean; reason: string | null; created_at: string }
export interface AdminUser { id: string; username: string; created_at: string; is_admin: boolean; is_private: boolean; banned: boolean; ban_until: string | null; ban_reason: string | null; open_reports: number; warnings: number }
export interface AdminReport { id: string; reporter_id: string; reporter_name: string; reported_user_id: string; reported_name: string; reason: ReportReason; details: string | null; message_excerpt: string | null; status: "open" | "in_review" | "resolved" | "dismissed"; admin_note: string | null; created_at: string; handled_at: string | null }
export interface ModerationEntry { id: string; actor_name: string | null; target_user_id: string | null; target_name: string | null; action: string; reason: string | null; metadata: Record<string, unknown>; created_at: string }

export const REPORT_REASONS = [
  { id: "harassment", label: "Beleidigung oder Belästigung" },
  { id: "spam", label: "Spam" },
  { id: "fraud", label: "Betrug oder Täuschung" },
  { id: "inappropriate", label: "Unangemessene Inhalte" },
  { id: "suspicious", label: "Verdächtiges Verhalten" },
  { id: "other", label: "Sonstiges" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
export const reasonLabel = (id: string) => REPORT_REASONS.find((r) => r.id === id)?.label ?? id;

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
};

/** Tabellen/Funktionen aus SQL 008 fehlen noch -> Bereich zeigt Hinweis statt Fehler */
export const SETUP_HINT = "Wird nach dem Datenbank-Update (SQL 008) aktiv.";
const MESSAGES: Record<string, string> = {
  FRIEND_SELF: "Du kannst dir nicht selbst eine Anfrage senden.",
  FRIEND_BLOCKED: "Zwischen euch besteht eine Blockierung.",
  FRIEND_ALREADY: "Ihr seid bereits Freunde.",
  FRIEND_ALREADY_REQUESTED: "Du hast bereits eine Anfrage gesendet.",
  FRIEND_REQUEST_NOT_FOUND: "Diese Anfrage gibt es nicht mehr.",
  FRIEND_REQUEST_CLOSED: "Diese Anfrage wurde bereits beantwortet.",
  PM_NOT_FRIENDS: "Privat schreiben könnt ihr nur als bestätigte Freunde.",
  PM_BLOCKED: "Zwischen euch besteht eine Blockierung.",
  PM_TOO_LONG: "Eine Nachricht darf höchstens 1000 Zeichen haben.",
  PM_NOT_FOUND: "Nachricht nicht gefunden.",
  REPORT_DUPLICATE: "Du hast das bereits gemeldet. Das Admin-Team prüft es.",
  REPORT_SELF: "Du kannst dich nicht selbst melden.",
  RATE_LIMIT: "Zu viele Aktionen in kurzer Zeit. Bitte warte kurz.",
  ACCOUNT_BANNED: "Dein Konto ist gesperrt.",
  ADMIN_ONLY: "Nur für Admins.",
  ADMIN_SELF: "Du kannst dich nicht selbst sperren oder verwarnen.",
  ADMIN_PROTECTED: "Admin-Konten sind geschützt.",
  REASON_REQUIRED: "Bitte gib einen Grund an (mind. 3 Zeichen).",
  BAN_INVALID_DATE: "Das Sperrende muss in der Zukunft liegen.",
  BAN_NOT_FOUND: "Für dieses Konto besteht keine Sperre.",
  BLOCK_SELF: "Du kannst dich nicht selbst blockieren.",
};
export function socialError(error: DbError): string {
  if (!error) return "Unbekannter Fehler";
  if (isMissing(error as { code?: string })) return SETUP_HINT;
  const key = Object.keys(MESSAGES).find((k) => error.message?.includes(k));
  return key ? MESSAGES[key]! : "Das hat nicht geklappt. Bitte versuche es erneut.";
}
/** RPC aufrufen und Fehler als Exception werfen */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
/** Abfrage, die vor SQL 008 "null" (= noch nicht eingerichtet) liefert */
async function rpcOrMissing<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) { if (isMissing(error)) return null; throw error; }
  return data as T;
}

const KEYS = { state: ["friend-state"], notifications: ["notifications"], conversations: ["conversations"], ban: ["my-ban"], friendsOf: ["friends-of"], dm: ["dm"] } as const;

// ---------- Realtime: ein Kanal pro angemeldetem Nutzer, hält Glocke, Anfragen und Chats aktuell ----------
export function useSocialRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const refresh = (...keys: (readonly string[])[]) => keys.forEach((k) => void qc.invalidateQueries({ queryKey: [...k] }));
    const channel = supabase.channel(`social-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => refresh(KEYS.notifications, KEYS.ban))
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `receiver_id=eq.${userId}` }, () => refresh(KEYS.state, KEYS.friendsOf))
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `sender_id=eq.${userId}` }, () => refresh(KEYS.state, KEYS.friendsOf))
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages", filter: `receiver_id=eq.${userId}` }, (p) => {
        const row = (p.new ?? p.old) as Partial<PrivateMessage>; refresh(KEYS.conversations); if (row.sender_id) void qc.invalidateQueries({ queryKey: [...KEYS.dm, row.sender_id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages", filter: `sender_id=eq.${userId}` }, (p) => {
        const row = (p.new ?? p.old) as Partial<PrivateMessage>; refresh(KEYS.conversations); if (row.receiver_id) void qc.invalidateQueries({ queryKey: [...KEYS.dm, row.receiver_id] });
      });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);
}

// ---------- Freunde ----------
export function useFriendState(enabled: boolean) {
  return useQuery({ queryKey: [...KEYS.state], enabled, refetchInterval: 60_000, queryFn: () => rpcOrMissing<FriendState>("my_friend_state") });
}
export function useFriendsOf(userId: string | undefined) {
  return useQuery({ queryKey: [...KEYS.friendsOf, userId], enabled: !!userId, queryFn: () => rpcOrMissing<FriendsOf>("friends_of", { _user: userId }) });
}
export type Relation = "none" | "friends" | "outgoing" | "incoming" | "blocked";
export function relationTo(state: FriendState | null | undefined, otherId: string): { rel: Relation; requestId?: string } {
  if (!state) return { rel: "none" };
  if (state.blocked.includes(otherId)) return { rel: "blocked" };
  if (state.friends.some((f) => f.id === otherId)) return { rel: "friends" };
  const out = state.outgoing.find((r) => r.user_id === otherId); if (out) return { rel: "outgoing", requestId: out.id };
  const inc = state.incoming.find((r) => r.user_id === otherId); if (inc) return { rel: "incoming", requestId: inc.id };
  return { rel: "none" };
}

export function useSocialActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([KEYS.state, KEYS.notifications, KEYS.friendsOf, KEYS.conversations, KEYS.ban].map((k) => qc.invalidateQueries({ queryKey: [...k] })));
  const useAction = <A,>(fn: (a: A) => Promise<unknown>) => useMutation({ mutationFn: fn, onSettled: refresh });
  return {
    sendRequest: useAction((to: string) => rpc<"sent" | "accepted">("send_friend_request", { _to: to })),
    respond: useAction(({ id, accept }: { id: string; accept: boolean }) => rpc("respond_friend_request", { _request_id: id, _accept: accept })),
    cancel: useAction((id: string) => rpc("cancel_friend_request", { _request_id: id })),
    removeFriend: useAction((other: string) => rpc("remove_friend", { _other: other })),
    block: useAction((other: string) => rpc("block_user", { _other: other })),
    unblock: useAction((other: string) => rpc("unblock_user", { _other: other })),
    reportUser: useAction(({ userId, reason, details }: { userId: string; reason: ReportReason; details: string }) => rpc("report_user", { _user: userId, _reason: reason, _details: details })),
    reportMessage: useAction(({ messageId, reason, details }: { messageId: string; reason: ReportReason; details: string }) => rpc("report_private_message", { _message_id: messageId, _reason: reason, _details: details })),
  };
}

// ---------- Benachrichtigungen ----------
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: [...KEYS.notifications], enabled,
    queryFn: async () => {
      const { data, error } = await sb.from("notifications").select("id, kind, actor_id, ref_id, title, body, created_at, read_at").order("created_at", { ascending: false }).limit(50);
      if (error) { if (isMissing(error)) return null; throw error; }
      return data as AppNotification[];
    },
  });
}
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids: string[]) => rpc("mark_notifications_read", { _ids: ids }), onSettled: () => qc.invalidateQueries({ queryKey: [...KEYS.notifications] }) });
}

// ---------- Private Nachrichten ----------
const PM_PAGE = 40;
export function useConversations(enabled: boolean) {
  return useQuery({ queryKey: [...KEYS.conversations], enabled, queryFn: () => rpcOrMissing<Conversation[]>("my_conversations") });
}
export function useDirectMessages(me: string | undefined, other: string) {
  const query = useInfiniteQuery({
    queryKey: [...KEYS.dm, other], enabled: !!me, initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = sb.from("private_messages").select("id, sender_id, receiver_id, body, created_at, read_at, deleted_at")
        .or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`)
        .order("created_at", { ascending: false }).limit(PM_PAGE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as PrivateMessage[]).reverse();
    },
    getNextPageParam: (last) => (last.length === PM_PAGE ? last[0]?.created_at : undefined),
  });
  const pages = query.data?.pages ?? [];
  return { ...query, messages: [...pages].reverse().flat() };
}
export function useDmActions(other: string) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([[...KEYS.dm, other], KEYS.conversations, KEYS.notifications, KEYS.ban].map((k) => qc.invalidateQueries({ queryKey: [...k] })));
  return {
    send: useMutation({ mutationFn: (body: string) => rpc<PrivateMessage>("send_private_message", { _to: other, _body: body }), onSettled: refresh }),
    remove: useMutation({ mutationFn: (id: string) => rpc("delete_private_message", { _message_id: id }), onSettled: refresh }),
    markRead: useMutation({ mutationFn: () => rpc("mark_conversation_read", { _other: other }), onSettled: () => Promise.all([KEYS.conversations, KEYS.notifications].map((k) => qc.invalidateQueries({ queryKey: [...k] }))) }),
  };
}

// ---------- Kontosperre ----------
export function useMyBan(userId: string | undefined) {
  return useQuery({
    queryKey: [...KEYS.ban, userId], enabled: !!userId, refetchInterval: 60_000, refetchOnWindowFocus: true,
    queryFn: async () => { const rows = await rpcOrMissing<AccountBan[]>("my_account_ban"); return rows?.[0] ?? null; },
  });
}
export const requestBanReview = (message: string) => rpc("request_ban_review", { _message: message });

// ---------- Admin ----------
export function useAdminUsers(q: string, enabled: boolean) {
  return useQuery({ queryKey: ["admin-users", q], enabled, queryFn: () => rpcOrMissing<AdminUser[]>("admin_search_users", { _q: q }) });
}
export function useAdminReports(status: "open" | "closed", enabled: boolean) {
  return useQuery({ queryKey: ["admin-reports", status], enabled, queryFn: () => rpcOrMissing<AdminReport[]>("admin_list_reports", { _status: status }) });
}
export function useModerationLog(enabled: boolean) {
  return useQuery({ queryKey: ["admin-log"], enabled, queryFn: () => rpcOrMissing<ModerationEntry[]>("admin_moderation_log", { _user: null }) });
}
export function useAdminActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all(["admin-users", "admin-reports", "admin-log"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  return {
    warn: useMutation({ mutationFn: ({ userId, reason }: { userId: string; reason: string }) => rpc("admin_warn_user", { _user: userId, _reason: reason }), onSettled: refresh }),
    ban: useMutation({ mutationFn: ({ userId, until, reason, visible }: { userId: string; until: string | null; reason: string; visible: boolean }) => rpc("admin_ban_user", { _user: userId, _until: until, _reason: reason, _reason_visible: visible }), onSettled: refresh }),
    unban: useMutation({ mutationFn: (userId: string) => rpc("admin_unban_user", { _user: userId, _reason: null }), onSettled: refresh }),
    updateReport: useMutation({ mutationFn: ({ id, status, note }: { id: string; status: "in_review" | "resolved" | "dismissed"; note: string }) => rpc("admin_update_report", { _report_id: id, _status: status, _note: note }), onSettled: refresh }),
    broadcast: useMutation({ mutationFn: ({ title, body }: { title: string; body: string }) => rpc<number>("admin_broadcast", { _title: title, _body: body }), onSettled: refresh }),
  };
}
