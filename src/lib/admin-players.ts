// Admin-Spielerverwaltung (SQL 035): Spieler suchen, Detailansicht, Coins + Bonus-Angelversuche gutschreiben, Protokoll.
// Berechtigung prüft ausschließlich die Datenbank (require_admin). Gutschriften sind per request_key idempotent.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isMissing, sb } from "./db";
import { fishingKey } from "./fishing";
import { locale, tr } from "@/lib/i18n";

export type GrantKind = "coins" | "fishing_casts";
export interface AdminPlayer { id: string; username: string | null; email: string | null; avatar_path: string | null; xp: number; coins: number; is_admin: boolean; created_at: string }
export interface AdminPlayerDetail {
  id: string; username: string | null; email: string | null; avatar_path: string | null; xp: number; created_at: string; is_admin: boolean; coins: number;
  daily_limit: number; casts_used_today: number; daily_used: number; daily_left: number; bonus_used_today: number; bonus_casts: number; bonus_granted_total: number;
}
export interface AdminGrant { id: string; target_user_id: string; target_name: string | null; admin_id: string | null; admin_name: string | null; kind: GrantKind; amount: number; reason: string | null; balance_after: number | null; created_at: string }
export interface GrantResult { grant_id: string; already_processed: boolean; amount: number; balance?: number; bonus_casts?: number }
export interface GrantNotice { id: string; kind: GrantKind; amount: number; reason: string | null; created_at: string }

export const ADMIN_SETUP_HINT = "Wird nach dem Datenbank-Update (SQL 035) aktiv.";
export const REASON_PRESETS = ["Event-Gewinn", "Entschädigung", "Geschenk"] as const;
export const COIN_QUICK = [100, 500, 1000, 5000] as const;
export const CAST_QUICK = [1, 5, 10, 15] as const;

const KEYS = { list: ["admin-players"], detail: ["admin-player"], history: ["admin-grants"], notices: ["admin-grant-notices"] } as const;

async function rpcOrMissing<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) { if (isMissing(error)) return null; throw error; }
  return data as T;
}
const num = (v: unknown) => Number(v ?? 0);

export function adminGrantError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Unbekannter Fehler";
  if (isMissing(error)) return ADMIN_SETUP_HINT;
  const m = error.message ?? "";
  if (m.includes("ADMIN_ONLY")) return "Nur für Admins.";
  if (m.includes("AMOUNT_INVALID")) return "Bitte eine ganze Zahl größer als 0 eingeben.";
  if (m.includes("USER_NOT_FOUND")) return "Dieser Spieler existiert nicht mehr.";
  if (m.includes("REQUEST_KEY_REUSED")) return "Bitte die Gutschrift neu starten.";
  if (/out of range|overflow/i.test(m)) return "Diese Menge ist zu groß.";
  if (/fetch|network|load failed/i.test(m)) return "Keine Verbindung. Erneut tippen ist sicher – es wird nicht doppelt gutgeschrieben.";
  return "Die Gutschrift konnte nicht abgeschlossen werden.";
}

export function useAdminPlayers(q: string) {
  return useQuery({ queryKey: [...KEYS.list, q], staleTime: 10_000, queryFn: async () => {
    const rows = await rpcOrMissing<AdminPlayer[]>("admin_player_list", { _q: q });
    return rows === null ? null : rows.map((r) => ({ ...r, xp: num(r.xp), coins: num(r.coins) }));
  } });
}

export function useAdminPlayerDetail(id: string | null) {
  return useQuery({ queryKey: [...KEYS.detail, id], enabled: !!id, queryFn: async () => {
    const d = await rpcOrMissing<AdminPlayerDetail>("admin_player_detail", { _user: id });
    if (!d) return null;
    return { ...d, xp: num(d.xp), coins: num(d.coins), daily_limit: num(d.daily_limit) || 15, casts_used_today: num(d.casts_used_today), daily_used: num(d.daily_used),
      daily_left: num(d.daily_left), bonus_used_today: num(d.bonus_used_today), bonus_casts: num(d.bonus_casts), bonus_granted_total: num(d.bonus_granted_total) };
  } });
}

export function useAdminGrantHistory(userId: string | null) {
  return useQuery({ queryKey: [...KEYS.history, userId ?? "all"], queryFn: async () => {
    const rows = await rpcOrMissing<AdminGrant[]>("admin_grant_history", { _user: userId });
    return rows === null ? null : rows.map((r) => ({ ...r, amount: num(r.amount), balance_after: r.balance_after === null ? null : num(r.balance_after) }));
  } });
}

const FINAL = /ADMIN_ONLY|AMOUNT_INVALID|USER_NOT_FOUND|REQUEST_KEY_REUSED|NONCE_REQUIRED|out of range|PGRST20|42P01|42883|42501/;
/** Gleicher request_key bei jeder Wiederholung → Netzwerkfehler können nie doppelt gutschreiben. */
export function useGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: GrantKind; userId: string; amount: number; reason: string; key: string }): Promise<GrantResult> => {
      const fn = v.kind === "coins" ? "admin_grant_coins" : "admin_grant_fishing_casts";
      const args = { _user: v.userId, _amount: v.amount, _reason: v.reason.trim() || null, _request_key: v.key };
      for (let attempt = 1; ; attempt++) {
        const { data, error } = await sb.rpc(fn, args);
        if (!error) return data as GrantResult;
        if (attempt >= 3 || FINAL.test(`${error.code ?? ""} ${error.message ?? ""}`)) throw error;
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }
    },
    onSettled: () => { Object.values(KEYS).forEach((k) => void qc.invalidateQueries({ queryKey: [...k] })); },
  });
}

// ---------- Spieler-Seite: kurze Meldung + automatische Aktualisierung von Guthaben/Angelversuchen ----------
export function useAdminGrantNotices(userId: string | undefined) {
  const qc = useQueryClient();
  const notices = useQuery({ queryKey: [...KEYS.notices, userId], enabled: !!userId, refetchInterval: 60_000, refetchOnWindowFocus: true,
    queryFn: async () => (await rpcOrMissing<GrantNotice[]>("my_admin_grant_notices")) ?? [] });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`admin-grants-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_grant_notices", filter: `user_id=eq.${userId}` },
        () => void qc.invalidateQueries({ queryKey: [...KEYS.notices, userId] }));
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);

  const list = notices.data ?? [];
  useEffect(() => {
    if (!userId || !list.length) return;
    const ids = list.map((n) => n.id);
    for (const n of list) {
      const amount = Number(n.amount).toLocaleString(locale());
      const title = n.kind === "coins" ? tr("Du hast {0} Leonida Coins erhalten!", amount) : tr("Du hast {0} Bonus-Angelversuche erhalten!", amount);
      toast.success(title, { description: n.reason ?? tr("Gutschrift vom Leonida-Team"), duration: 8000, id: `admin-grant-${n.id}` });
    }
    void qc.invalidateQueries({ queryKey: ["coin-balance"] });
    void qc.invalidateQueries({ queryKey: fishingKey(userId) });
    qc.setQueryData([...KEYS.notices, userId], []);
    // PostgREST-Aufrufe starten erst mit then() – ohne würde nie gesendet
    void sb.rpc("mark_admin_grant_notices_seen", { _ids: ids }).then(({ error }) => { if (error) console.warn("mark_admin_grant_notices_seen", error.message); });
  }, [userId, list, qc]);
}
