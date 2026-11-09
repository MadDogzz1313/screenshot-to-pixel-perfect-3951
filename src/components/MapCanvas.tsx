import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Plus, Minus, LocateFixed } from "lucide-react";
import mapImg from "@/assets/map-placeholder.jpg";
import { categoryById, type Spot } from "@/lib/demo-data";

// Austauschbares Platzhalterbild: Datei ersetzen, Seitenverhältnis hier anpassen.
export const MAP_RATIO = 1024 / 1536;

interface Props {
  spots: Spot[]; onSelect?: (s: Spot) => void;
  pick?: { x: number; y: number } | null; onPick?: (p: { x: number; y: number }) => void;
  className?: string;
}

export function MapCanvas({ spots, onSelect, pick, onPick, className }: Props) {
  return (
    <div className={`relative overflow-hidden rounded-3xl neon-ring ${className ?? ""}`}>
      <TransformWrapper minScale={1} maxScale={6} doubleClick={{ disabled: !!onPick }} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full">
              <div className="relative w-full" style={{ aspectRatio: MAP_RATIO }}
                onClick={(e) => {
                  if (!onPick) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  onPick({ x: +(((e.clientX - r.left) / r.width) * 100).toFixed(2), y: +(((e.clientY - r.top) / r.height) * 100).toFixed(2) });
                }}>
                <img src={mapImg} alt="Karte von Leonida (Platzhalter)" width={1024} height={1536} className="h-full w-full select-none" draggable={false} />
                {spots.map((s) => {
                  const c = categoryById(s.category);
                  return (
                    <button key={s.id} type="button" aria-label={s.title}
                      onClick={(e) => { e.stopPropagation(); onSelect?.(s); }}
                      className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
                      <span className={`grid h-8 w-8 place-items-center rounded-full rounded-br-none rotate-45 ${c.color} border-2 border-foreground shadow-lg`}>
                        <c.icon className="h-4 w-4 -rotate-45" />
                      </span>
                    </button>
                  );
                })}
                {pick && (
                  <span className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-4 border-foreground bg-primary neon-ring"
                    style={{ left: `${pick.x}%`, top: `${pick.y}%` }} />
                )}
              </div>
            </TransformComponent>
            <div className="absolute right-3 top-3 flex flex-col gap-2">
              {[{ i: Plus, f: () => zoomIn(), l: "Vergrößern" }, { i: Minus, f: () => zoomOut(), l: "Verkleinern" }, { i: LocateFixed, f: () => resetTransform(), l: "Zurücksetzen" }].map(({ i: I, f, l }) => (
                <button key={l} type="button" aria-label={l} onClick={f} className="neon-card grid h-11 w-11 place-items-center !rounded-xl"><I className="h-5 w-5" /></button>
              ))}
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
