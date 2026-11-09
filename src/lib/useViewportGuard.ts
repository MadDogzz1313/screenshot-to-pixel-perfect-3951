import { useEffect } from "react";

/** iPhone (Safari + Home-Screen-App): Seite nie unter Normalgröße herauszoomen, Karten-Gesten von Seiten-Gesten trennen.
 *  - Pinch innerhalb von [data-map-gesture] steuert nur die Karte (react-zoom-pan-pinch), nie die Seite.
 *  - Außerhalb der Karte wird nur das Verkleinern unter 100 % blockiert; Vergrößern (Bedienungshilfe) bleibt möglich.
 *  - Beim Öffnen/Zurückkehren wird ein verstellter Zoom auf 100 % zurückgesetzt. */
export function useViewportGuard() {
  useEffect(() => {
    const vv = window.visualViewport;
    const scale = () => vv?.scale ?? 1;
    const inMap = (t: EventTarget | null) => t instanceof Element && !!t.closest("[data-map-gesture]");
    const onGesture = (e: Event) => {
      if (inMap(e.target)) { e.preventDefault(); return; }
      const s = (e as Event & { scale?: number }).scale ?? 1;
      if (s < 1 && scale() <= 1.01) e.preventDefault();
    };
    let startDist = 0;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) startDist = dist(e.touches); };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || inMap(e.target)) return;
      if (scale() <= 1.01 && dist(e.touches) < startDist) e.preventDefault();
    };
    const reset = () => {
      if (document.visibilityState !== "visible" || Math.abs(scale() - 1) < 0.01) return;
      const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]'); if (!meta) return;
      const content = meta.content;
      meta.content = `${content}, user-scalable=no`;
      requestAnimationFrame(() => { meta.content = content; });
    };
    const opts = { passive: false } as const;
    document.addEventListener("gesturestart", onGesture, opts);
    document.addEventListener("gesturechange", onGesture, opts);
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, opts);
    window.addEventListener("pageshow", reset);
    document.addEventListener("visibilitychange", reset);
    reset();
    return () => {
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      window.removeEventListener("pageshow", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);
}
