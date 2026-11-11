import { describe, expect, it } from "vitest";
import { carBox, laneX, overlaps, zOf, CAR_W, LANE_W } from "./geometry";
import {
  baseGapAt,
  createEngine,
  difficulty,
  moveLane,
  obstacleBox,
  playerBox,
  resetRound,
  speedAt,
  stepEngine,
  type Engine,
  type Obstacle,
} from "./engine";

const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const fresh = (view: Engine["view"] = "chase", aspect = 390 / 640) => {
  const e = createEngine();
  e.view = view;
  e.aspect = aspect;
  resetRound(e, 0);
  return e;
};
const ob = (lane: number, y: number, variant: Obstacle["variant"] = "pink"): Obstacle => ({
  lane,
  y,
  width: 36,
  height: 60,
  color: variant === "pink" ? "#ff6aa9" : "#22e4f2",
  variant,
});
const IPHONES = [320 / 500, 375 / 560, 390 / 640, 430 / 760, 440 / 800];

/**
 * Spielt mit 16-ms-Frames wie ein Mensch: sieht nur die vorhandenen Autos, reagiert erst nach `reactionMs`
 * und wischt höchstens alle 192 ms. Plant per Tiefensuche (zuerst „Spur halten“) ca. 2,3 s voraus.
 */
function botRun(seed: number, ms: number, view: Engine["view"], aspect: number, reactionMs = 200) {
  const rng = seeded(seed);
  const e = fresh(view, aspect);
  const queue: { at: number; dir: -1 | 1 }[] = [];
  let lastDecision = -1e9;
  const STEP = 6; // 6 × 16 ms = 96 ms
  const delay = Math.ceil(reactionMs / 16); // Reaktionszeit in Frames (200 ms -> 208 ms)
  const advance = (s: Engine, frames: number) => {
    for (let i = 0; i < frames; i++) if (stepEngine(s, 16, rng, false)) return false;
    return true;
  };
  // Plan mit möglichst wenigen Spurwechseln, die so früh wie möglich erfolgen (wie ein vorausschauender Mensch).
  const plan = (s: Engine, depth: number, moves: number, cooldown: number): boolean => {
    if (depth === 0) return true;
    for (const a of [-1, 1, 0] as const) {
      if (a && (moves === 0 || cooldown > 0 || s.lane + a < 0 || s.lane + a > 2)) continue;
      const c = structuredClone(s);
      if (a) moveLane(c, a);
      if (
        advance(c, STEP) &&
        plan(c, depth - 1, a ? moves - 1 : moves, a ? 1 : Math.max(0, cooldown - 1))
      )
        return true;
    }
    return false;
  };
  while (e.elapsed < ms) {
    if (!queue.length && e.elapsed - lastDecision >= 96) {
      lastDecision = e.elapsed;
      const future = structuredClone(e);
      if (advance(future, delay) && !plan(future, 24, 0, 0)) {
        for (let moves = 1; moves <= 3; moves++) {
          const a = ([-1, 1, 0] as const).find((d) => {
            if (d && (future.lane + d < 0 || future.lane + d > 2)) return false;
            const c = structuredClone(future);
            if (d) moveLane(c, d);
            return advance(c, STEP) && plan(c, 23, d ? moves - 1 : moves, d ? 1 : 0);
          });
          if (a !== undefined) {
            if (a) queue.push({ at: e.elapsed + delay * 16, dir: a });
            break;
          }
        }
      }
    }
    if (queue[0] && e.elapsed >= queue[0].at) moveLane(e, queue.shift()!.dir);
    if (stepEngine(e, 16, rng)) return { crashed: true, at: e.elapsed };
  }
  return { crashed: false, at: e.elapsed };
}

