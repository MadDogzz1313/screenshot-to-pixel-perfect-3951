#!/usr/bin/env node
// Leonida Explorer – AdMob nur nicht personalisiert (iOS).
// @capacitor-community/admob 8.3.0 bietet für Rewarded Ads nur `npa: true` (Request-Extra npa=1).
// Zusätzlich setzt dieses Skript Googles offizielle Publisher-Privacy-Treatment-Einstellung
//   MobileAds.shared.requestConfiguration.publisherPrivacyPersonalizationState = .disabled
// direkt im Plugin (vor MobileAds.start), damit JEDE Anzeigenanfrage der App nicht personalisiert ist –
// auch wenn der Nutzer im Google-UMP-Formular personalisierter Werbung zustimmt.
// Idempotent: mehrfaches Ausführen ändert nichts. Bricht ab, wenn die Plugin-Datei nicht passt.
// Aufruf (Codemagic, nach `yarn install`, vor dem Xcode-Build): node scripts/admob-npa-patch.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? join(process.cwd(), "node_modules/@capacitor-community/admob");
const MARKER = "LEONIDA_NPA_ONLY";
const ANCHOR = "private func setRequestConfiguration(_ call: CAPPluginCall) {";
const INSERT = `${ANCHOR}
        // ${MARKER}: Leonida Explorer fordert ausschließlich nicht personalisierte Werbung an (gilt für alle Anfragen).
        MobileAds.shared.requestConfiguration.publisherPrivacyPersonalizationState = .disabled
`;

const fail = (msg) => { console.error(`❌ AdMob-NPA-Patch: ${msg}`); process.exit(1); };
if (!existsSync(join(root, "package.json"))) fail(`Plugin nicht gefunden: ${root}`);
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const sources = join(root, "ios/Sources");
const dir = existsSync(sources) ? readdirSync(sources).find((d) => existsSync(join(sources, d, "AdMobPlugin.swift"))) : undefined;
if (!dir) fail("ios/Sources/*/AdMobPlugin.swift fehlt");
const file = join(sources, dir, "AdMobPlugin.swift");
const src = readFileSync(file, "utf8");

if (src.includes(MARKER)) { console.log(`✅ AdMob ${version}: nicht personalisierte Werbung bereits aktiv (${file})`); process.exit(0); }
if (!src.includes(ANCHOR)) fail(`Plugin-Version ${version}: setRequestConfiguration nicht gefunden – Patch bitte prüfen`);
if (!src.includes("MobileAds.shared")) fail(`Plugin-Version ${version}: unerwartete Google-Mobile-Ads-API`);
writeFileSync(file, src.replace(ANCHOR, INSERT));
console.log(`✅ AdMob ${version}: publisherPrivacyPersonalizationState = .disabled eingebaut (${file})`);
