import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { EN } from "./i18n-en";

const SRC = path.resolve(__dirname, "..");
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "ui" ? [] : sources(p);
    return /\.tsx?$/.test(e.name) && !/(\.test\.tsx?|^i18n(-en)?\.ts)$/.test(e.name) ? [p] : [];
  });
}

describe("i18n", () => {
  it("hat für jeden tr(\"…\")-Text eine englische Übersetzung", () => {
    const missing: string[] = [];
    for (const f of sources(SRC)) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/\btr\("((?:[^"\\]|\\.)*)"/g)) {
        const key = JSON.parse(`"${m[1]}"`) as string;
        if (!(key in EN)) missing.push(`${path.relative(SRC, f)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("behält Platzhalter {0}, {1} … in der Übersetzung bei", () => {
    const bad = Object.entries(EN).filter(([de, en]) => (de.match(/\{\d+\}/g) ?? []).sort().join() !== (en.match(/\{\d+\}/g) ?? []).sort().join());
    expect(bad).toEqual([]);
  });
});
