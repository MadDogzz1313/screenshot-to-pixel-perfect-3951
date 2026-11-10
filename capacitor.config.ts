// iOS-App (Capacitor). Die App lädt die Live-Website – Web-App und PWA bleiben unverändert und teilen dieselben Daten.
// Adresse für Testzwecke per CAP_SERVER_URL überschreibbar (z. B. in Codemagic).
import type { CapacitorConfig } from "@capacitor/cli";

const LIVE_URL = process.env.CAP_SERVER_URL || "https://leonida-preview-2.emergent.host";

const config: CapacitorConfig = {
  appId: "de.leonida.explorer",
  appName: "Leonida Explorer",
  // Nur Ersatzseite, falls die Live-Website nicht erreichbar ist (die echte App kommt von LIVE_URL)
  webDir: "ios-shell",
  backgroundColor: "#2a0b3d",
  server: {
    url: LIVE_URL,
    cleartext: false,
    errorPath: "index.html",
  },
  ios: {
    contentInset: "never",
    scheme: "Leonida Explorer",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "banner", "list"],
    },
  },
};

export default config;
