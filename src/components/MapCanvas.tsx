import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { Plus, Minus, Maximize, Layers } from "lucide-react";
import mapImg from "@/assets/leonida-map.jpg";
import { categoryById, type Spot } from "@/lib/demo-data";

// Kartenbild: src/assets/leonida-map.jpg (827 × 1140). Bei Austausch Seitenverhältnis hier anpassen.
// Fundorte nutzen relative Koordinaten (x/y in % von Breite/Höhe des Bildes) und bleiben so beim Zoomen stabil.
const MAP_W = 827;
const MAP_H = 1140;
export const MAP_RATIO = MAP_W / MAP_H;
const MAX_SCALE = 8;
const PIN_ROOM = 32;

interface Props {
  spots: Spot[]; onSelect?: (s: Spot) => void;
  pick?: { x: number; y: number } | null; onPick?: (p: { x: number; y: number }) => void;
  className?: string;
  /** "card" = Karte im Neon-Rahmen (z. B. Beitrag). "floating" = rahmenlose Hauptkarte, füllt den verfügbaren Platz (Kartenseite). */
  variant?: "card" | "floating";
}

/** "Fit to Screen" (wie object-fit: contain): größte Kartengröße, die vollständig in den Rahmen passt. */
function fitSize(box: { w: number; h: number }) {
  return box.w / box.h > MAP_RATIO ? { w: box.h * MAP_RATIO, h: box.h } : { w: box.w, h: box.w / MAP_RATIO };
}