describe("Neon Highway – Schwierigkeit", () => {
  it("steigt langsam, stetig und begrenzt", () => {
    let prevV = 0;
    let prevGap = 1;
    for (let t = 0; t <= 600_000; t += 1000) {
      const v = speedAt(t);
      const g = baseGapAt(t);
      expect(v).toBeGreaterThanOrEqual(prevV);
      expect(g).toBeLessThanOrEqual(prevGap);
      if (t) {
        expect(v - prevV).toBeLessThan(0.000002);
        expect(prevGap - g).toBeLessThan(0.003);
      } // keine Sprünge pro Sekunde
      prevV = v;
      prevGap = g;
    }
    expect(difficulty(0)).toBe(0);
    expect(speedAt(600_000)).toBeLessThan(0.000311);
  });
  it("startet mit deutlich größeren Abständen als bisher (alle 650 ms)", () => {
    const e = fresh();
    const spawnTimes: number[] = [];
    let count = 0;
    const rng = seeded(7);
    while (e.elapsed < 20_000) {
      stepEngine(e, 16, rng, true);
      const n = e.obstacles.length;
      if (n > count) spawnTimes.push(e.elapsed);
      count = n;
      if (e.obstacles.length)
        e.obstacles.forEach((o) => {
          o.y = Math.min(o.y, 0.5);
        });
    }
    expect(spawnTimes[0]).toBeGreaterThan(1000);
    const gaps = spawnTimes.slice(1).map((t, i) => t - spawnTimes[i]!);
    expect(Math.min(...gaps)).toBeGreaterThan(1800);
  });
});

describe("Neon Highway – faire Spawns", () => {
  it("nie alle Spuren blockiert, keine Überlappung in einer Spur, immer erreichbare Spur", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rng = seeded(seed);
      const e = fresh("high");
      while (e.elapsed < 300_000) {
        stepEngine(e, 16, rng, true);
        expect(e.reach.length).toBeGreaterThan(0);
        const sorted = [...e.obstacles].sort((a, b) => a.y - b.y);
        for (let i = 0; i < sorted.length; i++)
          for (let j = i + 1; j < sorted.length; j++) {
            const a = sorted[i]!;
            const b = sorted[j]!;
            if (Math.abs(a.y - b.y) < 0.05) expect(a.lane).not.toBe(b.lane);
            if (a.lane === b.lane)
              expect(overlaps(obstacleBox(e, a), obstacleBox(e, b))).toBe(false);
          }
        // eine "Wand" (alle drei Spuren auf gleicher Höhe) gibt es nie
        for (const a of e.obstacles)
          expect(
            new Set(e.obstacles.filter((b) => Math.abs(b.y - a.y) < 0.12).map((b) => b.lane)).size,
          ).toBeLessThan(3);
      }
    }
  }, 120_000);
  it("ein Bot mit 200 ms Reaktionszeit überlebt 5 Minuten in beiden Ansichten und auf allen iPhone-Formaten", () => {
    let runs = 0;
    for (const view of ["chase", "high"] as const)
      for (const aspect of IPHONES)
        for (let seed = 1; seed <= 4; seed++) {
          const r = botRun(seed * 31 + Math.round(aspect * 100), 300_000, view, aspect);
          expect(
            r,
            `${view} ${aspect.toFixed(2)} seed ${seed} crashte bei ${Math.round(r.at / 1000)}s`,
          ).toEqual({ crashed: false, at: expect.any(Number) });
          runs++;
        }
    expect(runs).toBe(40);
  }, 120_000);
  it("wird mit der Zeit dichter (mehr Autos pro Minute)", () => {
    const rng = seeded(3);
    const e = fresh();
    let early = 0;
    let late = 0;
    let prev = 0;
    while (e.elapsed < 240_000) {
      stepEngine(e, 16, rng, true);
      const n = e.obstacles.length;
      const spawned = Math.max(0, n - prev);
      if (e.elapsed < 60_000) early += spawned;
      else if (e.elapsed > 180_000) late += spawned;
      prev = e.obstacles.length;
    }
    expect(late).toBeGreaterThan(early * 1.6);
  });
});

