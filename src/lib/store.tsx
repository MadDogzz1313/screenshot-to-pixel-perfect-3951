// App-Store: echte Anmeldung, Profile, Rollen und Fundorte über Lovable Cloud (Supabase).
// Likes in der Datenbank (spot_likes); "Merken" vorerst nur auf dem Gerät (localStorage).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { detachPushOnLogout } from "./push";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AVATAR, isMissing, sb } from "./db";
import { checkUsernameAvailable, usernameError, validateUsername } from "./username";
import type { CategoryId, Profile, Spot, Status } from "./demo-data";
import fallbackImg from "@/assets/bg-sunset.jpg";

import { tr } from "@/lib/i18n";
export interface AppUser { id: string; email: string; username: string; needsUsername: boolean; isAdmin: boolean }
export interface AuthResult { error: string | null; needsConfirm?: boolean }
interface Store {
  user: AppUser | null; guest: boolean; authReady: boolean; recovery: boolean;
  spots: Spot[]; profiles: Profile[]; liked: string[]; saved: string[];
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, username: string) => Promise<AuthResult>;
  updateUsername: (username: string) => Promise<string | null>;
  signOut: () => Promise<void>; continueAsGuest: () => void;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  spotsLoading: boolean;
  addSpot: (s: Omit<Spot, "id" | "likes" | "status" | "createdAt" | "author" | "images">, files: File[]) => Promise<{ error: string | null; photoWarning?: boolean }>;
  setStatus: (id: string, s: Status) => Promise<string | null>;
  toggleLike: (id: string) => Promise<void> | void; toggleSave: (id: string) => void;
  updateProfile: (fields: Record<string, unknown>) => Promise<string | null>;
}
const Ctx = createContext<Store | null>(null);
const KEY = "leonida-demo-v1";

type CardRow = { id: string; username: string | null; full_access?: boolean; is_private?: boolean; avatar_path: string | null; bio: string | null; xp: number | null;
  joined_at: string | null; featured_badges: string[] | null; show_avatar?: boolean | null; show_join_date?: boolean | null; show_badges?: boolean | null; show_friends?: boolean | null };
const toProfile = (r: CardRow, urls: Map<string, string>): Profile => {
  const url = r.avatar_path ? urls.get(r.avatar_path) : undefined;
  return {
    id: r.id, username: r.username ?? tr("Spieler"), avatar: url ?? DEFAULT_AVATAR, hasAvatar: !!url, avatarPath: r.avatar_path, bio: r.bio ?? "", xp: r.xp ?? 0, likes: 0,
    isPrivate: !!r.is_private, restricted: !!r.is_private && !r.full_access, joinedAt: r.joined_at, featured: r.featured_badges,
    needsUsername: !r.username,    showAvatar: r.show_avatar !== false, showJoinDate: r.show_join_date !== false, showBadges: r.show_badges !== false, showFriends: r.show_friends === true,
  };
};

const BUCKET = "spot-photos";
const SPOT_BASE = "id, author_id, title, category, area, x, y, vehicle_type, hour, description, status, likes_count, created_at, author:profiles!spots_author_id_fkey(username), spot_photos(path, status, created_at)";
type SpotRow = {
  id: string; title: string; category: CategoryId; area: string; x: number; y: number; vehicle_type: string | null; hour: number | null;
  description: string; status: Status; likes_count: number; created_at: string; author_id: string; accuracy_verified_at?: string | null;
  author: { username: string } | null; spot_photos: { path: string; status: string; created_at: string }[];
};
const photoUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const toSpot = (r: SpotRow): Spot => {
  const photos = [...r.spot_photos].filter((p) => p.status !== "rejected").sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    id: r.id, title: r.title, category: r.category, area: r.area, x: Number(r.x), y: Number(r.y),
    vehicleType: r.vehicle_type ?? undefined, hour: r.hour ?? undefined, description: r.description,
    images: photos.length ? photos.map((p) => photoUrl(p.path)) : [fallbackImg],
    author: r.author?.username ?? tr("Unbekannt"), authorId: r.author_id, likes: r.likes_count, status: r.status, createdAt: r.created_at.slice(0, 10),
    accurate: !!r.accuracy_verified_at,
  };
};