export function MapCanvas({ spots, onSelect, pick, onPick, className, variant = "card" }: Props) {
  const floating = variant === "floating";
  const [showPins, setShowPins] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ReactZoomPanPinchRef>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // Verfügbare Fläche messen (auch bei Drehen des iPhones / Öffnen des Filters).
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setBox((b) => (b && Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Hauptkarte: 2 × 16 px Luft oben/unten, damit Markierungen am Kartenrand nicht abgeschnitten werden.
  const fit = box ? fitSize(floating ? { w: box.w, h: Math.max(box.h - PIN_ROOM, 1) } : box) : null;
  // Neue Fläche -> wieder vollständige Ansicht.
  useEffect(() => { if (fit) zoomRef.current?.centerView(1, 0); }, [fit?.w, fit?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetView = () => zoomRef.current?.centerView(1, 250);

  const map = fit && (
    <TransformWrapper ref={zoomRef} minScale={1} maxScale={MAX_SCALE} initialScale={1} centerOnInit centerZoomedOut limitToBounds
      doubleClick={{ disabled: !!onPick, step: 0.8 }} wheel={{ step: 0.15 }} pinch={{ step: 5 }}
      onTransform={(_, s) => contentRef.current?.style.setProperty("--pin-scale", String(1 / s.scale))}>
      {({ zoomIn, zoomOut }) => (
        <>
          <TransformComponent wrapperClass="!w-full !h-full" wrapperStyle={{ touchAction: "none" }} contentStyle={{ width: fit.w, height: fit.h }}>
            <div ref={contentRef} data-testid="map-content" className="relative h-full w-full" style={{ ["--pin-scale" as string]: 1 }}
              onClick={(e) => {
                if (!onPick) return;
                const r = e.currentTarget.getBoundingClientRect();
                onPick({ x: +(((e.clientX - r.left) / r.width) * 100).toFixed(2), y: +(((e.clientY - r.top) / r.height) * 100).toFixed(2) });
              }}>
              <img src={mapImg} alt="Karte von Leonida" width={MAP_W} height={MAP_H} data-testid="map-image"
                className={`map-image-feather block h-full w-full select-none ${floating ? "" : ""}`} draggable={false} />
              {showPins && spots.map((s) => {
                const c = categoryById(s.category);
                return (
                  <button key={s.id} type="button" aria-label={s.title} data-testid={`map-pin-${s.id}`}
                    onClick={(e) => { e.stopPropagation(); onSelect?.(s); }}
                    className="absolute -translate-x-1/2 -translate-y-full origin-bottom"
                    style={{ left: `${s.x}%`, top: `${s.y}%`, scale: "var(--pin-scale)" }}>
                    <span className={`grid h-8 w-8 place-items-center rounded-full rounded-br-none rotate-45 ${c.color} border-2 border-foreground shadow-lg`}>
                      <c.icon className="h-4 w-4 -rotate-45" />
                    </span>
                  </button>
                );
              })}
              {pick && (
                <span className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-4 border-foreground bg-primary neon-ring"
                  style={{ left: `${pick.x}%`, top: `${pick.y}%`, scale: "var(--pin-scale)" }} />
              )}
            </div>
          </TransformComponent>
          {floating ? (
            <div className="absolute right-0 top-2 flex flex-col items-center gap-3">
              <button type="button" aria-label={showPins ? "Fundorte ausblenden" : "Fundorte einblenden"} aria-pressed={!showPins} data-testid="map-layers-button"
                onClick={() => setShowPins((v) => !v)} className={`${CTRL} ${showPins ? "" : "!bg-primary/60"}`}><Layers className="h-5 w-5" /></button>
              <button type="button" aria-label="Ganze Karte anzeigen" data-testid="map-locate-button" onClick={resetView} className={CTRL}><Maximize className="h-5 w-5" /></button>
              <div className="flex flex-col overflow-hidden rounded-2xl border border-neon/60 bg-background/70 shadow-[0_0_14px_oklch(0.7_0.3_345/0.35)] backdrop-blur-md">
                <button type="button" aria-label="Vergrößern" data-testid="map-zoom-in-button" onClick={() => zoomIn(0.6)} className="grid h-11 w-11 place-items-center transition-colors duration-150 active:bg-primary/40"><Plus className="h-5 w-5" /></button>
                <span className="mx-2 h-px bg-neon/50" />
                <button type="button" aria-label="Verkleinern" data-testid="map-zoom-out-button" onClick={() => zoomOut(0.6)} className="grid h-11 w-11 place-items-center transition-colors duration-150 active:bg-primary/40"><Minus className="h-5 w-5" /></button>
              </div>
            </div>
          ) : (
            <div className="absolute right-3 top-3 flex flex-col gap-2">
              {[{ i: Plus, f: () => zoomIn(0.6), l: "Vergrößern" }, { i: Minus, f: () => zoomOut(0.6), l: "Verkleinern" }, { i: Maximize, f: resetView, l: "Ganze Karte anzeigen" }].map(({ i: I, f, l }) => (
                <button key={l} type="button" aria-label={l} onClick={f} className="neon-card grid h-11 w-11 place-items-center !rounded-xl"><I className="h-5 w-5" /></button>
              ))}
            </div>
          )}
        </>
      )}
    </TransformWrapper>
  );

  return floating ? (
    <div data-testid="map-floating" data-map-gesture className={`relative min-h-0 ${className ?? ""}`}>
      <div aria-hidden className="pointer-events-none absolute inset-[8%] -z-10 rounded-[40%] bg-[radial-gradient(ellipse_at_center,oklch(0.6_0.2_240/0.5),oklch(0.7_0.3_345/0.3)_55%,transparent_75%)] blur-2xl" />
      <div ref={boxRef} className="absolute inset-0">{map}</div>
    </div>
  ) : (
    <div data-map-gesture className={`relative overflow-hidden rounded-3xl neon-ring ${className ?? ""}`} style={{ aspectRatio: MAP_RATIO }}>
      <div ref={boxRef} className="absolute inset-0">{map}</div>
    </div>
  );
}

const CTRL = "grid h-11 w-11 place-items-center rounded-2xl border border-neon/60 bg-background/70 shadow-[0_0_14px_oklch(0.7_0.3_345/0.35)] backdrop-blur-md transition-[transform,background-color] duration-150 active:scale-95";
