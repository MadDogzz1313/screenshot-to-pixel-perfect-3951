/**
 * Neon Highway – WebGL-Grafik (nur Darstellung).
 * Liest den Spielzustand (lane, obstacles[].lane/y, elapsed) und zeichnet ihn in 2.5D.
 * Verändert den Zustand nie: Spurwechsel-Animation, Kamera und Effekte sind rein visuell.
 */
import * as THREE from "three";
import playerRearUrl from "@/assets/highway/player-rear.webp";
import playerHighUrl from "@/assets/highway/player-high.webp";
import cyanRearUrl from "@/assets/highway/cyan-rear.webp";
import cyanHighUrl from "@/assets/highway/cyan-high.webp";
import pinkRearUrl from "@/assets/highway/pink-rear.webp";
import pinkHighUrl from "@/assets/highway/pink-high.webp";
import skylineUrl from "@/assets/highway/skyline.webp";
import palmUrl from "@/assets/highway/palm.webp";

export type HighwayView = "chase" | "high";
export type HighwayFrame = {
  lane: number;
  obstacles: readonly { lane: number; y: number; color: string }[];
  elapsed: number;
};
export interface HighwayRenderer {
  resize(width: number, height: number, dpr: number): void;
  setView(view: HighwayView): void;
  render(frame: HighwayFrame): void;
  dispose(): void;
}

// Abbildung der Spiel-Koordinaten (y 0 = Horizont-Spawn, Kollision bei y .82–1.02) auf die 3D-Straße.
const LANE_W = 3.2;
const ROAD_HALF = 5.4;
const DEPTH = 46;
const PLAYER_Y = 0.92;
const CAR_W = 2.3;
const SCROLL_PER_MS = 0.03;
const FOG = "#9e216e";
const laneX = (lane: number) => (lane - 1) * LANE_W;
const zOf = (y: number) => -(PLAYER_Y - y) * DEPTH;

type Variant = "player" | "cyan" | "pink";
type Asset = { url: string; aspect: number; lean: number };
// aspect = Höhe/Breite des Bildes, lean = Blickwinkel des Bildes (Grad über dem Boden).
const ASSETS: Record<Variant, Record<HighwayView, Asset>> = {
  player: {
    chase: { url: playerRearUrl, aspect: 326 / 512, lean: 12 },
    high: { url: playerHighUrl, aspect: 509 / 512, lean: 52 },
  },
  cyan: {
    chase: { url: cyanRearUrl, aspect: 264 / 384, lean: 12 },
    high: { url: cyanHighUrl, aspect: 616 / 384, lean: 72 },
  },
  pink: {
    chase: { url: pinkRearUrl, aspect: 266 / 384, lean: 12 },
    high: { url: pinkHighUrl, aspect: 697 / 384, lean: 80 },
  },
};
const GLOW: Record<Variant, string> = { player: "#ff2e97", cyan: "#22e4f2", pink: "#ff6aa9" };

const CAMERA: Record<
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

