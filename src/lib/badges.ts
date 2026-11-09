// Abzeichen-Katalog (gleich wie Tabelle public.badges in SQL 004). Bilder: public/badges/<id>.webp
export type BadgeKind = "community" | "donation";
export type Metric = "spots" | "vehicles" | "collects" | "photos" | "likes" | "streak" | "accurate" | "corrections" | "months" | "best_rank";
export interface BadgeDef { id: string; kind: BadgeKind; name: string; requirement: string; metric?: Metric; target: number }
export const BADGES: BadgeDef[] = [
  { id: "first_find", kind: "community", name: "Erster Fund", requirement: "1 bestätigter Fundort", metric: "spots", target: 1 },
  { id: "explorer", kind: "community", name: "Entdecker", requirement: "10 bestätigte Fundorte", metric: "spots", target: 10 },
  { id: "legend", kind: "community", name: "Leonida-Legende", requirement: "100 bestätigte Fundorte", metric: "spots", target: 100 },
  { id: "car_freak", kind: "community", name: "Autofreak", requirement: "10 bestätigte Fahrzeug-Fundorte", metric: "vehicles", target: 10 },
  { id: "treasure_hunter", kind: "community", name: "Schatzjäger", requirement: "25 bestätigte Sammelobjekte", metric: "collects", target: 25 },
  { id: "photographer", kind: "community", name: "Fotograf", requirement: "20 bestätigte Fundort-Fotos", metric: "photos", target: 20 },
  { id: "community_star", kind: "community", name: "Community-Star", requirement: "100 Likes anderer Spieler auf bestätigte Beiträge", metric: "likes", target: 100 },
  { id: "active", kind: "community", name: "Aktiv dabei", requirement: "7 aufeinanderfolgende aktive Tage", metric: "streak", target: 7 },
  { id: "precision", kind: "community", name: "Präzisionsfinder", requirement: "20 vom Admin als korrekt bestätigte Fundorte", metric: "accurate", target: 20 },
  { id: "helping_hand", kind: "community", name: "Helfende Hand", requirement: "10 vom Admin bestätigte Korrekturen", metric: "corrections", target: 10 },
  { id: "veteran", kind: "community", name: "Veteran", requirement: "6 Monate seit Registrierung", metric: "months", target: 6 },
  { id: "top_explorer", kind: "community", name: "Top-Entdecker", requirement: "Platz 1–10 einer abgeschlossenen Monatswertung", metric: "best_rank", target: 10 },
  { id: "supporter", kind: "donation", name: "Supporter", requirement: "Bestätigte Spenden ab 1 €", target: 100 },
  { id: "bronze", kind: "donation", name: "Bronze Supporter", requirement: "Bestätigte Spenden ab 5 €", target: 500 },
  { id: "silver", kind: "donation", name: "Silver Supporter", requirement: "Bestätigte Spenden ab 15 €", target: 1500 },
  { id: "gold", kind: "donation", name: "Gold Supporter", requirement: "Bestätigte Spenden ab 30 €", target: 3000 },
  { id: "diamond", kind: "donation", name: "Diamond Supporter", requirement: "Bestätigte Spenden ab 50 €", target: 5000 },
  { id: "founder", kind: "donation", name: "Leonida Founder", requirement: "Bestätigte Spenden ab 100 €", target: 10000 },
];
export const badgeById = (id: string) => BADGES.find((b) => b.id === id);
export const badgeImg = (id: string) => `/badges/${id}.webp`;
export type Progress = Partial<Record<Metric, number | null>>;
/** Fortschritt 0..1 und Text (z. B. "3 / 10"). Monatsrang: kleiner ist besser. */
export function progressOf(b: BadgeDef, p: Progress | undefined): { pct: number; label: string } | null {
  if (!b.metric || !p) return null;
  const v = p[b.metric];
  if (b.metric === "best_rank") return v ? { pct: v <= 10 ? 1 : 0, label: `Bester Monatsrang: ${v}` } : { pct: 0, label: "Noch nicht platziert" };
  const n = Number(v ?? 0);
  return { pct: Math.min(1, n / b.target), label: `${Math.min(n, b.target)} / ${b.target}${b.metric === "months" ? " Monate" : ""}` };
}
