// Crew Finder (SQL 014): Mitspielersuche, Beitrittsanfragen, private Lobby + Gruppenchat.
// Lesen über geprüfte RPCs, Schreiben ausschließlich über security-definer-Funktionen. Chat/Lobby per Realtime (RLS gilt).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMissing, sb } from "./db";

export type Platform = "playstation" | "xbox";
export type StartMode = "now" | "later" | "time";
export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "playstation", label: "PlayStation" },
  { id: "xbox", label: "Xbox" },
];
export const LANGUAGES = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "Englisch" },
  { id: "es", label: "Spanisch" },
  { id: "fr", label: "Französisch" },
  { id: "it", label: "Italienisch" },
  { id: "tr", label: "Türkisch" },
  { id: "pl", label: "Polnisch" },
  { id: "nl", label: "Niederländisch" },
  { id: "other", label: "Andere" },
] as const;
export type Language = (typeof LANGUAGES)[number]["id"];
export const platformLabel = (p: string) => PLATFORMS.find((x) => x.id === p)?.label ?? p;
export const languageLabel = (l: string) => LANGUAGES.find((x) => x.id === l)?.label ?? l;

export interface CrewActivity {
  id: string;
  label: string;
  emoji: string;
  default_max: number;
  max_limit: number;
  sort: number;
  active: boolean;
}
export interface CrewMember {
  user_id: string;
  username: string;
  role: "leader" | "member";
  ready: boolean;
  joined_at: string;
}
export interface CrewJoinRequest {
  id: string;
  user_id: string;
  username: string;
  created_at: string;
}
export interface Crew {
  id: string;
  leader_id: string;
  activity_id: string;
  activity_label: string;
  activity_emoji: string;
  platform: Platform;
  language: Language;
  headset_required: boolean;
  max_players: number;
  external_players: number;
  description: string;
  start_mode: StartMode;
  start_at: string | null;
  status: "open" | "closed";
  expires_at: string;
  expired: boolean;
  created_at: string;
  members: CrewMember[];
  my_role: "leader" | "member" | null;
  my_request: "pending" | "accepted" | "declined" | "cancelled" | null;
  viewer_is_admin?: boolean;
  requests?: CrewJoinRequest[];
}
export interface CrewMessage {
  id: string;
  crew_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
}
export interface CrewInput {
  activity: string;
  platform: Platform;
  language: Language;
  headset: boolean;
  max: number;
  external: number;
  description: string;
  startMode: StartMode;
  startAt: string | null;
}
export interface CrewFilters {
  platform: Platform | null;
  activity: string | null;
  language: Language | null;
  minFree: number;
}

export const occupied = (c: Pick<Crew, "members" | "external_players">) =>
  c.members.length + c.external_players;
export const freeSlots = (c: Crew) => Math.max(0, c.max_players - occupied(c));
export const isFull = (c: Crew) => freeSlots(c) === 0;
const hm = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const startLabel = (c: Pick<Crew, "start_mode" | "start_at">) =>
  c.start_mode === "now"
    ? "Start: jetzt"
    : c.start_mode === "later"
      ? "Start: später"
      : `Start: ${new Intl.DateTimeFormat("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(c.start_at!))} Uhr`;
export const expiryLabel = (c: Pick<Crew, "expires_at" | "expired">) =>
  c.expired ? "Abgelaufen" : `Läuft um ${hm(c.expires_at)} Uhr ab`;

