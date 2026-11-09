// Lokaler DEMO-Store (localStorage). Wird durch Lovable Cloud ersetzt.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_PROFILES, DEMO_SPOTS, type Profile, type Spot, type Status } from "./demo-data";

interface DemoUser { email: string; username: string; isAdmin: boolean }
interface Store {
  user: DemoUser | null; guest: boolean;
  spots: Spot[]; profiles: Profile[]; liked: string[]; saved: string[];
  signIn: (email: string) => void; signOut: () => void; continueAsGuest: () => void;
  addSpot: (s: Omit<Spot, "id" | "likes" | "status" | "createdAt" | "author">) => void;
  setStatus: (id: string, s: Status) => void;
  toggleLike: (id: string) => void; toggleSave: (id: string) => void;
  updateProfile: (p: Partial<Pick<Profile, "bio" | "avatar">>) => void;
}
const Ctx = createContext<Store | null>(null);
const KEY = "leonida-demo-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    user: null as DemoUser | null, guest: false, spots: DEMO_SPOTS, profiles: DEMO_PROFILES,
    liked: [] as string[], saved: [] as string[],
  });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) })); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(state)); }, [state, ready]);

  const me = state.user?.username;
  const store: Store = {
    ...state,
    signIn: (email) => {
      const username = (email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "Spieler";
      setState((s) => ({
        ...s, guest: false,
        user: { email, username, isAdmin: email.toLowerCase().startsWith("admin@") },
        profiles: s.profiles.some((p) => p.username === username) ? s.profiles
          : [...s.profiles, { username, avatar: `https://api.dicebear.com/9.x/thumbs/svg?seed=${username}`, bio: "", xp: 0, likes: 0 }],
      }));
    },
    signOut: () => setState((s) => ({ ...s, user: null, guest: false })),
    continueAsGuest: () => setState((s) => ({ ...s, guest: true })),
    addSpot: (spot) => me && setState((s) => ({
      ...s, spots: [...s.spots, { ...spot, id: crypto.randomUUID(), likes: 0, status: "pending", author: me, createdAt: new Date().toISOString().slice(0, 10) }],
    })),
    setStatus: (id, status) => setState((s) => {
      if (!s.user?.isAdmin) return s;
      const spot = s.spots.find((x) => x.id === id);
      // XP nur einmal bei erster Freigabe (Demo – später serverseitig)
      const award = spot && status === "approved" && spot.status === "pending";
      return {
        ...s,
        spots: s.spots.map((x) => (x.id === id ? { ...x, status } : x)),
        profiles: award ? s.profiles.map((p) => (p.username === spot!.author ? { ...p, xp: p.xp + 50 } : p)) : s.profiles,
      };
    }),
    toggleLike: (id) => me && setState((s) => {
      const has = s.liked.includes(id);
      return { ...s, liked: has ? s.liked.filter((x) => x !== id) : [...s.liked, id],
        spots: s.spots.map((x) => (x.id === id ? { ...x, likes: x.likes + (has ? -1 : 1) } : x)) };
    }),
    toggleSave: (id) => me && setState((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
    updateProfile: (p) => me && setState((s) => ({ ...s, profiles: s.profiles.map((x) => (x.username === me ? { ...x, ...p } : x)) })),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
export function useStore() { const c = useContext(Ctx); if (!c) throw new Error("no store"); return c; }
