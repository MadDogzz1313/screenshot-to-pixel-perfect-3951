/**
 * Neon Highway – Touch-Gesten (reine Logik, testbar).
 * Jeder Finger (pointerId) ist eine eigene Geste und löst höchstens EINEN Spurwechsel aus:
 * - Wischen: sobald die waagrechte Strecke die Schwelle überschreitet (sofort, ohne auf das Loslassen zu warten).
 * - Kurzes, schnelles Wischen (Flick) wird beim Loslassen erkannt.
 * - Senkrechtes Wischen wird ignoriert.
 * - Antippen (kaum Bewegung) = bisherige Steuerung: linke Hälfte links, rechte Hälfte rechts.
 */
export type Direction = -1 | 1;
export const GESTURE = {
  swipe: 22,
  flick: 12,
  flickSpeed: 0.25,
  tapSlop: 10,
  tapMs: 450,
  ratio: 1.2,
} as const;
type Track = { x0: number; y0: number; t0: number; done: boolean; vertical: boolean };

export class LaneGestures {
  private tracks = new Map<number, Track>();

  down(id: number, x: number, y: number, t: number) {
    this.tracks.set(id, { x0: x, y0: y, t0: t, done: false, vertical: false });
  }

  move(id: number, x: number, y: number): Direction | 0 {
    const g = this.tracks.get(id);
    if (!g || g.done || g.vertical) return 0;
    const dx = x - g.x0;
    const dy = y - g.y0;
    if (Math.abs(dy) >= GESTURE.swipe && Math.abs(dy) > Math.abs(dx) * GESTURE.ratio) {
      g.vertical = true;
      return 0;
    }
    if (Math.abs(dx) >= GESTURE.swipe && Math.abs(dx) >= Math.abs(dy) * GESTURE.ratio) {
      g.done = true;
      return dx > 0 ? 1 : -1;
    }
    return 0;
  }

  /** tapSide: Richtung für einen Tipp an der Startposition x0. */
  up(
    id: number,
    x: number,
    y: number,
    t: number,
    tapSide: (x0: number) => Direction,
  ): Direction | 0 {
    const g = this.tracks.get(id);
    this.tracks.delete(id);
    if (!g || g.done || g.vertical) return 0;
    const dx = x - g.x0;
    const dy = y - g.y0;
    const ms = Math.max(1, t - g.t0);
    if (
      Math.abs(dx) >= GESTURE.flick &&
      Math.abs(dx) >= Math.abs(dy) * GESTURE.ratio &&
      Math.abs(dx) / ms >= GESTURE.flickSpeed
    )
      return dx > 0 ? 1 : -1;
    if (Math.hypot(dx, dy) <= GESTURE.tapSlop && ms <= GESTURE.tapMs) return tapSide(g.x0);
    return 0;
  }

  cancel(id: number) {
    this.tracks.delete(id);
  }
  reset() {
    this.tracks.clear();
  }
}