export const CREW_SETUP_HINT = "Der Crew Finder wird nach dem Datenbank-Update (SQL 014) aktiv.";
const MESSAGES: Record<string, string> = {
  CREW_NOT_FOUND: "Diese Crew gibt es nicht mehr oder sie ist nicht sichtbar.",
  CREW_CLOSED: "Diese Crew-Suche ist geschlossen oder abgelaufen.",
  CREW_FULL: "Die Crew ist bereits vollständig.",
  CREW_ALREADY_MEMBER: "Du bist bereits Mitglied dieser Crew.",
  CREW_ALREADY_REQUESTED: "Deine Anfrage ist bereits beim Crew-Leader.",
  CREW_DECLINED_RECENTLY: "Deine Anfrage wurde gerade abgelehnt. Versuche es später erneut.",
  CREW_BLOCKED: "Zwischen euch besteht eine Blockierung.",
  CREW_NOT_LEADER: "Nur der Crew-Leader kann das.",
  CREW_NOT_MEMBER: "Nur Mitglieder der Crew können das.",
  CREW_LEADER_LEAVE: "Als Crew-Leader kannst du die Suche schließen oder die Crew auflösen.",
  CREW_REQUEST_NOT_FOUND: "Diese Anfrage gibt es nicht mehr.",
  CREW_REQUEST_CLOSED: "Diese Anfrage wurde bereits beantwortet.",
  CREW_USER_UNAVAILABLE: "Dieser Spieler kann gerade keiner Crew beitreten.",
  CREW_EXPIRED: "Diese Crew ist abgelaufen.",
  CREW_LIMIT: "Du kannst höchstens 3 offene Crew-Suchen gleichzeitig haben.",
  CREW_INVALID_SIZE: "Bitte prüfe die Spielerzahlen.",
  CREW_SIZE_BELOW_MEMBERS: "Die maximale Spielerzahl ist kleiner als die aktuelle Crew.",
  CREW_INVALID_START: "Bitte wähle eine Startzeit innerhalb der nächsten 7 Tage.",
  CREW_INVALID_ACTIVITY: "Diese Aktivität ist nicht verfügbar.",
  CREW_MESSAGE_EMPTY: "Bitte schreibe eine Nachricht.",
  CREW_MESSAGE_TOO_LONG: "Eine Nachricht darf höchstens 1000 Zeichen haben.",
  REPORT_DUPLICATE: "Du hast das bereits gemeldet. Das Admin-Team prüft es.",
  REPORT_SELF: "Du kannst deine eigene Crew nicht melden.",
  RATE_LIMIT: "Zu viele Aktionen in kurzer Zeit. Bitte warte kurz.",
  ACCOUNT_BANNED: "Dein Konto ist gesperrt.",
  ADMIN_ONLY: "Nur für Admins.",
};
export function crewError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return "Unbekannter Fehler";
  if (isMissing(e)) return CREW_SETUP_HINT;
  const key = Object.keys(MESSAGES).find((k) => e.message?.includes(k));
  return key ? MESSAGES[key]! : "Das hat nicht geklappt. Bitte versuche es erneut.";
}
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
/** null = SQL 014 fehlt noch */
async function rpcOrMissing<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  return data as T;
}

const KEYS = {
  activities: ["crew-activities"],
  browse: ["crew-browse"],
  mine: ["crew-mine"],
  detail: ["crew-detail"],
  messages: ["crew-messages"],
} as const;

export function useCrewActivities(includeInactive = false, enabled = true) {
  return useQuery({
    queryKey: [...KEYS.activities, includeInactive],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb
        .from("crew_activities")
        .select("id, label, emoji, default_max, max_limit, sort, active")
        .order("sort");
      if (error) {
        if (isMissing(error)) return null;
        throw error;
      }
      return (data as CrewActivity[]).filter((a) => includeInactive || a.active);
    },
  });
}
export function useCrewBrowse(f: CrewFilters, enabled: boolean) {
  return useQuery({
    queryKey: [...KEYS.browse, f],
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: () =>
      rpcOrMissing<Crew[]>("crew_browse", {
        _platform: f.platform,
        _activity: f.activity,
        _language: f.language,
        _min_free: f.minFree,
      }),
  });
}
export function useMyCrews(enabled: boolean) {
  return useQuery({
    queryKey: [...KEYS.mine],
    enabled,
    refetchInterval: 60_000,
    queryFn: () => rpcOrMissing<Crew[]>("my_crews"),
  });
}
export function useCrewDetail(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEYS.detail, id],
    enabled,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: () => rpcOrMissing<Crew>("crew_detail", { _crew: id }),
  });
}
export function useCrewMessages(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...KEYS.messages, id],
    enabled,
    queryFn: async () => {
      const { data, error } = await sb
        .from("crew_messages")
        .select("id, crew_id, sender_id, body, created_at, deleted_at")
        .eq("crew_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as CrewMessage[]).reverse();
    },
  });
}

