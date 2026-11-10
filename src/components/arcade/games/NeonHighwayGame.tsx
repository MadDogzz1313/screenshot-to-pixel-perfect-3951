import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, RotateCcw, Trophy, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LeaderboardModal } from "@/components/arcade/LeaderboardModal";
import { arcadeError, finishArcadeRound, startArcadeRound, type ArcadeRoundResult } from "@/lib/arcade";
import { useStore } from "@/lib/store";
import type { HighwayRenderer, HighwayView } from "@/components/arcade/games/highway/renderer";

const GAME = "neon_highway" as const;
type Obstacle = { lane: number; y: number; width: number; height: number; speed: number; color: string };
const VIEW_KEY = "leonida-highway-view";
const readView = (): HighwayView => { try { return localStorage.getItem(VIEW_KEY) === "high" ? "high" : "chase"; } catch { return "chase"; } };
type Engine = { status: "start" | "playing" | "paused" | "over"; lane: number; obstacles: Obstacle[]; elapsed: number; score: number; spawn: number; last: number; roundId: string | null; roundStarted: number };

export function NeonHighwayGame() {
  const { user } = useStore();
  const canvas = useRef<HTMLCanvasElement>(null); const hud = useRef<HTMLSpanElement>(null); const timer = useRef<HTMLSpanElement>(null); const raf = useRef<number | null>(null);
  const engine = useRef<Engine>({ status: "start", lane: 1, obstacles: [], elapsed: 0, score: 0, spawn: 0, last: 0, roundId: null, roundStarted: 0 });
  const [screen, setScreen] = useState<Engine["status"]>("start"); const [result, setResult] = useState<ArcadeRoundResult | null>(null); const [leaderboard, setLeaderboard] = useState(false);
  const gl = useRef<HighwayRenderer | null>(null); const glState = useRef<"loading" | "ready" | "failed">("loading"); const [glReady, setGlReady] = useState(false); const [view, setView] = useState<HighwayView>("chase");
  const syncHud = () => { if (hud.current) hud.current.textContent = Math.floor(engine.current.score).toLocaleString("de-DE"); if (timer.current) timer.current.textContent = `${Math.floor(engine.current.elapsed / 1000)}s`; };
  const finish = async () => {
    const e = engine.current; e.status = "over"; setScreen("over"); if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (!e.roundId) return;
    try { setResult(await finishArcadeRound(e.roundId, e.score, e.elapsed)); } catch (error) { toast.error(arcadeError(error as { code?: string; message?: string })); }
  };
  // Grafik: WebGL-Renderer (2.5D). Fällt nur ohne WebGL auf die alte 2D-Zeichnung zurück.
  const draw = () => { const c = canvas.current; if (!c) return; if (gl.current) { gl.current.render(engine.current); return; } if (glState.current !== "failed") return; const ctx = c.getContext("2d"); if (ctx) drawLegacy(ctx, c.clientWidth, c.clientHeight, engine.current); };
  const loop = (now: number) => {
    const c = canvas.current; const e = engine.current; if (!c || e.status !== "playing") return;
    const dt = Math.min(40, now - (e.last || now)); e.last = now; e.elapsed += dt; e.spawn += dt;
    if (e.spawn > 650) { e.spawn = 0; e.obstacles.push({ lane: Math.floor(Math.random() * 3), y: 0, width: 36, height: 60, speed: 0.00019 + Math.random() * .00008, color: Math.random() > .5 ? "#22e4f2" : "#ff6aa9" }); }
    for (const ob of e.obstacles) ob.y += ob.speed * dt;
    e.obstacles = e.obstacles.filter((ob) => ob.y < 1.15);
    const hit = e.obstacles.some((ob) => ob.lane === e.lane && ob.y > .82 && ob.y < 1.02); if (hit) { void finish(); return; }
    e.score += dt * .035; syncHud(); draw(); raf.current = requestAnimationFrame(loop);
  };
  const resize = () => { const c = canvas.current; if (!c) return; const dpr = Math.min(2, window.devicePixelRatio || 1); if (gl.current) { gl.current.resize(c.clientWidth, c.clientHeight, dpr); return; } if (glState.current !== "failed") return; c.width = Math.floor(c.clientWidth * dpr); c.height = Math.floor(c.clientHeight * dpr); const ctx = c.getContext("2d"); ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const start = async () => { const e = engine.current; e.status = "playing"; e.lane = 1; e.obstacles = []; e.elapsed = 0; e.score = 0; e.spawn = 0; e.last = performance.now(); e.roundStarted = performance.now(); setResult(null); setScreen("playing"); if (!user) { e.roundId = null; } else try { const r = await startArcadeRound(GAME); e.roundId = r?.round_id ?? null; } catch (error) { e.roundId = null; toast.error(arcadeError(error as { code?: string; message?: string })); } syncHud(); raf.current = requestAnimationFrame(loop); };
  const move = (direction: -1 | 1) => { if (engine.current.status === "playing") engine.current.lane = Math.max(0, Math.min(2, engine.current.lane + direction)); };
  const pause = () => { const e = engine.current; if (e.status === "playing") { e.status = "paused"; setScreen("paused"); if (raf.current !== null) cancelAnimationFrame(raf.current); } else if (e.status === "paused") { e.status = "playing"; e.last = performance.now(); setScreen("playing"); raf.current = requestAnimationFrame(loop); } };
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
  useEffect(() => { gl.current?.setView(view); }, [view]);
  const toggleView = () => { const next: HighwayView = view === "chase" ? "high" : "chase"; setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* privat */ } };
  useEffect(() => { draw(); }, [screen, glReady, view]);
  // Vorschau-Fahrt hinter dem Startbildschirm (nur Grafik, keine Spielzustände)
  useEffect(() => { if (screen !== "start" || !glReady || !gl.current) return; let id = 0; const t0 = performance.now(); const tick = (now: number) => { gl.current?.render({ lane: 1, obstacles: [], elapsed: now - t0 }); id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); }, [screen, glReady]);
  return <div data-testid="neon-highway-game" className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden overscroll-none bg-[#0B0418] touch-none" onPointerDown={(event) => { if (screen !== "playing") return; event.preventDefault(); const rect = canvas.current?.getBoundingClientRect(); if (rect) move(event.clientX < rect.left + rect.width / 2 ? -1 : 1); }}>
    <header className="flex items-center justify-between border-b border-[#FF2E97]/30 bg-[#120A24]/90 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-md"><Link to="/arcade" data-testid="highway-back-button" onPointerDown={(event) => event.stopPropagation()} className="grid h-11 w-11 place-items-center rounded-full border border-neon/50"><ArrowLeft className="h-5 w-5" /></Link><h1 className="font-display text-xl text-neon-gradient">Neon Highway</h1>{screen === "playing" || screen === "paused" ? <button type="button" data-testid="highway-pause-button" onPointerDown={(event) => event.stopPropagation()} onClick={pause} className="grid h-11 w-11 place-items-center rounded-full border border-[#22E4F2]/60 text-[#22E4F2]">{screen === "playing" ? <Pause /> : <Play />}</button> : <span className="w-11" />}</header>
    <div className="relative z-10 flex items-center justify-between gap-2 px-4 py-2 text-sm"><span data-testid="highway-score">Score <b ref={hud}>0</b></span><span data-testid="highway-time">Zeit <b ref={timer}>0s</b></span><button type="button" data-testid="highway-camera-toggle" aria-label="Kamera wechseln" onPointerDown={(event) => event.stopPropagation()} onClick={toggleView} className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#22E4F2]/50 bg-[#120A24]/70 px-3 text-xs font-semibold text-[#22E4F2] transition-[background-color,transform] duration-150 active:scale-95 active:bg-[#22E4F2]/15"><Video className="h-3.5 w-3.5" />{view === "chase" ? "Heck" : "Oben"}</button><span className="text-[#FFD12A]">bis 40 🪙</span></div>
    <div className="relative min-h-0 flex-1"><canvas ref={canvas} data-testid="highway-canvas" className="h-full w-full" /><div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-between px-6"><span className="rounded-full border border-[#22E4F2]/40 px-3 py-1 text-xs text-[#22E4F2]">← links</span><span className="rounded-full border border-[#22E4F2]/40 px-3 py-1 text-xs text-[#22E4F2]">rechts →</span></div></div>
    {screen === "start" && <Overlay testId="highway-start-overlay" title="Neon Highway" text="Tippe links oder rechts, um die Spur zu wechseln. Weiche dem Verkehr aus und halte so lange wie möglich durch." button="Runde starten" onClick={() => void start()} />}
    {screen === "paused" && <Overlay testId="highway-pause-overlay" title="Pausiert" text="Die Runde ist angehalten. Auf iPhone-Unterbrechungen wird automatisch pausiert." button="Weiter" onClick={pause} />}
    {screen === "over" && <div data-testid="highway-game-over" role="dialog" aria-modal="true" className="absolute inset-0 grid place-items-center bg-[#120A24]/85 p-5 backdrop-blur-md"><div className="w-full max-w-sm rounded-3xl border border-[#FF2E97]/70 bg-[#21113B] p-5 text-center shadow-[0_0_30px_rgba(255,46,151,0.32)]"><p className="text-xs uppercase tracking-[0.18em] text-[#22E4F2]">Runde beendet</p><h2 className="mt-2 font-display text-3xl text-neon-gradient">{Math.floor(engine.current.score).toLocaleString("de-DE")} Punkte</h2>{result ? <p className="mt-3 text-sm text-[#BFAAD9]">🪙 +{result.coins} Coins · ⚡ +{result.xp} XP {result.new_high_score ? "· Neuer Highscore!" : ""}</p> : <p className="mt-3 text-xs text-[#BFAAD9]">{engine.current.roundId ? "Wertung wird gespeichert …" : "Nur Trainingsrunde – SQL 013 fehlt noch."}</p>}<div className="mt-5 grid gap-2"><button type="button" data-testid="highway-restart-button" onClick={() => void start()} className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground"><RotateCcw className="mr-2 inline h-4 w-4" />Erneut spielen</button><button type="button" data-testid="highway-leaderboard-button" onClick={() => setLeaderboard(true)} className="min-h-12 rounded-full border border-[#22E4F2]/60 font-semibold text-[#22E4F2]"><Trophy className="mr-2 inline h-4 w-4" />Top 5 anzeigen</button></div></div></div>}
    <LeaderboardModal game={GAME} gameName="Neon Highway" open={leaderboard} onOpenChange={setLeaderboard} />
  </div>;
}
function Overlay({ testId, title, text, button, onClick }: { testId: string; title: string; text: string; button: string; onClick: () => void }) { return <div data-testid={testId} className="absolute inset-0 grid place-items-center bg-[#120A24]/75 p-5 backdrop-blur-sm"><div className="w-full max-w-sm rounded-3xl border border-[#FF2E97]/60 bg-[#21113B]/95 p-6 text-center shadow-[0_0_30px_rgba(255,46,151,0.28)]"><p className="text-4xl">🏎️</p><h2 className="mt-2 font-display text-2xl text-neon-gradient">{title}</h2><p className="mt-3 text-sm leading-relaxed text-[#BFAAD9]">{text}</p><button type="button" data-testid={`${testId}-button`} onClick={onClick} className="mt-5 min-h-12 w-full rounded-full bg-primary font-bold text-primary-foreground">{button}</button></div></div>; }
function drawLegacy(ctx: CanvasRenderingContext2D, w: number, h: number, e: Engine) {
    const horizon = h * 0.25;
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#120A24"); sky.addColorStop(0.55, "#55136f"); sky.addColorStop(1, "#0B0418"); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,120,210,.28)"; ctx.beginPath(); ctx.arc(w * .72, horizon * .68, Math.min(w, h) * .09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0920"; for (let x = 0; x < w; x += 38) { const bh = 22 + ((x * 17) % 70); ctx.fillRect(x, horizon - bh, 28, bh); }
    ctx.fillStyle = "#16122d"; ctx.beginPath(); ctx.moveTo(w * .21, horizon); ctx.lineTo(w * .79, horizon); ctx.lineTo(w * 1.1, h); ctx.lineTo(-w * .1, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(34,228,242,.7)"; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { const y = horizon + ((i * 37 + e.elapsed * .18) % (h - horizon)); const p = (y - horizon) / (h - horizon); const half = w * (.29 + p * .72); ctx.beginPath(); ctx.moveTo(w / 2 - half, y); ctx.lineTo(w / 2 + half, y); ctx.stroke(); }
    for (const ob of e.obstacles) { const x = w * (.28 + ob.lane * .24); const y = horizon + ob.y * (h - horizon); ctx.fillStyle = ob.color; ctx.shadowBlur = 14; ctx.shadowColor = ob.color; ctx.fillRect(x - ob.width / 2, y - ob.height / 2, ob.width, ob.height); ctx.shadowBlur = 0; ctx.fillStyle = "#f6eeff"; ctx.fillRect(x - ob.width * .3, y - ob.height * .28, ob.width * .6, 4); }
    const cx = w * (.28 + e.lane * .24); const cy = h - 88; ctx.fillStyle = "#ff2e97"; ctx.shadowBlur = 22; ctx.shadowColor = "#ff2e97"; ctx.fillRect(cx - 27, cy - 38, 54, 76); ctx.shadowBlur = 0; ctx.fillStyle = "#22e4f2"; ctx.fillRect(cx - 18, cy - 27, 36, 9); ctx.fillStyle = "#ffd12a"; ctx.fillRect(cx - 21, cy + 26, 11, 5); ctx.fillRect(cx + 10, cy + 26, 11, 5);
}
