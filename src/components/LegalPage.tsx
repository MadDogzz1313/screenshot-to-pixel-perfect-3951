import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";

import { lang, tr } from "@/lib/i18n";
/** Betreiberangaben für Nutzungsbedingungen und Datenschutz. Keine private Wohnadresse ausgeben. */
export const OPERATOR = {
  name: "Nico Etterer",
  email: "n.etterer@outlook.de",
  updated: tr("Stand: 11. November 2026"),
};

export function LegalPage({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <AppShell title={tr(title)}>
      <article data-testid={testId} className="neon-card mx-3 space-y-4 p-5 text-sm leading-relaxed [&_h2]:pt-1 [&_h2]:font-display [&_h2]:text-base [&_li]:ml-5 [&_li]:list-disc">
        <button type="button" data-testid="legal-back-button" onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
          className="flex items-center gap-1.5 text-xs font-semibold text-neon transition-opacity duration-150 active:opacity-60"><ArrowLeft className="h-4 w-4" />{tr("Zurück")}</button>
        {lang === "de" ? children : (
          <div data-testid="legal-english-placeholder" className="space-y-2">
            <h2>{tr(title)}</h2>
            <p>The English version of this document is coming soon.</p>
            <p className="text-muted-foreground">Operator: {OPERATOR.name} · {OPERATOR.email}</p>
          </div>
        )}
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">{OPERATOR.updated} · <Link to="/nutzungsbedingungen" data-testid="legal-terms-link" className="underline">{tr("Nutzungsbedingungen")}</Link> · <Link to="/datenschutz" data-testid="legal-privacy-link" className="underline">{tr("Datenschutz")}</Link></p>
      </article>
    </AppShell>
  );
}
