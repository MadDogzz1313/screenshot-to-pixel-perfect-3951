/**
 * Neon Highway – reine Spiellogik (ohne React/three.js, deshalb testbar).
 * - Alle Gegner fahren mit derselben, langsam steigenden Geschwindigkeit -> Abstände bleiben erhalten, niemand fährt durch einen anderen.
 * - Neue Reihen entstehen nach Strecke (nicht nach Zeit) und nur so, dass der Spieler aus JEDER freien Spur der letzten Reihe
 *   („reach“) mit höchstens einem Spurwechsel und genug Reaktionszeit eine freie Spur erreicht.
 * - Kollision über die sichtbaren Karosserie-Hitboxen und die tatsächliche (gleitende) Querposition des Spielers.
 */
import { carBox, laneX, maxExtents, overlaps, zOf, type Box, type HighwayView } from "./geometry";

export type ObstacleVariant = "cyan" | "pink" | "police";
export type Obstacle = {
  lane: number;
  y: number;
  width: number;
  height: number;
  color: string;
  variant: ObstacleVariant;
};
type PlannedRow = { lanes: number[]; stagger: number; gap: number; reach: number[] };
export type Engine = {
  status: "start" | "playing" | "paused" | "over";
  /** Zielspur 0–2 */
  lane: number;
  /** tatsächliche Querposition in Spur-Einheiten (gleitet zur Zielspur, wie bisher in der Grafik) */
  x: number;
  obstacles: Obstacle[];
  elapsed: number;
  score: number;
  last: number;
  roundId: string | null;
  roundStarted: number;
  view: HighwayView;
  aspect: number;
  sinceRow: number;
  lastStagger: number;
  reach: number[];
  pending: PlannedRow | null;
  /** Polizeijagd aktiv (mehr Zweierreihen, Streifenwagen im Verkehr) */
  chase: boolean;
  chaseStart: number;
  nextChaseAt: number;
};

const LANES: readonly number[] = [0, 1, 2];
/** Spurwechsel-Gleiten (1/s) – identisch zur bisherigen Grafik-Animation. */
export const LANE_EASE = 18;
const COLORS: Record<ObstacleVariant, string> = { cyan: "#22e4f2", pink: "#ff6aa9", police: "#ff2340" };
/** Polizeijagd: erste nach 20 s Spielzeit, dauert 20 s, danach 40 s Ruhe bis zur nächsten. */
export const CHASE_FIRST_MS = 20_000;
export const CHASE_MS = 20_000;
export const CHASE_PAUSE_MS = 40_000;
/** Zusätzliche Wahrscheinlichkeit für Zweierreihen während der Jagd (eine Spur bleibt immer frei, Fairness-Regel unverändert). */
export const CHASE_PAIR_BONUS = 0.15;
/** Anteil Streifenwagen an neuen Autos während der Jagd. */
export const CHASE_POLICE_SHARE = 0.65;
const STAGGER_MAX = 0.035;
const SAFETY = 1.12;

/** 0 -> 1, sanft und ohne Sprünge (nach 60 s ≈ 45 %, nach 2 min ≈ 70 %, nach 5 min ≈ 95 %). */
export const difficulty = (ms: number) => 1 - Math.exp(-Math.max(0, ms) / 100_000);
/** Geschwindigkeit in Spiel-y pro ms (vorher zufällig 0.00019–0.00027 je Auto). */
export const speedAt = (ms: number) => 0.00019 + 0.00012 * difficulty(ms);
/** Grundabstand zwischen zwei Reihen (Mitte zu Mitte, Spiel-y). Vorher: alle 650 ms ein Auto. */
export const baseGapAt = (ms: number) => 0.44 - 0.2 * difficulty(ms);
/** Wahrscheinlichkeit für zwei Autos in einer Reihe (eine Spur bleibt immer frei). */
export const pairChanceAt = (ms: number) => {
  const d = difficulty(ms);
  return d < 0.15 ? 0 : (0.5 * (d - 0.15)) / 0.85;
};
/** Zeit, die der Spieler für einen erzwungenen Spurwechsel mindestens hat (ms). */
export const reactionMsAt = (ms: number) => 520 - 200 * difficulty(ms);

export function createEngine(): Engine {
  return {
    status: "start",
    lane: 1,
    x: 1,
    obstacles: [],
    elapsed: 0,
    score: 0,
    last: 0,
    roundId: null,
    roundStarted: 0,
    view: "chase",
    aspect: 0.6,
    sinceRow: 0,
    lastStagger: 0,
    reach: [0, 1, 2],
    pending: null,
    chase: false,
    chaseStart: 0,
    nextChaseAt: CHASE_FIRST_MS,
  };
}

/** Neue Runde: erstes Auto erst nach gut einer Sekunde, mit großem Abstand. */
export function resetRound(e: Engine, now: number) {
  e.status = "playing";
  e.lane = 1;
  e.x = 1;
  e.obstacles = [];
  e.elapsed = 0;
  e.score = 0;
  e.last = now;
  e.roundStarted = now;
  e.reach = [0, 1, 2];
  e.pending = null;
  e.lastStagger = 0;
  e.chase = false;
  e.chaseStart = 0;
  e.nextChaseAt = CHASE_FIRST_MS;
  e.sinceRow = baseGapAt(0) - speedAt(0) * 1100;
}

