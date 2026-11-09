import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissing, sb } from "./db";

export interface ChatMessage {
  id: string;
  author_id: string;
  body: string;
  spot_id: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface ChatReport {
  id: string;
  message_id: string | null;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  review_note: string | null;
  created_at: string;
}

export interface ChatRestriction { kind: "mute" | "ban"; until_at: string | null; reason: string | null }
const PAGE_SIZE = 40;
export const CHAT_QUERY_KEY = ["chat-messages"] as const;

export const isChatUnavailable = (error: { code?: string } | null | undefined) =>
  !!error && (isMissing(error) || error.code === "PGRST116" || error.code === "42501");

export function chatErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return null;
  const message = error.message ?? "";
  if (message.includes("CHAT_RATE_LIMIT")) return "Zu viele Nachrichten. Bitte warte kurz.";
  if (message.includes("CHAT_MUTED")) return "Du bist momentan stummgeschaltet.";
  if (message.includes("CHAT_BANNED")) return "Du bist für den Chat gesperrt.";
  if (message.includes("CHAT_MESSAGE_TOO_LONG")) return "Eine Nachricht darf höchstens 500 Zeichen enthalten.";
  if (isChatUnavailable(error)) return "Der Chat ist noch nicht mit der Datenbank verbunden.";
  return "Die Chat-Aktion konnte nicht ausgeführt werden.";
}

export function useChatPresence(userId: string | undefined, enabled = true) {
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || !userId) { setOnline(null); return; }
    const channel = supabase.channel("community-global-chat", { config: { presence: { key: userId } } });
    const sync = () => setOnline(Object.keys(channel.presenceState()).length);
    channel.on("presence", { event: "sync" }, sync).on("presence", { event: "join" }, sync).on("presence", { event: "leave" }, sync);
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
        sync();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setOnline(null);
    });
    return () => { void supabase.removeChannel(channel); setOnline(null); };
  }, [enabled, userId]);
  return online;
}

export function useChatMessages(enabled: boolean) {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: CHAT_QUERY_KEY,
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let request = sb.from("chat_messages").select("id, author_id, body, spot_id, created_at, deleted_at, deleted_by").order("created_at", { ascending: false }).limit(PAGE_SIZE);
      if (pageParam) request = request.lt("created_at", pageParam);
      const { data, error } = await request;
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).reverse();
    },
    getNextPageParam: (lastPage) => lastPage.length === PAGE_SIZE ? lastPage[0]?.created_at : undefined,
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel("community-chat-messages");
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
      const message = payload.new as ChatMessage;
      qc.setQueryData(CHAT_QUERY_KEY, (current: { pages: ChatMessage[][]; pageParams: (string | null | undefined)[] } | undefined) => {
        if (!current || current.pages.some((page) => page.some((item) => item.id === message.id))) return current;
        const pages = current.pages.map((page, index) => index === current.pages.length - 1 ? [...page, message] : page);
        return { ...current, pages };
      });
    }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
      const message = payload.new as ChatMessage;
      qc.setQueryData(CHAT_QUERY_KEY, (current: { pages: ChatMessage[][]; pageParams: (string | null | undefined)[] } | undefined) => current ? { ...current, pages: current.pages.map((page) => page.map((item) => item.id === message.id ? { ...item, ...message } : item)) } : current);
    });
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled, qc]);

  return { ...query, messages: query.data?.pages.flat() ?? [] };
}

export function useChatActions() {
  const qc = useQueryClient();
  const refresh = () => { void qc.invalidateQueries({ queryKey: CHAT_QUERY_KEY }); void qc.invalidateQueries({ queryKey: ["chat-reports"] }); void qc.invalidateQueries({ queryKey: ["chat-restriction"] }); };
  const send = useMutation({ mutationFn: async ({ body, spotId }: { body: string; spotId?: string | null }) => {
    const { data, error } = await sb.rpc("send_chat_message", { _body: body, _spot_id: spotId ?? null });
    if (error) throw error;
    return data as ChatMessage;
  }, onSuccess: refresh });
  const remove = useMutation({ mutationFn: async (messageId: string) => { const { error } = await sb.rpc("delete_chat_message", { _message_id: messageId }); if (error) throw error; }, onSuccess: refresh });
  const report = useMutation({ mutationFn: async ({ messageId, reason }: { messageId: string; reason: string }) => { const { error } = await sb.rpc("report_chat_message", { _message_id: messageId, _reason: reason }); if (error) throw error; }, onSuccess: refresh });
  const block = useMutation({ mutationFn: async (userId: string) => { const { error } = await sb.rpc("block_chat_user", { _blocked_id: userId }); if (error) throw error; }, onSuccess: refresh });
  const restriction = useMutation({ mutationFn: async (input: { userId: string; kind: "mute" | "ban" | "clear"; untilAt?: string | null; reason?: string | null }) => { const { error } = await sb.rpc("admin_set_chat_restriction", { _user_id: input.userId, _kind: input.kind, _until_at: input.untilAt ?? null, _reason: input.reason ?? null }); if (error) throw error; }, onSuccess: refresh });
  const review = useMutation({ mutationFn: async (input: { reportId: string; status: "reviewed" | "dismissed"; note?: string }) => { const { error } = await sb.rpc("review_chat_report", { _report_id: input.reportId, _status: input.status, _note: input.note ?? null }); if (error) throw error; }, onSuccess: refresh });
  return { send, remove, report, block, restriction, review };
}

export function useChatRestriction(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["chat-restriction", userId], enabled: enabled && !!userId,
    queryFn: async () => {
      const { data, error } = await sb.from("chat_restrictions").select("kind, until_at, reason").eq("user_id", userId!).maybeSingle();
      if (error) { if (isChatUnavailable(error)) return null; throw error; }
      return data as ChatRestriction | null;
    },
  });
}

export function useChatReports(enabled: boolean) {
  return useQuery({
    queryKey: ["chat-reports"], enabled,
    queryFn: async () => {
      const { data, error } = await sb.from("chat_reports").select("id, message_id, reporter_id, reported_user_id, reason, status, review_note, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50);
      if (error) { if (isChatUnavailable(error)) return [] as ChatReport[]; throw error; }
      return (data ?? []) as ChatReport[];
    },
  });
}
