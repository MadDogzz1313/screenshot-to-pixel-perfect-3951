import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { Loader2, Volume2 } from "lucide-react";
import { tr } from "@/lib/i18n";
import type { CatchVideoSpec } from "@/lib/catch-videos";

export type CatchVideoHandle = {
  /** Im Tipp-Handler („Jetzt einholen“) aufrufen: schaltet auf iPhone die spätere Wiedergabe MIT Ton frei. */
  prime: () => void;
};

const START_TIMEOUT_MS = 6000; // Video startet nicht → Belohnung
const STALL_TIMEOUT_MS = 4000; // Video hängt → Belohnung
const idOf = (src: string) => src.split("/").pop()?.replace(/\.\w+$/, "") ?? "video";
const MAX_EXTRA_MS = 6000;     // Absolute Obergrenze: Videolänge + Puffer

/**
 * Vollbild-Fangsequenz (HTML5, playsInline – kein externer Player). Das <video> bleibt dauerhaft eingehängt und lädt vor,
 * damit beim Fang keine Ladepause entsteht. Ende, Überspringen, Fehler und Hänger führen immer zu onDone (Belohnungsbildschirm).
 */
export function CatchVideo({ video, active, onDone, ref }: { video: CatchVideoSpec; active: boolean; onDone: () => void; ref?: Ref<CatchVideoHandle> }) {
  const el = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const activeRef = useRef(active); activeRef.current = active;
  const [playing, setPlaying] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useImperativeHandle(ref, () => ({
    prime: () => {
      const v = el.current; if (!v || !v.paused) return;
      try {
        // play()+pause() im selben Tipp: iOS merkt sich die Nutzergeste für dieses Element, ohne dass Ton hörbar wird
        v.muted = false;
        const p = v.play();
        if (!activeRef.current) v.pause();
        if (p) p.catch(() => undefined);
      } catch { /* Freischalten ist optional */ }
    },
  }), []);

  useEffect(() => {
    const v = el.current; if (!v) return;
    if (!active) { v.pause(); setPlaying(false); setNeedsSound(false); return; }
    // Gerät kann das Format nicht abspielen → sofort Belohnung
    if (!v.canPlayType(video.type)) { doneRef.current(); return; }
    let finished = false; let lastTime = -1; let lastProgress = performance.now();
    const finish = () => { if (finished) return; finished = true; v.pause(); doneRef.current(); };
    const onPlaying = () => { setPlaying(true); lastProgress = performance.now(); };
    const onTime = () => { if (v.currentTime !== lastTime) { lastTime = v.currentTime; lastProgress = performance.now(); } };
    v.addEventListener("ended", finish); v.addEventListener("error", finish);
    v.addEventListener("playing", onPlaying); v.addEventListener("timeupdate", onTime);
    const started = performance.now();
    const watchdog = window.setInterval(() => {
      const now = performance.now();
      if (now - started > video.durationMs + MAX_EXTRA_MS) return finish();
      if (v.error || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) return finish();
      if (v.currentTime === 0 && now - started > START_TIMEOUT_MS) return finish();
      if (v.currentTime > 0 && !v.paused && now - lastProgress > STALL_TIMEOUT_MS) return finish();
    }, 500);
    // App im Hintergrund pausiert das Video – beim Zurückkehren weiterspielen
    const onVis = () => { if (document.visibilityState === "visible" && !finished && v.paused) void v.play().catch(() => undefined); };
    document.addEventListener("visibilitychange", onVis);

    const source = v.querySelector("source"); source?.addEventListener("error", finish);
    try { v.currentTime = 0; } catch { /* noch keine Metadaten */ }
    v.muted = false;
    const start = v.play();
    if (start) start.catch((e: unknown) => {
      if (finished) return;
      // iPhone ohne Freischaltung: stumm starten, „Ton an“ anbieten
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        v.muted = true; setNeedsSound(true);
        void v.play().catch(() => finish());
      } else finish();
    });
    return () => {
      finished = true; window.clearInterval(watchdog); document.removeEventListener("visibilitychange", onVis); source?.removeEventListener("error", finish);
      v.removeEventListener("ended", finish); v.removeEventListener("error", finish);
      v.removeEventListener("playing", onPlaying); v.removeEventListener("timeupdate", onTime);
    };
  }, [active, video.type, video.durationMs]);

  if (!mounted) return null;
  return createPortal(
    <div data-testid={active ? "fishing-catch-video-overlay" : `fishing-catch-video-overlay-idle-${idOf(video.src)}`} aria-hidden={!active} role={active ? "dialog" : undefined} aria-modal={active || undefined} aria-label={active ? tr("Fangsequenz") : undefined}
      className={`fixed inset-0 z-[100] grid place-items-center bg-[#07020F] transition-opacity duration-300 ${active ? "opacity-100" : "pointer-events-none invisible opacity-0"}`}>
      <video ref={el} data-testid={active ? "fishing-catch-video" : `fishing-catch-video-idle-${idOf(video.src)}`} className="h-full w-full object-contain" playsInline autoPlay={false} muted={false} preload="auto" poster={video.poster}
        disablePictureInPicture controls={false} controlsList="nodownload nofullscreen noremoteplayback" x-webkit-airplay="deny">
        <source src={video.src} type={video.type} />
      </video>
      {active && !playing && <div data-testid="fishing-catch-video-loading" className="pointer-events-none absolute inset-0 grid place-items-center"><Loader2 className="h-10 w-10 animate-spin text-[#FFD12A] drop-shadow-[0_0_12px_rgba(255,209,42,0.8)]" /></div>}
      {active && <div className="absolute right-[max(env(safe-area-inset-right),0.75rem)] top-[max(env(safe-area-inset-top),0.75rem)] flex items-center gap-2">
        {needsSound && <button type="button" data-testid="fishing-catch-video-sound" onClick={() => { const v = el.current; if (v) { v.muted = false; void v.play().catch(() => undefined); } setNeedsSound(false); }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/30 bg-black/45 px-3 text-xs font-semibold text-white/90 backdrop-blur-sm transition-[transform,background-color] duration-150 active:scale-95"><Volume2 className="h-4 w-4" />{tr("Ton an")}</button>}
        <button type="button" data-testid="fishing-catch-video-skip" onClick={() => { el.current?.pause(); doneRef.current(); }}
          className="min-h-10 rounded-full border border-white/30 bg-black/45 px-4 text-xs font-semibold text-white/90 backdrop-blur-sm transition-[transform,background-color] duration-150 active:scale-95">{tr("Überspringen")}</button>
      </div>}
    </div>,
    document.body,
  );
}
