import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./db", () => ({ sb: { rpc: (...args: unknown[]) => rpc(...args) }, isMissing: (e: { code?: string }) => e?.code === "PGRST202" }));
const { arcadeError, finishArcadeRound } = await import("./arcade");

describe("Arcade-Wertung", () => {
  beforeEach(() => { rpc.mockReset(); vi.useRealTimers(); });

  it("sendet ganzzahligen Score (wie angezeigt) und Dauer", async () => {
    rpc.mockResolvedValue({ data: { round_id: "r", score: 2561, coins: 17, xp: 8, new_high_score: true }, error: null });
    const res = await finishArcadeRound("r", 2561.9, 73000.4);
    expect(rpc).toHaveBeenCalledWith("finish_arcade_round", { _round: "r", _score: 2561, _duration_ms: 73000 });
    expect(res?.coins).toBe(17);
  });

  it("wiederholt bei Netzabbruch und schreibt dann gut", async () => {
    vi.useFakeTimers();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "TypeError: Load failed", code: "" } })
      .mockResolvedValueOnce({ data: { round_id: "r", score: 100, coins: 1, xp: 0, new_high_score: false }, error: null });
    const p = finishArcadeRound("r", 100, 5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await p)?.coins).toBe(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("wiederholt NICHT bei echter Ablehnung durch den Server", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "ROUND_SCORE_INVALID", code: "P0001" } });
    await expect(finishArcadeRound("r", 99999, 5000)).rejects.toMatchObject({ message: "ROUND_SCORE_INVALID" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("gibt nach 3 Netzfehlern auf", async () => {
    vi.useFakeTimers();
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch", code: "" } });
    const p = finishArcadeRound("r", 100, 5000).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toMatchObject({ message: "Failed to fetch" });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("eindeutige Meldungen je Ablehnungsgrund", () => {
    expect(arcadeError({ message: "ROUND_TOO_SHORT" })).toContain("zu kurz");
    expect(arcadeError({ message: "ROUND_EXPIRED" })).toContain("verfallen");
    expect(arcadeError({ message: "ROUND_DURATION_INVALID" })).toContain("Spielzeit war nicht plausibel");
    expect(arcadeError({ message: "ROUND_SCORE_INVALID" })).toContain("nicht plausibel");
    expect(arcadeError({ message: "ROUND_DURATION_INVALID" })).not.toContain("zu lang");
  });
});
