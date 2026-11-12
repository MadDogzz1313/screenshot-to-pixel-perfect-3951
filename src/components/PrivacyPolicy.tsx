import { PRIVACY_POLICY, type PrivacyBlock, type PrivacyLang } from "@/lib/privacy-content";

/** Datenschutzerklärung aus einer gemeinsamen Struktur (DE/EN identisch aufgebaut), mobil gut lesbar. */
export function PrivacyPolicy({ lang }: { lang: PrivacyLang }) {
  const doc = PRIVACY_POLICY[lang];
  const jump = (id: string) => document.getElementById(`privacy-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div data-testid={`privacy-policy-${lang}`} lang={lang} className="space-y-6 [&_li]:ml-0 [&_li]:list-none">
      <header className="space-y-3">
        <h1 data-testid="privacy-title" className="font-display text-xl leading-tight">{doc.title}</h1>
        {doc.intro.map((t, i) => <p key={i} data-testid={`privacy-intro-${i}`}>{t}</p>)}
      </header>

      <nav data-testid="privacy-toc" aria-label={doc.tocTitle} className="rounded-2xl border border-border/70 bg-background/40 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{doc.tocTitle}</p>
        <ol className="grid gap-1.5 text-[13px]">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <button type="button" data-testid={`privacy-toc-${s.id}`} onClick={() => jump(s.id)}
                className="text-left text-neon/90 underline-offset-2 transition-opacity duration-150 hover:underline active:opacity-60">{s.title}</button>
            </li>
          ))}
        </ol>
      </nav>

      {doc.sections.map((s) => (
        <section key={s.id} id={`privacy-${s.id}`} data-testid={`privacy-section-${s.id}`} className="scroll-mt-24 space-y-2.5 border-t border-border/50 pt-5">
          <h2 data-testid={`privacy-heading-${s.id}`} className="text-[15px] leading-snug">{s.title}</h2>
          {s.blocks.map((b, i) => <Block key={i} block={b} testId={`privacy-${s.id}-${i}`} />)}
        </section>
      ))}
    </div>
  );
}

function Block({ block, testId }: { block: PrivacyBlock; testId: string }) {
  if ("p" in block) return <p data-testid={testId}>{block.p}</p>;
  if ("sub" in block) return <h3 data-testid={testId} className="pt-1 text-sm font-semibold">{block.sub}</h3>;
  return (
    <ul data-testid={testId} className="space-y-2">
      {block.list.map((it, i) => (
        <li key={i} data-testid={`${testId}-item-${i}`} className="relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-neon/70">
          {it.label && <b className="font-semibold">{it.label}: </b>}
          {it.text}
        </li>
      ))}
    </ul>
  );
}