describe("Neon Highway – Hitboxen", () => {
  for (const view of ["chase", "high"] as const)
    for (const aspect of IPHONES) {
      it(`Nachbarspur kollidiert nie (${view}, ${aspect.toFixed(2)})`, () => {
        const e = fresh(view, aspect);
        for (let y = 0.6; y < 1.15; y += 0.005) {
          e.obstacles = [ob(0, y), ob(2, y, "cyan")];
          expect(overlaps(playerBox(e), obstacleBox(e, e.obstacles[0]!))).toBe(false);
          expect(overlaps(playerBox(e), obstacleBox(e, e.obstacles[1]!))).toBe(false);
        }
      });
      it(`gleiche Spur: Kollision genau bei Berührung der Karosserien (${view}, ${aspect.toFixed(2)})`, () => {
        const e = fresh(view, aspect);
        const me = playerBox(e);
        for (const variant of ["pink", "cyan"] as const) {
          let firstHit = -1;
          for (let y = 0.6; y < 1.0; y += 0.0005) {
            const b = obstacleBox(e, ob(1, y, variant));
            if (overlaps(me, b)) {
              firstHit = y;
              break;
            }
          }
          expect(firstHit).toBeGreaterThan(0);
          const b = obstacleBox(e, ob(1, firstHit, variant));
          expect(b.rear - me.front).toBeLessThan(0.05); // Heck des Gegners berührt gerade die Front des Spielers
          expect(b.rear - me.front).toBeGreaterThan(0);
          expect(zOf(firstHit)).toBeLessThan(-2.5); // nicht erst, wenn die Autos ineinander stecken
        }
      });
    }
  it("Breite = sichtbare Karosserie, kein Glow/Rand", () => {
    const p = carBox("player", "chase", 0, 0, 0.6);
    expect(p.right - p.left).toBeLessThan(CAR_W);
    expect(p.right - p.left).toBeGreaterThan(CAR_W * 0.85);
    expect(LANE_W - (p.right - p.left)).toBeGreaterThan(0.9);
  });
  it("Spurwechsel nutzt die echte, gleitende Position: kein Treffer direkt nach dem Wischen, kein Durchfahren danach", () => {
    for (const view of ["chase", "high"] as const) {
      const e = fresh(view);
      const blocker = ob(2, 0.95, "pink");
      e.obstacles = [blocker];
      moveLane(e, 1); // Ziel Spur 2, Auto steht neben dem Spieler
      expect(stepEngine(e, 16, seeded(1), false)).toBe(false); // noch in Spur 1 -> noch keine Kollision (früher sofort)
      let hit = false;
      for (let i = 0; i < 20 && !hit; i++) {
        blocker.y = 0.95;
        hit = stepEngine(e, 16, seeded(1), false);
      }
      expect(hit).toBe(true); // sobald die Karosserien sich überschneiden
      expect(e.x).toBeGreaterThan(1.3);
      expect(e.x).toBeLessThan(1.8);
    }
  });
  it("Gegner, der gerade überholt wurde, zählt nicht mehr", () => {
    const e = fresh("high");
    e.obstacles = [ob(2, 1.12, "pink")];
    moveLane(e, 1);
    for (let i = 0; i < 30; i++) {
      e.obstacles[0]!.y = 1.12;
      expect(stepEngine(e, 16, seeded(1), false)).toBe(false);
    }
    expect(laneX(e.x)).toBeCloseTo(laneX(2), 1);
  });
});

describe("Neon Highway – Spurbegrenzung und Punkte", () => {
  it("genau eine Spur pro Befehl, nie über den Rand", () => {
    const e = fresh();
    expect(moveLane(e, 1)).toBe(true);
    expect(e.lane).toBe(2);
    expect(moveLane(e, 1)).toBe(false);
    expect(e.lane).toBe(2);
    moveLane(e, -1);
    moveLane(e, -1);
    expect(e.lane).toBe(0);
    expect(moveLane(e, -1)).toBe(false);
    expect(e.lane).toBe(0);
    for (let i = 0; i < 60; i++) stepEngine(e, 16, seeded(2), false);
    expect(e.x).toBe(0);
  });
  it("Punkte wie bisher: 0,035 pro ms Fahrzeit", () => {
    const e = fresh();
    for (let i = 0; i < 100; i++) stepEngine(e, 10, seeded(1), false);
    expect(e.score).toBeCloseTo(35, 5);
    expect(e.elapsed).toBe(1000);
  });
  it("kein Spurwechsel außerhalb einer laufenden Runde", () => {
    const e = createEngine();
    expect(moveLane(e, 1)).toBe(false);
    expect(e.lane).toBe(1);
  });
});