function authMessage(e: { code?: string | undefined; message: string }): string {
  const c = e.code ?? ""; const m = e.message.toLowerCase();
  if (c === "invalid_credentials" || m.includes("invalid login")) return tr("E-Mail oder Passwort ist falsch.");
  if (c === "email_not_confirmed" || m.includes("not confirmed")) return tr("Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).");
  if (c === "user_already_exists" || m.includes("already registered")) return tr("Diese E-Mail ist bereits registriert. Bitte melde dich an.");
  if (c === "weak_password" || m.includes("password")) return tr("Das Passwort ist zu schwach. Bitte wähle ein längeres Passwort.");
  if (c.includes("rate_limit") || m.includes("rate limit")) return tr("Zu viele Versuche. Bitte warte kurz und versuche es erneut.");
  return tr("Das hat nicht geklappt. Bitte versuche es erneut.");
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState({
    guest: false, saved: [] as string[],
  });
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // true, solange ein Passwort-Zurücksetzen-Link aktiv ist (Ziel: /passwort-neu statt /karte)
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        // Alte Demo-Daten (Anmeldung inkl. "admin@"-Regel, Demo-Fundorte, Demo-Profile) werden bewusst verworfen.
        const { saved, guest } = JSON.parse(raw) as Partial<typeof state>;
        setState((s) => ({ ...s, ...(saved && { saved }), ...(guest !== undefined && { guest }) }));
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const { saved, guest } = state;
    localStorage.setItem(KEY, JSON.stringify({ saved, guest }));
  }, [state, ready]);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s); setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => { setSession(d.session); setAuthReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  // Zeitbedingungen (Veteran, Monatswertung) für alle prüfen – serverseitig höchstens 1× pro Stunde wirksam
  useEffect(() => { sb.rpc("run_badge_maintenance").then(() => undefined); }, []);
  // Aktiver Tag (serverseitig) + Abzeichen-Prüfung beim Öffnen der App
  useEffect(() => {
    if (!uid) return;
    sb.rpc("touch_activity").then(({ error }) => { if (!error) { qc.invalidateQueries({ queryKey: ["badges"] }); qc.invalidateQueries({ queryKey: ["progress"] }); } });
  }, [uid, qc]);
  // Adminrecht prüft die Datenbank (has_role mit dem Token des Nutzers), nie die E-Mail. Funktioniert ohne
  // eigenen App-Server (Lovable SSR und statisches Emergent-Deployment). Admin-Aktionen sichert zusätzlich RLS.
  const accessQuery = useQuery({
    queryKey: ["access", uid], enabled: !!uid, retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: uid!, _role: "admin" });
      if (error) throw error;
      return { userId: uid!, isAdmin: data === true };
    },
  });
  // Profile über die geschützte Ansicht profile_cards (blendet Privates aus); vor SQL 004 Rückfall auf die Tabelle.
  const profilesQuery = useQuery({
    queryKey: ["profiles", uid ?? "guest"], enabled: authReady,
    queryFn: async () => {
      let rows: CardRow[];
      const v = await sb.from("profile_cards").select("*").limit(500);
      if (v.error) {
        if (!isMissing(v.error)) throw v.error;
        const t = await supabase.from("profiles").select("id, username, bio, xp, created_at").limit(500);
        if (t.error) throw t.error;
        rows = t.data.map((r) => ({ ...r, avatar_path: null, joined_at: r.created_at, featured_badges: [], full_access: r.id === uid }));
      } else rows = v.data as CardRow[];
      const paths = rows.map((r) => r.avatar_path).filter((x): x is string => !!x);
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data } = await sb.storage.from("avatars").createSignedUrls(paths, 3600);
        for (const d of data ?? []) if (d.signedUrl && d.path) urls.set(d.path, d.signedUrl);
      }
      return rows.map((r) => toProfile(r, urls));
    },
  });
  const likedQuery = useQuery({
    queryKey: ["liked", uid], enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("spot_likes").select("spot_id").eq("user_id", uid!);
      if (error) throw error;
      return data.map((r) => r.spot_id);
    },
  });
  const liked = likedQuery.data ?? [];
  // RLS entscheidet, was sichtbar ist: Gäste nur "approved", Nutzer zusätzlich eigene, Admins alle.
  const spotsQuery = useQuery({
    queryKey: ["spots", uid ?? "guest"], enabled: authReady,
    queryFn: async () => {
      const q = (cols: string) => sb.from("spots").select(cols).order("created_at", { ascending: false }).limit(500);
      let res = await q(SPOT_BASE + ", accuracy_verified_at");
      if (res.error && isMissing(res.error)) res = await q(SPOT_BASE);
      if (res.error) throw res.error;
      return (res.data as unknown as SpotRow[]).map(toSpot);
    },
  });
  const spots = spotsQuery.data ?? [];

  const profiles = profilesQuery.data ?? [];
  const meRow = profiles.find((p) => p.id === uid);
  const user: AppUser | null = session
    ? {
        id: session.user.id, email: session.user.email ?? "",
        username: meRow?.username ?? tr("Spieler"), needsUsername: meRow?.needsUsername === true,
        isAdmin: accessQuery.data?.isAdmin === true && accessQuery.data.userId === session.user.id,
      }
    : null;
  const loadingUser = !!session && (profilesQuery.isPending || accessQuery.isPending);

  const me = user?.username;
  const store: Store = {
    ...state, liked, spots, profiles, user, recovery, authReady: authReady && !loadingUser,
    spotsLoading: !authReady || spotsQuery.isPending,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: authMessage(error) };
      setState((s) => ({ ...s, guest: false }));
      return { error: null };
    },
    signUp: async (email, password, username) => {
      const usernameIssue = validateUsername(username);
      if (usernameIssue) return { error: usernameIssue };
      try {
        if (!(await checkUsernameAvailable(username))) return { error: tr("Dieser Benutzername ist bereits vergeben oder nicht verfügbar.") };
      } catch (e) { return { error: usernameError(e as { code?: string; message?: string }) }; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username: username.trim() }, emailRedirectTo: `${window.location.origin}/` } });
      if (error) return { error: authMessage(error) };
      if (data.user && data.user.identities?.length === 0) return { error: tr("Diese E-Mail ist bereits registriert. Bitte melde dich an.") };
      if (data.session) setState((s) => ({ ...s, guest: false }));
      return { error: null, needsConfirm: !data.session };
    },
    signOut: async () => {
      await detachPushOnLogout();
      await supabase.auth.signOut();
      qc.removeQueries({ queryKey: ["access"] }); qc.removeQueries({ queryKey: ["liked"] }); qc.removeQueries({ queryKey: ["progress"] });
      setState((s) => ({ ...s, guest: false }));
    },
    continueAsGuest: () => setState((s) => ({ ...s, guest: true })),
    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/passwort-neu` });
      return { error: error ? authMessage(error) : null };
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.code === "same_password") return { error: tr("Das neue Passwort muss sich vom alten unterscheiden.") };
        return { error: authMessage(error) };
      }
      setRecovery(false);
      return { error: null };
    },
    addSpot: async (spot, files) => {
      if (!user) return { error: tr("Bitte anmelden") };
      const { data, error } = await supabase.from("spots").insert({
        author_id: user.id, title: spot.title, category: spot.category, area: spot.area, x: spot.x, y: spot.y,
        vehicle_type: spot.vehicleType ?? null, hour: spot.hour ?? null, description: spot.description,
      }).select("id").single();
      if (error || !data) return { error: tr("Einreichen fehlgeschlagen. Bitte versuche es erneut.") };
      let photoWarning = false;
      for (const f of files) {
        const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/${data.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
        if (up.error) { photoWarning = true; continue; }
        const row = await supabase.from("spot_photos").insert({ spot_id: data.id, uploader_id: user.id, path });
        if (row.error) photoWarning = true;
      }
      await qc.invalidateQueries({ queryKey: ["spots"] });
      return { error: null, photoWarning };
    },
    // Die Datenbank (RLS + has_role) erlaubt das nur Admins; XP vergibt ausschließlich der Datenbank-Trigger.
    setStatus: async (id, status) => {
      const { data, error } = await supabase.from("spots").update({ status }).eq("id", id).select("id");
      if (error) return tr("Speichern fehlgeschlagen");
      if (!data?.length) return tr("Keine Berechtigung");
      await Promise.all(["spots", "profiles", "badges", "progress", "leaderboard"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      return null;
    },
    // Like dauerhaft in spot_likes (Primärschlüssel spot_id+user_id verhindert Mehrfach-Likes)
    toggleLike: async (id) => {
      if (!user) return;
      const has = liked.includes(id);
      const { error } = has ? await supabase.from("spot_likes").delete().eq("spot_id", id).eq("user_id", user.id)
        : await supabase.from("spot_likes").insert({ spot_id: id, user_id: user.id });
      if (error && error.code !== "23505") return;
      await Promise.all(["liked", "spots", "badges", "progress"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    },
    toggleSave: (id) => me && setState((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
    updateUsername: async (username) => {
      if (!user) return tr("Bitte anmelden");
      const issue = validateUsername(username);
      if (issue) return issue;
      try {
        const { error } = await sb.rpc("set_my_username", { _username: username.trim() });
        if (error) return usernameError(error);
      } catch (e) { return usernameError(e as { code?: string; message?: string }); }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profiles"] }),
        qc.invalidateQueries({ queryKey: ["spots"] }),
        qc.invalidateQueries({ queryKey: ["friend-state"] }),
        qc.invalidateQueries({ queryKey: ["friends-of"] }),
        qc.invalidateQueries({ queryKey: ["conversations"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
        qc.invalidateQueries({ queryKey: ["admin-users"] }),
      ]);
      return null;
    },
    updateProfile: async (fields) => {
      if (!user) return tr("Bitte anmelden");
      if (Object.prototype.hasOwnProperty.call(fields, "username")) return tr("Bitte ändere den Benutzernamen im Bereich „Benutzername“.");
      const { error } = await sb.from("profiles").update(fields).eq("id", user.id);
      if (error) return isMissing(error) ? tr("Diese Einstellung wird nach dem Datenbank-Update (SQL 004) aktiv.") : (error.message.includes("Abzeichen") ? error.message : tr("Speichern fehlgeschlagen"));
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      return null;
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useStore() { const c = useContext(Ctx); if (!c) throw new Error("no store"); return c; }