/** Genau eine Spur nach links/rechts, nie über den Straßenrand. */
export function moveLane(e: Engine, direction: -1 | 1) {
  if (e.status !== "playing") return false;
  const next = Math.max(0, Math.min(2, e.lane + direction));
  if (next === e.lane) return false;
  e.lane = next;
  return true;
}

export const playerBox = (e: Engine): Box => carBox("player", e.view, laneX(e.x), 0, e.aspect);
export const obstacleBox = (e: Engine, ob: Obstacle): Box =>
  carBox(ob.variant, e.view, laneX(ob.lane), zOf(ob.y), e.aspect);

export function planRow(e: Engine, rng: () => number): PlannedRow {
  const t = e.elapsed;
  const v = speedAt(t);
  const ext = maxExtents(e.aspect);
  const two = rng() < Math.min(0.7, pairChanceAt(t) + (e.chase ? CHASE_PAIR_BONUS : 0));
  const clear = ext.ahead + ext.behind + e.lastStagger;
  for (let attempt = 0; attempt < 12; attempt++) {
    let lanes: number[];
    if (two) {
      const free = Math.floor(rng() * 3);
      lanes = LANES.filter((l) => l !== free);
    } else lanes = [rng() < 0.4 ? e.lane : Math.floor(rng() * 3)];
    const free = LANES.filter((l) => !lanes.includes(l));
    // Aus JEDER Spur, in der der Spieler die letzte Reihe überstanden haben kann, muss ein Ausweg mit höchstens einem Spurwechsel existieren.
    if (!e.reach.every((p) => free.includes(p) || free.some((f) => Math.abs(p - f) === 1)))
      continue;
    const mustSwitch = e.reach.some((p) => !free.includes(p));
    const stagger = lanes.length === 2 ? rng() * STAGGER_MAX : 0;
    const switchGap = (clear + ext.player + v * reactionMsAt(t)) * SAFETY;
    let gap = Math.max(baseGapAt(t), clear + 0.08);
    if (mustSwitch) gap = Math.max(gap, switchGap);
    const reach = free;
    return { lanes, stagger, gap, reach };
  }
  // Rückfall: ein einzelnes Auto lässt immer zwei Spuren frei; mit Wechselabstand ist jede Spur erreichbar.
  const blocked = Math.floor(rng() * 3);
  return {
    lanes: [blocked],
    stagger: 0,
    gap: Math.max(baseGapAt(t), (clear + ext.player + v * reactionMsAt(t)) * SAFETY),
    reach: LANES.filter((l) => l !== blocked),
  };
}

/** Ein Spielschritt. Gibt true zurück, wenn sich die Hitboxen berühren. */
export function stepEngine(
  e: Engine,
  dt: number,
  rng: () => number = Math.random,
  spawn = true,
): boolean {
  e.elapsed += dt;
  const dy = speedAt(e.elapsed) * dt;
  for (const ob of e.obstacles) ob.y += dy;
  e.sinceRow += dy;
  if (spawn) {
    e.pending ??= planRow(e, rng);
    if (e.sinceRow >= e.pending.gap) {
      const row = e.pending;
      const y = e.sinceRow - row.gap;
      row.lanes.forEach((lane, i) => {
        const r = rng();
        const variant: ObstacleVariant = e.chase
          ? r < CHASE_POLICE_SHARE ? "police" : r < (1 + CHASE_POLICE_SHARE) / 2 ? "cyan" : "pink"
          : r > 0.5 ? "cyan" : "pink";
        e.obstacles.push({
          lane,
          y: y - (i === 1 ? row.stagger : 0),
          width: 36,
          height: 60,
          color: COLORS[variant],
          variant,
        });
      });
      e.sinceRow = y;
      e.lastStagger = row.stagger;
      e.reach = row.reach;
      e.pending = null;
    }
  }
  e.obstacles = e.obstacles.filter((ob) => ob.y < 1.15);
  e.x = e.lane + (e.x - e.lane) * Math.exp((-LANE_EASE * dt) / 1000);
  if (Math.abs(e.x - e.lane) < 0.002) e.x = e.lane;
  const me = playerBox(e);
  if (e.obstacles.some((ob) => overlaps(me, obstacleBox(e, ob)))) return true;
  e.score += dt * 0.035;
  return false;
}

/** Polizeijagd nach Spielzeit starten/beenden (nach stepEngine aufrufen). */
export function updateChase(e: Engine): "start" | "end" | null {
  if (!e.chase && e.elapsed >= e.nextChaseAt) {
    e.chase = true;
    e.chaseStart = e.elapsed;
    return "start";
  }
  if (e.chase && e.elapsed >= e.chaseStart + CHASE_MS) {
    e.chase = false;
    e.nextChaseAt = e.elapsed + CHASE_PAUSE_MS;
    return "end";
  }
  return null;
}