/** Lobby live halten: Chat, Mitglieder (Bereit-Status) und Anfragen der Crew */
export function useCrewRealtime(id: string, enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const detail = () => void qc.invalidateQueries({ queryKey: [...KEYS.detail, id] });
    const channel = supabase
      .channel(`crew-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_messages", filter: `crew_id=eq.${id}` },
        () => void qc.invalidateQueries({ queryKey: [...KEYS.messages, id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_members", filter: `crew_id=eq.${id}` },
        detail,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_join_requests", filter: `crew_id=eq.${id}` },
        detail,
      );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, enabled, qc]);
}

const inputArgs = (i: CrewInput) => ({
  _activity: i.activity,
  _platform: i.platform,
  _language: i.language,
  _headset: i.headset,
  _max: i.max,
  _external: i.external,
  _description: i.description,
  _start_mode: i.startMode,
  _start_at: i.startMode === "time" ? i.startAt : null,
});

export function useCrewActions() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all(
      [KEYS.browse, KEYS.mine, KEYS.detail, KEYS.messages, ["notifications"]].map((k) =>
        qc.invalidateQueries({ queryKey: [...k] }),
      ),
    );
  const useAction = <A, R = unknown>(fn: (a: A) => Promise<R>) =>
    useMutation({ mutationFn: fn, onSettled: refresh });
  return {
    create: useAction((i: CrewInput) => rpc<string>("create_crew", inputArgs(i))),
    update: useAction(({ id, input }: { id: string; input: CrewInput }) =>
      rpc("update_crew", { _crew: id, ...inputArgs(input) }),
    ),
    close: useAction((id: string) => rpc("close_crew", { _crew: id })),
    remove: useAction((id: string) => rpc("delete_crew", { _crew: id })),
    requestJoin: useAction((id: string) => rpc<string>("request_join_crew", { _crew: id })),
    cancelJoin: useAction((id: string) => rpc("cancel_join_crew", { _crew: id })),
    respond: useAction(({ requestId, accept }: { requestId: string; accept: boolean }) =>
      rpc<string>("respond_crew_request", { _request: requestId, _accept: accept }),
    ),
    leave: useAction((id: string) => rpc("leave_crew", { _crew: id })),
    kick: useAction(({ id, userId }: { id: string; userId: string }) =>
      rpc("remove_crew_member", { _crew: id, _user: userId }),
    ),
    ready: useAction(({ id, ready }: { id: string; ready: boolean }) =>
      rpc("set_crew_ready", { _crew: id, _ready: ready }),
    ),
    send: useAction(({ id, body }: { id: string; body: string }) =>
      rpc<CrewMessage>("send_crew_message", { _crew: id, _body: body }),
    ),
    deleteMessage: useAction((messageId: string) =>
      rpc("delete_crew_message", { _message: messageId }),
    ),
    adminClose: useAction(({ id, reason }: { id: string; reason: string }) =>
      rpc("admin_close_crew", { _crew: id, _reason: reason }),
    ),
  };
}

export function useAdminCrewActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: CrewActivity) =>
      rpc("admin_upsert_crew_activity", {
        _id: a.id,
        _label: a.label,
        _emoji: a.emoji,
        _default_max: a.default_max,
        _max_limit: a.max_limit,
        _sort: a.sort,
        _active: a.active,
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: [...KEYS.activities] }),
  });
}
