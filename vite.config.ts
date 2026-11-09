// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Emergent preview: only when PORT is set (Lovable's sandbox still forces 8080).
const emergentPort = process.env["PORT"] ? Number(process.env["PORT"]) : undefined;
// Emergent deployment: static SPA build, only via `frontend/` build script (EMERGENT_SPA=1). Lovable builds are unchanged.
const emergentSpa = process.env["EMERGENT_SPA"] === "1";

export default defineConfig({
  vite: {
    define: {
      __LEONIDA_BUILD_ID__: JSON.stringify(process.env["LEONIDA_BUILD_ID"] ?? new Date().toISOString()),
    },
    ...(emergentPort ? { server: { port: emergentPort, strictPort: true, allowedHosts: true } } : {}),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(emergentSpa ? { spa: { enabled: true } } : {}),
  },
});