const groundVert = /* glsl */ `
varying vec3 vW; varying float vDepth;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const groundFrag = /* glsl */ `
uniform float uScroll; uniform float uRoadHalf; uniform float uFogNear; uniform float uFogFar; uniform vec3 uFog;
varying vec3 vW; varying float vDepth;
float lineMask(float d, float w) { float aa = fwidth(d) + 1e-4; return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
void main() {
  float x = vW.x; float ax = abs(x); float z = vW.z + uScroll;
  float edge = uRoadHalf - 0.25;
  // Straße
  vec3 road = vec3(0.06, 0.03, 0.12) + vec3(0.32, 0.06, 0.30) * smoothstep(15.0, 150.0, vDepth) * 0.55;
  road += vec3(1.0, 0.45, 0.35) * 0.22 * exp(-ax * 0.45) * smoothstep(25.0, 180.0, vDepth);
  float dash = step(0.45, fract(z / 5.0));
  road = mix(road, vec3(0.13, 0.89, 0.95), lineMask(ax - 1.6, 0.07) * dash);
  road = mix(road, vec3(1.0, 0.18, 0.59), lineMask(ax - edge, 0.12));
  road += vec3(1.0, 0.18, 0.59) * 0.35 * exp(-abs(ax - edge) * 3.0);
  // Synthwave-Gitter neben der Straße
  vec2 g = vec2(x, z) / 4.0; vec2 fw = fwidth(g) + 1e-4;
  vec2 f = abs(fract(g - 0.5) - 0.5) / fw;
  float grid = (1.0 - min(min(f.x, f.y), 1.0)) * (1.0 - smoothstep(70.0, 200.0, vDepth));
  vec3 side = vec3(0.05, 0.01, 0.09) + vec3(0.95, 0.16, 0.78) * grid * 0.85;
  side = mix(side, vec3(0.13, 0.89, 0.95), lineMask(ax - uRoadHalf - 0.12, 0.06));
  vec3 col = mix(road, side, step(uRoadHalf, ax));
  gl_FragColor = vec4(mix(col, uFog, smoothstep(uFogNear, uFogFar, vDepth)), 1.0);
}`;
const skyVert = /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const skyFrag = /* glsl */ `
uniform float uTime; uniform vec3 uFog; varying vec3 vW;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float h = clamp(vW.y / 260.0, 0.0, 1.0);
  vec3 col = mix(uFog, vec3(1.0, 0.42, 0.42), smoothstep(0.0, 0.05, h));
  col = mix(col, vec3(0.36, 0.07, 0.43), smoothstep(0.05, 0.32, h));
  col = mix(col, vec3(0.04, 0.015, 0.12), smoothstep(0.32, 0.85, h));
  vec2 cell = floor(vW.xy / 4.0); vec2 inCell = fract(vW.xy / 4.0) - 0.5;
  float star = step(0.985, hash(cell)) * (1.0 - smoothstep(0.08, 0.16, length(inCell))) * smoothstep(0.28, 0.6, h);
  col += star * (0.55 + 0.45 * sin(uTime * 2.0 + hash(cell + 1.0) * 6.283));
  vec2 sc = vec2(0.0, 46.0); float r = 34.0;
  float dist = length(vW.xy - sc);
  float t = clamp((vW.y - (sc.y - r)) / (2.0 * r), 0.0, 1.0);
  vec3 sun = mix(vec3(1.0, 0.84, 0.18), vec3(1.0, 0.18, 0.59), t);
  float rel = (sc.y - vW.y) / r;
  float ph = fract((rel + uTime * 0.03) / 0.15);
  float gap = 0.06 + 0.5 * clamp(rel, 0.0, 1.0);
  float aa = fwidth(ph) + 1e-4;
  float stripe = mix(1.0, smoothstep(gap - aa, gap + aa, ph), step(0.0, rel));
  float disc = (1.0 - smoothstep(r - 0.5, r + 0.5, dist)) * stripe;
  col = mix(col, sun, disc);
  col += vec3(1.0, 0.3, 0.55) * 0.38 * exp(-max(dist - r, 0.0) / 20.0) * (1.0 - disc);
  gl_FragColor = vec4(col, 1.0);
}`;

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHighwayRenderer(
  canvas: HTMLCanvasElement,
  initialView: HighwayView,
): HighwayRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor("#0B0418");
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 30, 220);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 900);
  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T) => {
    disposables.push(item);
    return item;
  };
  const texture = (url: string) => {
    const tex = track(loader.load(url));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };
  const fogColor = new THREE.Vector3(0x9e / 255, 0x21 / 255, 0x6e / 255);

  // Himmel mit Retro-Sonne + Sterne
  const skyTime = { value: 0 };
  const groundScroll = { value: 0 };
  const skyMat = track(
    new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: { uTime: skyTime, uFog: { value: fogColor } },
      depthWrite: false,
      fog: false,
    }),
  );
  const sky = new THREE.Mesh(track(new THREE.PlaneGeometry(1600, 560)), skyMat);
  sky.position.set(0, 220, -340);
  sky.renderOrder = -2;
  scene.add(sky);

  // Skyline (lokales Asset, wiederholt)
  const skyTex = texture(skylineUrl);
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.repeat.set(450 / (30 * (1024 / 456)), 1);
  const skyline = new THREE.Mesh(
    track(new THREE.PlaneGeometry(450, 30)),
    track(
      new THREE.MeshBasicMaterial({
        map: skyTex,
        transparent: true,
        alphaTest: 0.05,
        fog: false,
        color: new THREE.Color(0.9, 0.8, 1),
      }),
    ),
  );
  skyline.position.set(0, 13, -300);
  scene.add(skyline);

  // Boden: Straße + Gitter
  const groundMat = track(
    new THREE.ShaderMaterial({
      vertexShader: groundVert,
      fragmentShader: groundFrag,
      uniforms: {
        uScroll: groundScroll,
        uRoadHalf: { value: ROAD_HALF },
        uFogNear: { value: 30 },
        uFogFar: { value: 220 },
        uFog: { value: fogColor },
      },
      fog: false,
    }),
  );
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(420, 360)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -150);
  scene.add(ground);

  // Palmen am Straßenrand
  const palmMat = track(
    new THREE.SpriteMaterial({ map: texture(palmUrl), alphaTest: 0.35, fog: true }),
  );
  const PALM_GAP = 16;
  const PALM_COUNT = 11;
  const palms: THREE.Sprite[] = [];
  for (let i = 0; i < PALM_COUNT * 2; i++) {
    const s = new THREE.Sprite(palmMat);
    s.center.set(0.5, 0);
    s.scale.set(3.9, 7.3, 1);
    palms.push(s);
    scene.add(s);
  }

  // Autos: je Variante ein Modell pro Kamera-Ansicht + Neon-Unterbodenlicht
  const glowTex = track(glowTexture());
  const glowGeo = track(new THREE.PlaneGeometry(3.2, 5.4));
  const bodyGeos = new Map<string, THREE.PlaneGeometry>();
  const bodyMats = new Map<string, THREE.MeshBasicMaterial>();
  const glowMats: Record<Variant, THREE.MeshBasicMaterial> = {
    player: track(
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: GLOW.player,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
    cyan: track(
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: GLOW.cyan,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
    pink: track(
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: GLOW.pink,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  };
  type Car = {
    group: THREE.Group;
    bodies: Record<HighwayView, THREE.Mesh>;
    offsets: Record<HighwayView, number>;
  };
  const makeCar = (variant: Variant): Car => {
    const group = new THREE.Group();
    const glow = new THREE.Mesh(glowGeo, glowMats[variant]);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    group.add(glow);
    const bodies = {} as Record<HighwayView, THREE.Mesh>;
    const offsets = {} as Record<HighwayView, number>;
    for (const view of ["chase", "high"] as const) {
      const a = ASSETS[variant][view];
      const key = `${variant}-${view}`;
      const h = CAR_W * a.aspect;
      const lean = THREE.MathUtils.degToRad(a.lean);
      let geo = bodyGeos.get(key);
      if (!geo) {
        geo = track(new THREE.PlaneGeometry(CAR_W, h));
        geo.translate(0, h / 2, 0);
        bodyGeos.set(key, geo);
      }
      let mat = bodyMats.get(key);
      if (!mat) {
        mat = track(
          new THREE.MeshBasicMaterial({ map: texture(a.url), alphaTest: 0.4, fog: true }),
        );
        bodyMats.set(key, mat);
      }
      const body = new THREE.Mesh(geo, mat);
      body.rotation.x = -lean;
      body.position.y = 0.05;
      bodies[view] = body;
      offsets[view] = (h * Math.sin(lean)) / 2;
      group.add(body);
    }
    scene.add(group);
    return { group, bodies, offsets };
  };
  const player = makeCar("player");
  const pools: Record<"cyan" | "pink", Car[]> = { cyan: [], pink: [] };

  let view: HighwayView = initialView;
  let aspect = 1;
  let visualX = laneX(1);
  let lastRender = 0;
  const target = new THREE.Vector3();
  const placeCamera = () => {
    const cfg = CAMERA[view];
    camera.fov = cfg.fov;
    camera.aspect = aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(cfg.fov / 2));
    const d = THREE.MathUtils.clamp(cfg.halfW / (t * aspect), 8, 22);
    const height = cfg.height(d);
    const back = cfg.back(d);
    camera.position.set(visualX * 0.18, height, back);
    const ahead = 30;
    target.set(
      visualX * 0.1,
      height - Math.tan(THREE.MathUtils.degToRad(cfg.pitch)) * (back + ahead),
      -ahead,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  const applyView = (car: Car) => {
    car.bodies.chase.visible = view === "chase";
    car.bodies.high.visible = view === "high";
  };
  const placeCar = (car: Car, x: number, zCenter: number) => {
    car.group.position.set(x, 0, zCenter + car.offsets[view]);
  };

  return {
    resize(width, height, dpr) {
      if (!width || !height) return;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      aspect = width / height;
      placeCamera();
    },
    setView(next) {
      view = next;
      placeCamera();
    },
    render(frame) {
      const now = performance.now();
      const gap = now - lastRender;
      lastRender = now;
      const goal = laneX(frame.lane);
      visualX = gap > 200 ? goal : goal + (visualX - goal) * Math.exp(-18 * (gap / 1000));
      const scroll = frame.elapsed * SCROLL_PER_MS;
      groundScroll.value = scroll;
      skyTime.value = now / 1000;
      placeCamera();
      applyView(player);
      placeCar(player, visualX, 0);
      player.group.rotation.z = (visualX - goal) * 0.04;
      const used = { cyan: 0, pink: 0 };
      for (const ob of frame.obstacles) {
        const variant = ob.color.toLowerCase() === "#22e4f2" ? "cyan" : "pink";
        const pool = pools[variant];
        const car = pool[used[variant]] ?? (pool[used[variant]] = makeCar(variant));
        used[variant]++;
        car.group.visible = true;
        applyView(car);
        placeCar(car, laneX(ob.lane), zOf(ob.y));
      }
      for (const variant of ["cyan", "pink"] as const)
        for (const car of pools[variant].slice(used[variant])) car.group.visible = false;
      const span = PALM_GAP * PALM_COUNT;
      palms.forEach((s, i) => {
        const k = i >> 1;
        const side = i % 2 ? 1 : -1;
        const z =
          14 - ((((k * PALM_GAP + (side > 0 ? PALM_GAP / 2 : 0) - scroll) % span) + span) % span);
        s.position.set(side * (ROAD_HALF + 3.4), 0, z);
      });
      renderer.render(scene, camera);
    },
    dispose() {
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
