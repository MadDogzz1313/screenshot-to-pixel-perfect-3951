import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PLUGIN = join(ROOT, "node_modules/@capacitor-community/admob");
const SWIFT = "ios/Sources/AdMobPlugin/AdMobPlugin.swift";

/** Kopie des echten Plugins (ohne evtl. schon eingebauten Patch) in einem Temp-Ordner. */
function freshPluginCopy() {
  const dir = mkdtempSync(join(tmpdir(), "admob-npa-"));
  mkdirSync(join(dir, "ios/Sources/AdMobPlugin"), { recursive: true });
  writeFileSync(join(dir, "package.json"), readFileSync(join(PLUGIN, "package.json")));
  const original = readFileSync(join(PLUGIN, SWIFT), "utf8").split("\n")
    .filter((l) => !l.includes("LEONIDA_NPA_ONLY") && !l.includes("publisherPrivacyPersonalizationState = .disabled")).join("\n");
  writeFileSync(join(dir, SWIFT), original);
  return dir;
}
const run = (dir: string) => execFileSync("node", [join(ROOT, "scripts/admob-npa-patch.mjs"), dir], { encoding: "utf8" });

describe("AdMob: nur nicht personalisierte Werbung", () => {
  it("verwendet die geprüfte Plugin-Version 8.3.0", () => {
    expect(JSON.parse(readFileSync(join(PLUGIN, "package.json"), "utf8")).version).toBe("8.3.0");
  });

  it("setzt publisherPrivacyPersonalizationState = .disabled vor MobileAds.start – genau einmal (idempotent)", () => {
    const dir = freshPluginCopy();
    run(dir);
    run(dir);
    const src = readFileSync(join(dir, SWIFT), "utf8");
    expect(src.match(/publisherPrivacyPersonalizationState = \.disabled/g)).toHaveLength(1);
    const cfg = src.indexOf("private func setRequestConfiguration");
    expect(src.indexOf("publisherPrivacyPersonalizationState")).toBeGreaterThan(cfg);
    // initialize(): erst setRequestConfiguration, dann MobileAds.shared.start
    const init = src.slice(src.indexOf("@objc func initialize"));
    expect(init.indexOf("setRequestConfiguration(call)")).toBeLessThan(init.indexOf("MobileAds.shared.start"));
  });

  it("Rewarded Ads werden mit npa=1 angefordert", () => {
    const ads = readFileSync(join(ROOT, "src/lib/ads.ts"), "utf8");
    expect(ads).toMatch(/export const NON_PERSONALIZED_ADS = true/);
    expect(ads).toMatch(/prepareRewardVideoAd\(\{[^}]*npa: NON_PERSONALIZED_ADS/);
    expect(ads).not.toMatch(/requestTrackingAuthorization/);
    const swift = readFileSync(join(PLUGIN, SWIFT), "utf8");
    expect(swift).toMatch(/extras\.additionalParameters = \["npa": "1"\]/);
  });
});
