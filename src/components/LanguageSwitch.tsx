import { Languages } from "lucide-react";
import { lang, setLang, tr, type Lang } from "@/lib/i18n";

const OPTIONS: { id: Lang; label: string }[] = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
];

/** Sprachwahl (Profil/Einstellungen). Wechsel speichert dauerhaft und lädt die App neu. */
export function LanguageSwitch({ className = "space-y-3 border-t border-border pt-3" }: { className?: string }) {
  return (
    <div data-testid="language-settings" className={className}>
      <div>
        <p className="flex items-center gap-2 font-semibold"><Languages className="h-4 w-4 text-neon" />{tr("Sprache / Language")}</p>
        <p className="text-xs text-muted-foreground">{tr("Gilt für die ganze App und bleibt nach einem Neustart gespeichert.")}</p>
      </div>
      <div role="radiogroup" aria-label={tr("Sprache / Language")} className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const active = o.id === lang;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={active} data-testid={`language-option-${o.id}`} onClick={() => setLang(o.id)}
              className={`rounded-full border px-3 py-2 text-sm font-bold transition-[background-color,color,transform] duration-150 active:scale-95 ${active ? "border-transparent bg-primary text-primary-foreground" : "border-neon/40 bg-background/30 text-foreground"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
