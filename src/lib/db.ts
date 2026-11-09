// Untypisierter Zugriff für Tabellen/Funktionen aus docs/migrations/004 (noch nicht in den generierten Typen).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sb = supabase as unknown as SupabaseClient<any, "public", any>;
/** Fehler "Tabelle/Spalte/Funktion existiert noch nicht" -> App läuft im Kompatibilitätsmodus (vor SQL 004). */
export const isMissing = (e: { code?: string } | null) => !!e && ["PGRST205", "PGRST202", "42703", "42P01", "42883", "PGRST200"].includes(e.code ?? "");
export const DEFAULT_AVATAR = "/icons/icon-192.png";
