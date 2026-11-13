import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Volume2 } from "lucide-react";
import { tr } from "@/lib/i18n";
import type { CatchVideoSpec } from "@/lib/catch-videos";

const START_TIMEOUT_MS = 8000; // Video startet nicht → Belohnung
const STALL_TIMEOUT_MS = 4000; // Video hängt → Belohnung
const MAX_EXTRA_MS = 6000;     // Absolute Obergrenze: Videolänge + Puffer
const PRELOAD_DELAY_MS = 1500; // Spiel-Assets zuerst laden

// Vorladen: Datei einmal pro Sitzung komplett herunterladen und lokal (blob:) abspielen → keine Ladepause.
const preloaded = new Map<string, Promise<string | null>>();
function preloadVideo(spec: CatchVideoSpec): Promise<string | null> {
  let p = preloaded.get(spec.src);
  if (!p) {
    p = fetch(spec.src)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b && b.size > 0 ? URL.createObjectURL(b.type ? b : new Blob([b], { type: spec.type })) : null))
      .catch(() => null);
    preloaded.set(spec.src, p);
  }
  return p;
}

/**
 * Vollbild-Filmsequenz (Fangvideos, Polizeijagd; HTML5, playsInline – kein externer Player, iPhone/Capacitor/Web).
 * Das <video> wird erst beim Fang SICHTBAR eingehängt (iOS/WKWebView friert Videos ein, die versteckt eingehängt waren).
 * Ende, Überspringen, Fehler und Hänger führen immer zu onDone (Belohnungsbildschirm).
 */
export function CinematicVideo({ video, active, onDone, testId = "fishing-catch-video", label = "Fangsequenz" }: { video: CatchVideoSpec; active: boolean; onDone: () => void; testId?: string; label?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => { void preloadVideo(video).then((u) => { if (alive) setBlobUrl(u); }); }, PRELOAD_DELAY_MS);
    return () => { alive = false; window.clearTimeout(t); };
  }, [video]);

  if (!mounted || !active) return null;
  return createPortal(<ActivePlayer video={video} initialSrc={blobUrl ?? video.src} onDone={onDone} testId={testId} label={label} />, document.body);
}

function ActivePlayer({ video, initialSrc, onDone, testId, label }: { video: CatchVideoSpec; initialSrc: string; onDone: () => void; testId: string; label: string }) {
  const el = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const [src, setSrc] = useState(initialSrc);
  const [playing, setPlaying] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);

  useEffect(() => {
    const v = el.current; if (!v) return;
    // Gerät kann das Format nicht abspielen → sofort Belohnung
    if (!v.canPlayType(video.type)) { doneRef.current(); return; }
    let finished = false; let lastTime = -1; let lastProgress = performance.now();
    const finish = () => { if (finished) return; finished = true; v.pause(); doneRef.current(); };
    // Lokale Kopie defekt → einmal direkt vom Server versuchen
    const fail = () => { if (finished) return; if (src !== video.src) { finished = true; setSrc(video.src); } else finish(); };
    const onPlaying = () => { setPlaying(true); lastProgress = performance.now(); };
    const onTime = () => { if (v.currentTime !== lastTime) { lastTime = v.currentTime; lastProgress = performance.now(); if (v.currentTime > 0) setPlaying(true); } };
    v.addEventListener("ended", finish); v.addEventListener("error", fail);
    v.addEventListener("playing", onPlaying); v.addEventListener("timeupdate", onTime);
    const started = performance.now();
    const watchdog = window.setInterval(() => {
      const now = performance.now();
      if (now - started > video.durationMs + MAX_EXTRA_MS) return finish();
      if (v.error) return fail();
      if (v.currentTime === 0 && now - started > START_TIMEOUT_MS) return fail();
      if (v.currentTime > 0 && !v.paused && now - lastProgress > STALL_TIMEOUT_MS) return finish();
    }, 500);
    // App im Hintergrund pausiert das Video – beim Zurückkehren weiterspielen
    const onVis = () => { if (document.visibilityState === "visible" && !finished && v.paused) void v.play().catch(() => undefined); };
    document.addEventListener("visibilitychange", onVis);

    // Mit Ton starten (Capacitor erlaubt das). Blockiert der Browser den Ton → stumm weiter + „Ton an“.
    v.muted = false;
    const start = v.play();
    if (start) start.catch((e: unknown) => {
      if (finished) return;
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        v.muted = true; setNeedsSound(true);
        void v.play().catch(() => finish());
      } else if (!(e instanceof DOMException && e.name === "AbortError")) fail();
    });
    return () => {
      finished = true; window.clearInterval(watchdog); document.removeEventListener("visibilitychange", onVis);
      v.removeEventListener("ended", finish); v.removeEventListener("error", fail);
      v.removeEventListener("playing", onPlaying); v.removeEventListener("timeupdate", onTime);
    };
  }, [src, video]);

  return <div data-testid={`${testId}-overlay`} role="dialog" aria-modal="true" aria-label={tr(label)}
    className="fixed inset-0 z-[100] grid place-items-center bg-[#07020F] animate-in fade-in duration-300">
    <video key={src} ref={el} data-testid={testId} src={src} className="h-full w-full object-contain" playsInline preload="auto" poster={video.poster}
      disablePictureInPicture controls={false} controlsList="nodownload nofullscreen noremoteplayback" x-webkit-airplay="deny" />
    {!playing && <div data-testid={`${testId}-loading`} className="pointer-events-none absolute inset-0 grid place-items-center"><Loader2 className="h-10 w-10 animate-spin text-[#FFD12A] drop-shadow-[0_0_12px_rgba(255,209,42,0.8)]" /></div>}
    <div className="absolute right-[max(env(safe-area-inset-right),0.75rem)] top-[max(env(safe-area-inset-top),0.75rem)] flex items-center gap-2">
      {needsSound && <button type="button" data-testid={`${testId}-sound`} onClick={() => { const v = el.current; if (v) { v.muted = false; void v.play().catch(() => undefined); } setNeedsSound(false); }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/30 bg-black/45 px-3 text-xs font-semibold text-white/90 backdrop-blur-sm transition-[transform,background-color] duration-150 active:scale-95"><Volume2 className="h-4 w-4" />{tr("Ton an")}</button>}
      <button type="button" data-testid={`${testId}-skip`} onClick={() => { el.current?.pause(); doneRef.current(); }}
        className="min-h-10 rounded-full border border-white/30 bg-black/45 px-4 text-xs font-semibold text-white/90 backdrop-blur-sm transition-[transform,background-color] duration-150 active:scale-95">{tr("Überspringen")}</button>
    </div>
  </div>;
}
