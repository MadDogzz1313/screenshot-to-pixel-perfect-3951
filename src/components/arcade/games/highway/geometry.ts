/**
 * Neon Highway – gemeinsame Geometrie für Spiellogik und Grafik (ohne three.js).
 * Die Werte sind exakt die bisherigen Grafikwerte; die Spiellogik leitet daraus die Hitboxen ab,
 * damit Kollisionen genau dort passieren, wo die sichtbaren Karosserien sich berühren.
 */
export type HighwayView = "chase" | "high";
export type CarVariant = "player" | "cyan" | "pink";

export const LANE_W = 3.2;
export const ROAD_HALF = 5.4;
export const DEPTH = 46;
export const PLAYER_Y = 0.92;
export const CAR_W = 2.3;
export const BASE_Y = 0.05;
export const laneX = (lane: number) => (lane - 1) * LANE_W;
export const zOf = (y: number) => -(PLAYER_Y - y) * DEPTH;

// aspect = Höhe/Breite des Bildes, lean = Blickwinkel des Bildes (Grad über dem Boden).
export const SHAPES: Record<CarVariant, Record<HighwayView, { aspect: number; lean: number }>> = {
  player: { chase: { aspect: 326 / 512, lean: 12 }, high: { aspect: 509 / 512, lean: 52 } },
  cyan: { chase: { aspect: 264 / 384, lean: 12 }, high: { aspect: 616 / 384, lean: 72 } },
  pink: { chase: { aspect: 266 / 384, lean: 12 }, high: { aspect: 697 / 384, lean: 80 } },
};

export const CAMERA: Record<
  HighwayView,
  {
    fov: number;
    halfW: number;
    height: (d: number) => number;
    back: (d: number) => number;
    pitch: number;
  }
> = {
  chase: { fov: 60, halfW: 5.0, height: (d) => 0.32 * d + 1.2, back: (d) => d, pitch: 8 },
  high: { fov: 64, halfW: 6.8, height: (d) => 0.78 * d, back: (d) => 0.95 * d, pitch: 24 },
};

/** Kameraabstand wie im Renderer (abhängig vom Seitenverhältnis des iPhone-Bildschirms). */
export function cameraFor(view: HighwayView, aspect: number) {
  const cfg = CAMERA[view];
  const t = Math.tan((cfg.fov / 2) * (Math.PI / 180));
  const d = Math.min(22, Math.max(8, cfg.halfW / (t * aspect)));
  return { height: cfg.height(d), back: cfg.back(d) };
}

/**
 * Sichtbare Karosserie aus den Bildern gemessen (Deckkraft > 40 %, ohne transparente Ränder, Glow und Unterbodenlicht):
 * width = Anteil der Bildbreite, body = Zeilenbereich der Karosserie im Draufsicht-Bild (0 = unten/Heck, 1 = oben/Front).
 */
const BODY: Record<CarVariant, { width: number; rear: number; front: number }> = {
  player: { width: 0.93, rear: 0.02, front: 0.985 },
  cyan: { width: 0.91, rear: 0.03, front: 0.98 },
  pink: { width: 0.94, rear: 0.02, front: 0.985 },
};

export type Box = { left: number; right: number; front: number; rear: number };

const planeOffset = (variant: CarVariant, view: HighwayView) => {
  const s = SHAPES[variant][view];
  const h = CAR_W * s.aspect;
  const lean = (s.lean * Math.PI) / 180;
  return { h, lean, offset: (h * Math.sin(lean)) / 2 };
};
/** Renderer-Versatz der Bildebene (Fahrzeugmitte -> Bildunterkante). */
export const spriteOffset = (variant: CarVariant, view: HighwayView) =>
  planeOffset(variant, view).offset;

/** Punkt der schrägen Bildebene auf den Boden projizieren (so erscheint er auf dem Bildschirm). */
const project = (z: number, y: number, cam: { height: number; back: number }) =>
  cam.back + (z - cam.back) * (cam.height / Math.max(0.5, cam.height - y));

/** Länge Heck->Front entlang der Fahrbahn, wie sie in der Draufsicht sichtbar ist. */
function highExtent(variant: CarVariant, zCenter: number, cam: { height: number; back: number }) {
  const { h, lean, offset } = planeOffset(variant, "high");
  const b = BODY[variant];
  const at = (f: number) =>
    project(zCenter + offset - f * h * Math.sin(lean), BASE_Y + f * h * Math.cos(lean), cam);
  return { rear: at(b.rear), front: at(b.front) };
}

/**
 * Hitbox eines Fahrzeugs in Weltkoordinaten (x quer, z längs; negative z = weiter vorne).
 * - Ansicht „Oben“: Heck/Front der sichtbaren Karosserie in der Draufsicht.
 * - Ansicht „Heck“: Heckansicht steht an der Fahrzeugposition; die Länge entspricht der Draufsicht-Karosserie.
 */
export function carBox(
  variant: CarVariant,
  view: HighwayView,
  x: number,
  zCenter: number,
  aspect: number,
): Box {
  const half = (CAR_W * BODY[variant].width) / 2;
  const high = highExtent(variant, zCenter, cameraFor("high", aspect));
  if (view === "high")
    return { left: x - half, right: x + half, rear: high.rear, front: high.front };
  const length = high.rear - high.front;
  const rear = zCenter + spriteOffset(variant, "chase");
  return { left: x - half, right: x + half, rear, front: rear - length };
}

export const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.front < b.rear && b.front < a.rear;

/** Größte Ausdehnung (in Spiel-y-Einheiten) vor bzw. hinter der Fahrzeugmitte über beide Ansichten – für faire Abstände. */
export function maxExtents(aspect: number) {
  let ahead = 0;
  let behind = 0;
  let player = 0;
  for (const view of ["chase", "high"] as const) {
    for (const v of ["cyan", "pink"] as const) {
      const box = carBox(v, view, 0, 0, aspect);
      ahead = Math.max(ahead, -box.front / DEPTH);
      behind = Math.max(behind, box.rear / DEPTH);
    }
    const p = carBox("player", view, 0, 0, aspect);
    player = Math.max(player, (p.rear - p.front) / DEPTH);
  }
  return { ahead, behind, player };
}
