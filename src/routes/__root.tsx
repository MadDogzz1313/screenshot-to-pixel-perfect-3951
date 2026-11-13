import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "../lib/store";
import { Toaster } from "../components/ui/sonner";
import { PwaUpdatePrompt } from "../lib/PwaUpdatePrompt";
import { BanGate } from "../components/social/BanGate";
import { useViewportGuard } from "../lib/useViewportGuard";
import { UsernameReminder } from "../components/UsernameReminder";
import { freshNavigationTarget, isChunkLoadError, reloadFresh } from "../lib/chunk-recovery";

import { initLanguage, lang, tr } from "@/lib/i18n";
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const outdated = isChunkLoadError(error);   // alte App-Version nach neuer Veröffentlichung -> frisch laden
  useEffect(() => {
    if (outdated && reloadFresh()) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, outdated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (outdated) { reloadFresh(window.location.href, true); return; }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover" },
      { title: "Leonida Explorer" },
      { name: "description", content: tr("Community-Karte für Fundorte in Leonida.") },
      { property: "og:title", content: "Leonida Explorer" },
      { property: "og:description", content: tr("Community-Karte für Fundorte in Leonida.") },
      { name: "theme-color", content: "#2a0b3d" },
      // iPhone-Home-Bildschirm-Modus (PWA)
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Leonida" },
      { name: "application-name", content: "Leonida Explorer" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useViewportGuard();
  // iPhone-App: neue Version erkannt -> beim nächsten Seitenwechsel frisch laden
  useEffect(() => router.subscribe("onBeforeNavigate", (e) => { freshNavigationTarget(e.toLocation.href); }), [router]);
  const [, refreshLanguage] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (initLanguage()) refreshLanguage((v) => v + 1); }, 100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <StoreProvider key={lang}>
        <UsernameReminder />
        <BanGate><Outlet /></BanGate>
        <Toaster />
        <PwaUpdatePrompt />
      </StoreProvider>
    </QueryClientProvider>
  );
}
