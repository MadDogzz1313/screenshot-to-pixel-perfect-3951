import { defineConfig } from "vitest/config";
import path from "node:path";

// Eigene Node-Config für die Highway-Engine/Gesten-Unit-Tests (reine Logik, kein DOM).
// Die Projekt-Standardconfig (vitest.config.ts) nutzt jsdom + ein Setup, das `window` voraussetzt
// und daher für diese reinen Node-Tests scheitert.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/components/arcade/games/highway/**/*.{test,spec}.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
