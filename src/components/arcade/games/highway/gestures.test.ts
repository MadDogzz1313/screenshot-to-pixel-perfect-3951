import { describe, expect, it } from "vitest";
import { LaneGestures } from "./gestures";

const side = (x0: number): -1 | 1 => (x0 < 200 ? -1 : 1);
/** Simuliert einen Finger mit vielen Zwischen-Events (wie iOS sie liefert). */
function swipe(g: LaneGestures, from: [number, number], to: [number, number], ms: number, id = 1) {
  const out: number[] = [];
  const steps = Math.max(2, Math.round(ms / 8));
  g.down(id, from[0], from[1], 0);
  for (let i = 1; i <= steps; i++) {
    const d = g.move(
      id,
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    );
    if (d) out.push(d);
  }
  const u = g.up(id, to[0], to[1], ms, side);
  if (u) out.push(u);
  return out;
}

describe("Neon Highway – Wischsteuerung", () => {
  it("rechts wischen = genau ein Spurwechsel nach rechts (auch bei langem Wisch)", () => {
    expect(swipe(new LaneGestures(), [100, 300], [180, 305], 120)).toEqual([1]);
    expect(swipe(new LaneGestures(), [20, 300], [380, 320], 400)).toEqual([1]);
  });
  it("links wischen = genau ein Spurwechsel nach links (auch auf der rechten Hälfte begonnen)", () => {
    expect(swipe(new LaneGestures(), [300, 300], [230, 296], 110)).toEqual([-1]);
  });
  it("kurzer schneller Flick wird erkannt", () => {
    expect(swipe(new LaneGestures(), [150, 300], [166, 302], 40)).toEqual([1]);
    expect(swipe(new LaneGestures(), [250, 300], [235, 301], 40)).toEqual([-1]);
  });
  it("senkrechtes Wischen löst nichts aus", () => {
    expect(swipe(new LaneGestures(), [150, 400], [160, 250], 150)).toEqual([]);
    expect(swipe(new LaneGestures(), [150, 200], [140, 420], 150)).toEqual([]);
  });
  it("Hin-und-her in einem Wisch bleibt ein einziger Wechsel", () => {
    const g = new LaneGestures();
    const out: number[] = [];
    g.down(1, 100, 300, 0);
    for (const x of [110, 130, 160, 120, 80, 40, 90, 160]) {
      const d = g.move(1, x, 300);
      if (d) out.push(d);
    }
    const u = g.up(1, 160, 300, 300, side);
    if (u) out.push(u);
    expect(out).toEqual([1]);
  });
  it("Antippen bleibt als alternative Steuerung erhalten (links/rechts)", () => {
    expect(swipe(new LaneGestures(), [80, 300], [83, 302], 90)).toEqual([-1]);
    expect(swipe(new LaneGestures(), [320, 300], [318, 299], 90)).toEqual([1]);
  });
  it("langsames, unklares Ziehen und langes Halten lösen nichts aus", () => {
    expect(swipe(new LaneGestures(), [150, 300], [166, 300], 600)).toEqual([]);
    expect(swipe(new LaneGestures(), [150, 300], [152, 300], 900)).toEqual([]);
  });
  it("zwei Finger sind getrennte Gesten, Abbruch verwirft", () => {
    const g = new LaneGestures();
    g.down(1, 80, 300, 0);
    g.down(2, 320, 300, 10);
    expect(g.up(1, 81, 300, 60, side)).toBe(-1);
    expect(g.up(2, 320, 301, 80, side)).toBe(1);
    g.down(3, 100, 300, 0);
    g.cancel(3);
    expect(g.up(3, 100, 300, 50, side)).toBe(0);
    expect(g.up(99, 100, 300, 50, side)).toBe(0);
  });
});
