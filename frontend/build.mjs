// Emergent-Deployment: baut die Lovable-App (Hauptordner) als statische SPA nach frontend/dist (+ frontend/build).
// Lovable selbst nutzt diesen Weg nicht.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit", env: { ...process.env, EMERGENT_SPA: "1" } });

if (!existsSync(join(root, "node_modules", ".bin", "vite"))) run("yarn install --non-interactive");
run("npx vite build");

const pub = join(root, ".output", "public");
if (!existsSync(join(pub, "_shell.html"))) throw new Error("SPA shell missing: .output/public/_shell.html");

// Statische Seiten-Pfade bekommen eine eigene index.html, damit Direktlinks (z. B. /passwort-neu aus der E-Mail)
// auch ohne Server-Fallback funktionieren.
const routes = readdirSync(join(root, "src", "routes"))
  .filter((f) => f.endsWith(".tsx") && !f.startsWith("__") && !f.includes("$") && f !== "index.tsx")
  .map((f) => f.replace(/\.tsx$/, "").replace(/\./g, "/"));

for (const out of ["dist", "build"]) {
  const dest = join(here, out);
  rmSync(dest, { recursive: true, force: true });
  cpSync(pub, dest, { recursive: true });
  copyFileSync(join(dest, "_shell.html"), join(dest, "index.html"));
  copyFileSync(join(dest, "_shell.html"), join(dest, "404.html"));
  for (const r of routes) {
    mkdirSync(join(dest, r), { recursive: true });
    copyFileSync(join(dest, "_shell.html"), join(dest, r, "index.html"));
  }
}
console.log(`Emergent SPA build ready: frontend/dist (${routes.length + 1} routes)`);
