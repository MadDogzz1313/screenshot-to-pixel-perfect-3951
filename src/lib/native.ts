// Erkennt, ob die Seite in der iPhone-App (Capacitor) läuft. Im Browser/PWA immer false.
import { Capacitor } from "@capacitor/core";

export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();
