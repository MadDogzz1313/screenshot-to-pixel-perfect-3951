// Mehrsprachigkeit (Deutsch/Englisch). Texte stehen im Code auf Deutsch: tr("Deutscher Text", ...werte).
// Englisch kommt aus src/lib/i18n-en.ts. Sprache: gespeicherte Wahl > Gerätesprache (de* = Deutsch) > Englisch.
import { EN } from "./i18n-en";

export type Lang = "de" | "en";
export const LANG_KEY = "leonida-lang";

function detect(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved === "de" || saved === "en") return saved;
  } catch { /* privater Modus */ }
  const device = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  return device.startsWith("de") ? "de" : "en";
}

/** Aktive Sprache – wird einmal beim Start festgelegt; ein Wechsel lädt die App neu. */
export let lang: Lang = "en";
/** Locale für Datum/Zahlen (Intl, toLocaleString). */
export const locale = (): string => (lang === "de" ? "de-DE" : "en-GB");

export function tr(de: string, ...args: unknown[]): string {
  const text = lang === "de" ? de : (EN[de] ?? de);
  return args.length ? text.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? "")) : text;
}

/** Übernimmt Geräte-/Speichersprache erst nach der ersten Hydration, damit SSR und Client denselben Initialtext haben. */
export function initLanguage(): boolean {
  const next = detect();
  if (next === lang) return false;
  lang = next;
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  return true;
}

export function setLang(next: Lang) {
  if (next === lang) return;
  try { window.localStorage.setItem(LANG_KEY, next); } catch { /* ignorieren */ }
  window.location.reload();
}

if (typeof document !== "undefined") document.documentElement.lang = lang;
