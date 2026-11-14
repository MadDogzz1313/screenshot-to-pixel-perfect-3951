import { tr } from "@/lib/i18n";
// Abzeichen-Katalog (gleich wie Tabelle public.badges in SQL 004). Bilder: public/badges/<id>.webp
export type BadgeKind = "community";
export type Metric = "spots" | "vehicles" | "collects" | "photos" | "likes" | "streak" | "accurate" | "corrections" | "months" | "best_rank";
export interface BadgeDef { id: string; kind: BadgeKind; name: string; requirement: string; metric?: Metric; target: number }
export const BADGES: BadgeDef[] = [
  { id: "first_find", kind: "community", name: tr("Erster Fund"), requirement: tr("1 bestätigter Fundort"), metric: "spots", target: 1 },
  { id: "explorer", kind: "community", name: tr("Entdecker"), requirement: tr("10 bestätigte Fundorte"), metric: "spots", target: 10 },
  { id: "legend", kind: "community", name: tr("Leonida-Legende"), requirement: tr("100 bestätigte Fundorte"), metric: "spots", target: 100 },
  { id: "car_freak", kind: "community", name: tr("Autofreak"), requirement: tr("10 bestätigte Fahrzeug-Fundorte"), metric: "vehicles", target: 10 },
  { id: "treasure_hunter", kind: "community", name: tr("Schatzjäger"), requirement: tr("25 bestätigte Sammelobjekte"), metric: "collects", target: 25 },
  { id: "photographer", kind: "community", name: tr("Fotograf"), requirement: tr("20 bestätigte Fundort-Fotos"), metric: "photos", target: 20 },
  { id: "community_star", kind: "community", name: tr("Community-Star"), requirement: tr("100 Likes anderer Spieler auf bestätigte Beiträge"), metric: "likes", target: 100 },
  { id: "active", kind: "community", name: tr("Aktiv dabei"), requirement: tr("7 aufeinanderfolgende aktive Tage"), metric: "streak", target: 7 },
  { id: "precision", kind: "community", name: tr("Präzisionsfinder"), requirement: tr("20 vom Admin als korrekt bestätigte Fundorte"), metric: "accurate", target: 20 },
  { id: "helping_hand", kind: "community", name: tr("Helfende Hand"), requirement: tr("10 vom Admin bestätigte Korrekturen"), metric: "corrections", target: 10 },
  { id: "veteran", kind: "community", name: "Veteran", requirement: tr("6 Monate seit Registrierung"), metric: "months", target: 6 },
  { id: "top_explorer", kind: "community", name: tr("Top-Entdecker"), requirement: tr("Platz 1–10 einer abgeschlossenen Monatswertung"), metric: "best_rank", target: 10 },
  { id: "mythic_catch", kind: "community", name: tr("Mythischer Fang"), requirement: tr("Fange den Mythischen Leonida-Marlín in Leonida Fishing"), target: 1 },
];
export const badgeById = (id: string) => BADGES.find((b) => b.id === id);
export const badgeImg = (id: string) => `/badges/${id}.webp`;
/** Animierte Badges besitzen zusätzlich /badges/<id>-static.webp für „Bewegung reduzieren“. */
export const ANIMATED_BADGES = new Set(["mythic_catch"]);
export type Progress = Partial<Record<Metric, number | null>>;
/** Fortschritt 0..1 und Text (z. B. "3 / 10"). Monatsrang: kleiner ist besser. */
export function progressOf(b: BadgeDef, p: Progress | undefined): { pct: number; label: string } | null {
  if (!b.metric || !p) return null;
  const v = p[b.metric];
  if (b.metric === "best_rank") return v ? { pct: v <= 10 ? 1 : 0, label: tr("Bester Monatsrang: {0}", v) } : { pct: 0, label: tr("Noch nicht platziert") };
  const n = Number(v ?? 0);
  return { pct: Math.min(1, n / b.target), label: `${Math.min(n, b.target)} / ${b.target}${b.metric === "months" ? tr(" Monate") : ""}` };
}
