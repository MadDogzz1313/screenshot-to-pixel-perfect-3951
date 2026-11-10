import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "./native";

declare const __LEONIDA_BUILD_ID__: string;

export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || isNativeApp() || !("serviceWorker" in navigator)) return;   // iPhone-App lädt immer live, ohne Service Worker

    let disposed = false;
    let cleanupRegistration: (() => void) | undefined;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const version = encodeURIComponent(__LEONIDA_BUILD_ID__);
    const workerUrl = `/sw.js?version=${version}`;

    const announceWaitingWorker = (nextRegistration: ServiceWorkerRegistration) => {
      if (!disposed && hadController && nextRegistration.waiting) {
        setRegistration(nextRegistration);
        setUpdateReady(true);
      }
    };

    navigator.serviceWorker.register(workerUrl, { updateViaCache: "none" }).then((nextRegistration) => {
      if (disposed) return;
      setRegistration(nextRegistration);
      announceWaitingWorker(nextRegistration);

      nextRegistration.addEventListener("updatefound", () => {
        const installing = nextRegistration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") announceWaitingWorker(nextRegistration);
        });
      });

      const updateTimer = window.setInterval(() => {
        void nextRegistration.update().catch(() => undefined);
      }, 5 * 60 * 1000);
      const onControllerChange = () => {
        if (hadController) window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

      cleanupRegistration = () => {
        window.clearInterval(updateTimer);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }).catch(() => undefined);

    return () => {
      disposed = true;
      cleanupRegistration?.();
    };
  }, []);

  if (!updateReady || !registration?.waiting) return null;

  const applyUpdate = () => {
    const waiting = registration.waiting;
    if (!waiting) return;
    setApplying(true);
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      data-testid="pwa-update-banner"
      role="status"
      className="pointer-events-none fixed inset-x-3 z-[60] mx-auto max-w-md"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-neon/60 bg-[#160E22]/95 p-3 shadow-[0_0_24px_rgba(255,46,147,0.32)] backdrop-blur-xl">
        <RefreshCw className="h-5 w-5 shrink-0 text-neon" aria-hidden />
        <p data-testid="pwa-update-message" className="min-w-0 flex-1 text-sm font-semibold">
          {applying ? "Neue Version wird geladen …" : "Update verfügbar"}
        </p>
        <Button
          type="button"
          data-testid="pwa-update-apply-button"
          disabled={applying}
          onClick={applyUpdate}
          className="min-h-10 shrink-0 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground"
        >
          Jetzt aktualisieren
        </Button>
        <button
          type="button"
          aria-label="Update-Hinweis schließen"
          data-testid="pwa-update-dismiss-button"
          onClick={() => setUpdateReady(false)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-primary/15 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
