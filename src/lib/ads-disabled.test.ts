import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const admobImported = vi.fn();
vi.mock("@/lib/db", () => ({ sb: { rpc: (...a: unknown[]) => rpc(...a) }, isMissing: () => false }));
// Simuliert die iPhone-App mit eingebautem AdMob-Plugin – trotzdem darf nichts passieren.
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: () => true } }));
vi.mock("@capacitor-community/admob", () => { admobImported(); return { AdMob: {} }; });

import { ADS_ENABLED, adPrivacyOptionsRequired, adsSupported, initAds, resumePendingAdReward, showAdPrivacyOptions, watchRewardedAd } from "./ads";

describe("Werbung zentral deaktiviert (ADS_ENABLED = false)", () => {
  beforeEach(() => { rpc.mockReset(); admobImported.mockReset(); localStorage.clear(); });

  it("Schalter steht auf aus", () => { expect(ADS_ENABLED).toBe(false); });

  it("keine Werbe-Oberfläche, auch in der iPhone-App mit Plugin", () => { expect(adsSupported()).toBe(false); });

  it("kein Werbeablauf, keine Server-Sitzung, keine Belohnung", async () => {
    await expect(watchRewardedAd("fishing_bonus_casts", "u1")).rejects.toMatchObject({ code: "ADS_DISABLED" });
    await expect(watchRewardedAd("fishing_special_bait", "u1")).rejects.toMatchObject({ code: "ADS_DISABLED" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("kein SDK-Start, kein Einwilligungsformular, kein Plugin-Aufruf", async () => {
    await expect(initAds("test")).rejects.toMatchObject({ code: "ADS_DISABLED" });
    await expect(adPrivacyOptionsRequired()).resolves.toBe(false);
    await expect(showAdPrivacyOptions()).resolves.toBeUndefined();
    expect(admobImported).not.toHaveBeenCalled();
  });

  it("offene Bestätigung wird nicht im Hintergrund eingelöst", async () => {
    localStorage.setItem("leonida-ad-pending", JSON.stringify({ sessionId: "s1", mode: "test", at: Date.now() }));
    await expect(resumePendingAdReward()).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(localStorage.getItem("leonida-ad-pending")).not.toBeNull();
  });
});
