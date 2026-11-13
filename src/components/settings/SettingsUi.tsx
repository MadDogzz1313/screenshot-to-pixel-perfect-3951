// Bausteine des zentralen Einstellungs-Bildschirms (/einstellungen): Abschnitte, Zeilen, aufklappbare Bereiche.
import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

type Icon = ComponentType<{ className?: string }>;

export function SettingsSection({ icon: I, title, testId, children, delay = 0 }: { icon: Icon; title: string; testId: string; children: ReactNode; delay?: number }) {
  return (
    <section data-testid={testId} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="flex items-center gap-2 px-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground"><I className="h-4 w-4 text-neon" />{title}</h2>
      <div className="neon-card divide-y divide-border/60 overflow-hidden !p-0">{children}</div>
    </section>
  );
}

export function RowBody({ icon: I, label, hint, danger, trailing }: { icon: Icon; label: string; hint?: ReactNode; danger?: boolean | undefined; trailing?: ReactNode }) {
  return (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${danger ? "border-destructive/50 bg-destructive/15 text-destructive" : "border-neon/40 bg-primary/15 text-neon"}`}><I className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-[15px] font-semibold ${danger ? "text-destructive" : ""}`}>{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {trailing}
    </>
  );
}

export const rowCls = "flex min-h-16 w-full items-center gap-3 px-4 py-3 transition-[background-color,transform] duration-150 active:scale-[0.99] active:bg-primary/10";

/** Zeile, die eine andere Seite öffnet (intern) oder eine externe Adresse (mailto:, https:) */
export function LinkRow({ icon, label, hint, to, search, href, testId }: { icon: Icon; label: string; hint?: ReactNode; to?: string; search?: Record<string, string>; href?: string; testId: string }) {
  if (href) return <a href={href} data-testid={testId} className={rowCls}><RowBody icon={icon} label={label} hint={hint} trailing={<ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />} /></a>;
  return <Link to={to ?? "/"} {...(search ? { search: search as never } : {})} data-testid={testId} className={rowCls}><RowBody icon={icon} label={label} hint={hint} trailing={<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />} /></Link>;
}

/** Zeile als Schaltfläche (z. B. Abmelden, Konto löschen – Dialog-Auslöser) */
export function ButtonRow({ icon, label, hint, onClick, testId, danger, disabled }: { icon: Icon; label: string; hint?: ReactNode; onClick?: () => void; testId: string; danger?: boolean | undefined; disabled?: boolean | undefined }) {
  return <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className={`${rowCls} disabled:opacity-50`}><RowBody icon={icon} label={label} hint={hint} danger={danger} trailing={<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />} /></button>;
}

/** Reine Info-Zeile (z. B. App-Version) */
export function InfoRow({ icon, label, value, testId }: { icon: Icon; label: string; value: ReactNode; testId: string }) {
  return <div data-testid={testId} className="flex min-h-16 items-center gap-3 px-4 py-3"><RowBody icon={icon} label={label} trailing={<span className="shrink-0 text-right text-xs font-semibold text-muted-foreground">{value}</span>} /></div>;
}

/** Gemeinsamer Zustand aller aufklappbaren Zeilen: immer nur eine offen */
export function SettingsGroup({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <AccordionPrimitive.Root type="single" collapsible value={value} onValueChange={onChange}>{children}</AccordionPrimitive.Root>;
}

export function ExpandRow({ value, icon, label, hint, testId, children }: { value: string; icon: Icon; label: string; hint?: ReactNode; testId: string; children: ReactNode }) {
  return (
    <AccordionPrimitive.Item value={value} data-testid={`${testId}-item`} className="border-b border-border/60 last:border-b-0">
      <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger data-testid={testId} className={`${rowCls} group`}>
          <RowBody icon={icon} label={label} hint={hint} trailing={<ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-neon" />} />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div data-testid={`${testId}-panel`} className="space-y-3 px-4 pb-4 pt-1">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
