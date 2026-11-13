import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, RotateCcw, ShieldAlert, Siren, Trophy, Video, Warehouse } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { LeaderboardModal } from "@/components/arcade/LeaderboardModal";
import { NeonGarage } from "@/components/arcade/NeonGarage";
import { CinematicVideo } from "@/components/arcade/CinematicVideo";
import { POLICE_CHASE_VIDEO } from "@/lib/catch-videos";
import { useEquippedSkin } from "@/lib/vehicle-skins";
import { arcadeError, finishArcadeRound, startArcadeRound, type ArcadeRoundResult } from "@/lib/arcade";
import { useStore } from "@/lib/store";
import type { HighwayRenderer, HighwayView } from "@/components/arcade/games/highway/renderer";
import { createEngine, moveLane, resetRound, stepEngine, updateChase, type Engine } from "@/components/arcade/games/highway/engine";
import { LaneGestures } from "@/components/arcade/games/highway/gestures";

import { tr, locale } from "@/lib/i18n";
const GAME = "neon_highway" as const;
const VIEW_KEY = "leonida-highway-view";
const readView = (): HighwayView => { try { return localStorage.getItem(VIEW_KEY) === "high" ? "high" : "chase"; } catch { return "chase"; } };

export function NeonHighwayGame() {
  const { user } = useStore();
  const search = useSearch({ from: "/arcade/highway" }); const navigate = useNavigate();
  // Fahrzeugdesign: nur Aussehen (Bild + Unterbodenlicht). Spiellogik/Hitbox nutzen weiter die Standardmaße.
  const skin = useEquippedSkin(user?.id); const skinGlow = useRef(skin.glow); skinGlow.current = skin.glow;
  const [garage, setGarage] = useState(false);
  useEffect(() => { if (search.garage) setGarage(true); }, [search.garage]); // nur im Browser öffnen (SSR-sicher)
  const closeGarage = () => { setGarage(false); if (search.garage) void navigate({ to: "/arcade/highway", search: {}, replace: true }); };
  const canvas = useRef<HTMLCanvasElement>(null); const hud = useRef<HTMLSpanElement>(null); const timer = useRef<HTMLSpanElement>(null); const raf = useRef<number | null>(null);
  const engine = useRef<Engine>(createEngine()); const gestures = useRef(new LaneGestures()); const root = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Engine["status"]>("start"); const [result, setResult] = useState<ArcadeRoundResult | null>(null); const [resultError, setResultError] = useState(false); const [leaderboard, setLeaderboard] = useState(false);
  const gl = useRef<HighwayRenderer | null>(null); const glState = useRef<"loading" | "ready" | "failed">("loading"); const [glReady, setGlReady] = useState(false); const [view, setView] = useState<HighwayView>("chase");
  // Polizeijagd: Film beim Start (Spiel steht still), danach Banner + Blaulicht-Rand, solange die Jagd läuft
  const [chase, setChase] = useState(false); const [cinematic, setCinematic] = useState(false); const [banner, setBanner] = useState(false); const cine = useRef(false);
  const resetChase = () => { cine.current = false; setCinematic(false); setChase(false); setBanner(false); };
  const syncHud = () => { if (hud.current) hud.current.textContent = Math.floor(engine.current.score).toLocaleString(locale()); if (timer.current) timer.current.textContent = `${Math.floor(engine.current.elapsed / 1000)}s`; };
  const finish = async () => {
    const e = engine.current; e.status = "over"; setScreen("over"); resetChase(); if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (!e.roundId) return;
    const id = e.roundId; try { const res = await finishArcadeRound(id, e.score, e.elapsed); if (engine.current.roundId === id) setResult(res); } catch (error) { if (engine.current.roundId === id) setResultError(true); toast.error(arcadeError(error as { code?: string; message?: string })); }
  };
  // Grafik: WebGL-Renderer (2.5D). Fällt nur ohne WebGL auf die alte 2D-Zeichnung zurück.
  const draw = () => { const c = canvas.current; if (!c) return; if (gl.current) { gl.current.render(engine.current); return; } if (glState.current !== "failed") return; const ctx = c.getContext("2d"); if (ctx) drawLegacy(ctx, c.clientWidth, c.clientHeight, engine.current, skinGlow.current); };
  const loop = (now: number) => {
    const c = canvas.current; const e = engine.current; if (!c || e.status !== "playing") return;
    const dt = Math.min(40, now - (e.last || now)); e.last = now;
    // Spiellogik in highway/engine.ts: faire Reihen, langsam steigende Schwierigkeit, Karosserie-Hitboxen.
    if (stepEngine(e, dt)) { draw(); void finish(); return; }
    const chaseEvent = updateChase(e);
    if (chaseEvent === "end") setChase(false);
    if (chaseEvent === "start") { setChase(true); syncHud(); draw(); cine.current = true; setCinematic(true); return; } // Schleife ruht während des Films
    if (c.dataset["lane"] !== String(e.lane)) c.dataset["lane"] = String(e.lane);
    syncHud(); draw(); raf.current = requestAnimationFrame(loop);
  };
  const resize = () => { const c = canvas.current; if (!c) return; if (c.clientWidth && c.clientHeight) engine.current.aspect = c.clientWidth / c.clientHeight; const dpr = Math.min(2, window.devicePixelRatio || 1); if (gl.current) { gl.current.resize(c.clientWidth, c.clientHeight, dpr); return; } if (glState.current !== "failed") return; c.width = Math.floor(c.clientWidth * dpr); c.height = Math.floor(c.clientHeight * dpr); const ctx = c.getContext("2d"); ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const endCinematic = () => {
    if (!cine.current) return; cine.current = false; setCinematic(false); setBanner(true);
    const e = engine.current; if (e.status === "playing") { e.last = performance.now(); raf.current = requestAnimationFrame(loop); }
  };
  // Nur Entwicklungs-Vorschau: Spielzustand für automatische Tests erreichbar (nicht im Produktions-Build)
  useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __highway?: Engine }).__highway = engine.current; }, []);
  useEffect(() => { if (!banner) return; const t = window.setTimeout(() => setBanner(false), 2600); return () => window.clearTimeout(t); }, [banner]);
  const start = async () => { const e = engine.current; resetChase(); resetRound(e, performance.now()); e.roundId = null; e.view = view; gestures.current.reset(); if (canvas.current) canvas.current.dataset["lane"] = "1"; setResult(null); setResultError(false); setScreen("playing"); if (!user) { e.roundId = null; } else try { const r = await startArcadeRound(GAME); e.roundId = r?.round_id ?? null; } catch (error) { e.roundId = null; toast.error(arcadeError(error as { code?: string; message?: string })); } syncHud(); raf.current = requestAnimationFrame(loop); };
  const move = (direction: -1 | 1) => { if (cine.current) return; moveLane(engine.current, direction); };
  const tapSide = (x0: number): -1 | 1 => { const rect = canvas.current?.getBoundingClientRect(); return rect && x0 < rect.left + rect.width / 2 ? -1 : 1; };
  const pause = () => { const e = engine.current; if (e.status === "playing") { e.status = "paused"; setScreen("paused"); if (raf.current !== null) cancelAnimationFrame(raf.current); } else if (e.status === "paused") { e.status = "playing"; e.last = performance.now(); setScreen("playing"); if (!cine.current) raf.current = requestAnimationFrame(loop); } };
  useEffect(() => { resize(); const onVisibility = () => { if (document.hidden && engine.current.status === "playing") pause(); }; window.addEventListener("resize", resize); document.addEventListener("visibilitychange", onVisibility); return () => { window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVisibility); if (raf.current !== null) cancelAnimationFrame(raf.current); }; }, []);
  useEffect(() => {
    let cancelled = false;
    const fail = () => { if (cancelled) return; glState.current = "failed"; resize(); setGlReady(true); };
    import("@/components/arcade/games/highway/renderer").then(({ createHighwayRenderer }) => {
      if (cancelled || !canvas.current) return;
      try { gl.current = createHighwayRenderer(canvas.current, readView()); glState.current = "ready"; resize(); setGlReady(true); } catch { fail(); }
    }, fail);
    return () => { cancelled = true; gl.current?.dispose(); gl.current = null; };
  }, []);
  useEffect(() => { setView(readView()); }, []);
  useEffect(() => { gl.current?.setView(view); engine.current.view = view; }, [view]);
  useEffect(() => { if (glReady) { gl.current?.setSkin(skin); draw(); } }, [skin, glReady]);
  // iPhone: Wischen darf nie die Seite scrollen/zurückwischen (zusätzlich zu touch-action: none).
  useEffect(() => { const el = root.current; if (!el) return; const block = (event: TouchEvent) => { if (event.cancelable) event.preventDefault(); }; el.addEventListener("touchmove", block, { passive: false }); return () => el.removeEventListener("touchmove", block); }, []);
  // Tastatur (Pfeiltasten / A, D) als zusätzliche Steuerung
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.repeat) return; const k = event.key.toLowerCase(); if (k === "arrowleft" || k === "a") move(-1); else if (k === "arrowright" || k === "d") move(1); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  const toggleView = () => { const next: HighwayView = view === "chase" ? "high" : "chase"; setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* privat */ } };
  useEffect(() => { draw(); }, [screen, glReady, view]);
  // Vorschau-Fahrt hinter dem Startbildschirm (nur Grafik, keine Spielzustände)
  useEffect(() => { if (screen !== "start" || !glReady || !gl.current) return; let id = 0; const t0 = performance.now(); const tick = (now: number) => { gl.current?.render({ lane: 1, obstacles: [], elapsed: now - t0 }); id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); }, [screen, glReady]);
  return <div data-testid="neon-highway-game" className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden overscroll-none bg-[#0B0418] touch-none" ref={root} onPointerDown={(event) => { if (engine.current.status !== "playing" || cine.current) return; event.preventDefault(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ältere Browser */ } gestures.current.down(event.pointerId, event.clientX, event.clientY, performance.now()); }} onPointerMove={(event) => { const d = gestures.current.move(event.pointerId, event.clientX, event.clientY); if (d) move(d); }} onPointerUp={(event) => { const d = gestures.current.up(event.pointerId, event.clientX, event.clientY, performance.now(), tapSide); if (d) move(d); }} onPointerCancel={(event) => gestures.current.cancel(event.pointerId)}>
    <header className="flex items-center justify-between border-b border-[#FF2E97]/30 bg-[#120A24]/90 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-md"><Link to="/arcade" data-testid="highway-back-button" onPointerDown={(event) => event.stopPropagation()} className="grid h-11 w-11 place-items-center rounded-full border border-neon/50"><ArrowLeft className="h-5 w-5" /></Link><h1 className="font-display text-xl text-neon-gradient">Neon Highway</h1>{screen === "playing" || screen === "paused" ? <button type="button" data-testid="highway-pause-button" onPointerDown={(event) => event.stopPropagation()} onClick={pause} className="grid h-11 w-11 place-items-center rounded-full border border-[#22E4F2]/60 text-[#22E4F2]">{screen === "playing" ? <Pause /> : <Play />}</button> : <span className="w-11" />}</header>
    <div className="relative z-10 flex items-center justify-between gap-2 px-4 py-2 text-sm"><span data-testid="highway-score">Score <b ref={hud}>0</b></span><span data-testid="highway-time">{tr("Zeit")}{" "}<b ref={timer}>0s</b></span><button type="button" data-testid="highway-camera-toggle" aria-label={tr("Kamera wechseln")} onPointerDown={(event) => event.stopPropagation()} onClick={toggleView} className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#22E4F2]/50 bg-[#120A24]/70 px-3 text-xs font-semibold text-[#22E4F2] transition-[background-color,transform] duration-150 active:scale-95 active:bg-[#22E4F2]/15"><Video className="h-3.5 w-3.5" />{view === "chase" ? tr("Heck") : tr("Oben")}</button><span className="text-[#FFD12A]">{tr("bis 40 🪙")}</span></div>
    <div className="relative min-h-0 flex-1"><canvas ref={canvas} data-testid="highway-canvas" className="h-full w-full" />
      {chase && screen !== "over" && <div aria-hidden className="highway-police-edges pointer-events-none absolute inset-0" />}
      {chase && screen !== "over" && <span data-testid="highway-chase-indicator" className="highway-police-chip pointer-events-none absolute left-3 top-2 inline-flex items-center gap-1.5 rounded-full border-2 bg-[#120A24]/85 px-3 py-1 text-xs font-bold text-[#FF5A6E] backdrop-blur-sm"><Siren className="h-3.5 w-3.5" />Police Chase</span>}
      {banner && <div data-testid="highway-chase-banner" role="status" className="highway-police-banner pointer-events-none absolute inset-x-4 top-10 mx-auto max-w-sm">
        <div className="relative flex items-center gap-3 rounded-2xl border-2 border-[#FF2340] bg-[#1A0718]/90 px-4 py-3 shadow-[0_0_28px_rgba(255,35,64,0.65)] backdrop-blur-md">
          <span aria-hidden className="absolute -top-2 left-1/2 flex h-3 w-24 -translate-x-1/2 overflow-hidden rounded-full"><span className="highway-police-bar-red h-full w-1/2 bg-[#FF2340]" /><span className="highway-police-bar-blue h-full w-1/2 bg-[#2F6BFF]" /></span>
          <ShieldAlert className="h-10 w-10 shrink-0 text-[#FF5A6E] drop-shadow-[0_0_10px_rgba(255,35,64,0.9)]" />
          <span className="min-w-0"><span className="block font-display text-2xl italic leading-tight text-white [text-shadow:0_0_14px_rgba(255,35,64,0.9)]">POLICE CHASE!</span><span className="block text-sm italic text-[#FFD6DC]">{tr("Die Polizei verfolgt dich!")}</span></span>
        </div>
      </div>}<div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-between px-6"><span className="rounded-full border border-[#22E4F2]/40 px-3 py-1 text-xs text-[#22E4F2]">{tr("← links")}</span><span className="rounded-full border border-[#22E4F2]/40 px-3 py-1 text-xs text-[#22E4F2]">{tr("rechts →")}</span></div></div>
    {screen === "start" && <Overlay testId="highway-start-overlay" title="Neon Highway" text={tr("Tippe links oder rechts, um die Spur zu wechseln. Weiche dem Verkehr aus und halte so lange wie möglich durch.")} button={tr("Runde starten")} onClick={() => void start()}>
      <button type="button" data-testid="highway-garage-button" aria-label={tr("Neon Garage öffnen")} onClick={() => setGarage(true)} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-full border border-[#22E4F2]/70 bg-[#0B0418]/60 py-1.5 pl-1.5 pr-4 text-left text-[#22E4F2] shadow-[0_0_16px_rgba(34,228,242,0.3)] transition-[transform,background-color,box-shadow] duration-150 active:scale-95 active:bg-[#22E4F2]/15"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#22E4F2] text-[#0B0418] shadow-[0_0_14px_rgba(34,228,242,0.6)]"><Warehouse className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{tr("Neon Garage")}</span><span data-testid="highway-garage-current-skin" className="block truncate text-xs text-[#BFAAD9]">{tr("Ausgerüstet: {0}", skin.name)}</span></span></button>
    </Overlay>}
    {screen === "paused" && <Overlay testId="highway-pause-overlay" title={tr("Pausiert")} text={tr("Die Runde ist angehalten. Auf iPhone-Unterbrechungen wird automatisch pausiert.")} button={tr("Weiter")} onClick={pause} />}
    {screen === "over" && <div data-testid="highway-game-over" role="dialog" aria-modal="true" className="absolute inset-0 grid place-items-center bg-[#120A24]/85 p-5 backdrop-blur-md"><div className="w-full max-w-sm rounded-3xl border border-[#FF2E97]/70 bg-[#21113B] p-5 text-center shadow-[0_0_30px_rgba(255,46,151,0.32)]"><p className="text-xs uppercase tracking-[0.18em] text-[#22E4F2]">{tr("Runde beendet")}</p><h2 className="mt-2 font-display text-3xl text-neon-gradient">{tr("{0} Punkte", Math.floor(engine.current.score).toLocaleString(locale()))}</h2>{result ? <p className="mt-3 text-sm text-[#BFAAD9]">{tr("🪙 +{0} Coins · ⚡ +{1} XP {2}{3}", result.coins, result.xp, result.new_high_score ? tr("· Neuer Highscore!") : "", result.daily_limit_reached ? tr(" · Tageslimit erreicht") : "")}</p> : <p className="mt-3 text-xs text-[#BFAAD9]">{engine.current.roundId ? (resultError ? tr("Diese Runde wurde nicht gewertet.") : tr("Wertung wird gespeichert …")) : tr("Nur Trainingsrunde – SQL 013 fehlt noch.")}</p>}<div className="mt-5 grid gap-2"><button type="button" data-testid="highway-restart-button" onClick={() => void start()} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground"><RotateCcw className="mr-2 inline h-4 w-4" />{tr("Erneut spielen")}</button><button type="button" data-testid="highway-leaderboard-button" onClick={() => setLeaderboard(true)} className="min-h-12 rounded-full border border-[#22E4F2]/60 font-semibold text-[#22E4F2]"><Trophy className="mr-2 inline h-4 w-4" />{tr("Top 5 anzeigen")}</button><Link to="/arcade" data-testid="highway-exit-button" onPointerDown={(event) => event.stopPropagation()} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#FF2E97]/50 bg-[#2A1448]/80 font-semibold tracking-wide text-[#FFB3D9] shadow-[0_0_12px_rgba(255,46,151,0.15)] transition-[background-color,border-color,box-shadow,transform,color] duration-150 hover:border-[#FF2E97] hover:bg-[#FF2E97]/20 hover:text-white hover:shadow-[0_0_18px_rgba(255,46,151,0.4)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2E97] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120A24]"><ArrowLeft className="h-4 w-4" />{tr("Spiel verlassen")}</Link></div></div></div>}
    {garage && screen === "start" && <NeonGarage onClose={closeGarage} />}
    <CinematicVideo video={POLICE_CHASE_VIDEO} active={cinematic} onDone={endCinematic} testId="highway-chase-video" label="Polizeijagd" />
    <LeaderboardModal game={GAME} gameName="Neon Highway" open={leaderboard} onOpenChange={setLeaderboard} />
  </div>;
}
function Overlay({ testId, title, text, button, onClick, children }: { testId: string; title: string; text: string; button: string; onClick: () => void; children?: ReactNode }) { return <div data-testid={testId} className="absolute inset-0 grid place-items-center bg-[#120A24]/75 p-5 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-[#FF2E97]/60 bg-[#21113B]/95 p-6 text-center shadow-[0_0_30px_rgba(255,46,151,0.28)]"><p className="text-4xl">🏎️</p><h2 className="mt-2 font-display text-2xl text-neon-gradient">{title}</h2><p className="mt-3 text-sm leading-relaxed text-[#BFAAD9]">{text}</p><button type="button" data-testid={`${testId}-button`} onClick={onClick} className="mt-5 min-h-12 w-full rounded-full bg-primary font-bold text-primary-foreground">{button}</button>{children}</div></div>; }
function drawLegacy(ctx: CanvasRenderingContext2D, w: number, h: number, e: Engine, body: string) {
    const horizon = h * 0.25;
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#120A24"); sky.addColorStop(0.55, "#55136f"); sky.addColorStop(1, "#0B0418"); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,120,210,.28)"; ctx.beginPath(); ctx.arc(w * .72, horizon * .68, Math.min(w, h) * .09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0920"; for (let x = 0; x < w; x += 38) { const bh = 22 + ((x * 17) % 70); ctx.fillRect(x, horizon - bh, 28, bh); }
    ctx.fillStyle = "#16122d"; ctx.beginPath(); ctx.moveTo(w * .21, horizon); ctx.lineTo(w * .79, horizon); ctx.lineTo(w * 1.1, h); ctx.lineTo(-w * .1, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(34,228,242,.7)"; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { const y = horizon + ((i * 37 + e.elapsed * .18) % (h - horizon)); const p = (y - horizon) / (h - horizon); const half = w * (.29 + p * .72); ctx.beginPath(); ctx.moveTo(w / 2 - half, y); ctx.lineTo(w / 2 + half, y); ctx.stroke(); }
    for (const ob of e.obstacles) { const x = w * (.28 + ob.lane * .24); const y = horizon + ob.y * (h - horizon); ctx.fillStyle = ob.color; ctx.shadowBlur = 14; ctx.shadowColor = ob.color; ctx.fillRect(x - ob.width / 2, y - ob.height / 2, ob.width, ob.height); ctx.shadowBlur = 0; ctx.fillStyle = "#f6eeff"; ctx.fillRect(x - ob.width * .3, y - ob.height * .28, ob.width * .6, 4); }
    const cx = w * (.28 + e.x * .24); const cy = h - 88; ctx.fillStyle = body; ctx.shadowBlur = 22; ctx.shadowColor = body; ctx.fillRect(cx - 27, cy - 38, 54, 76); ctx.shadowBlur = 0; ctx.fillStyle = "#22e4f2"; ctx.fillRect(cx - 18, cy - 27, 36, 9); ctx.fillStyle = "#ffd12a"; ctx.fillRect(cx - 21, cy + 26, 11, 5); ctx.fillRect(cx + 10, cy + 26, 11, 5);
}
