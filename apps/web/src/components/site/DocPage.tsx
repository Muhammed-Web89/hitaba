import type { ReactNode } from 'react';
import type { SiteDoc } from '@/content/site/types';
import { SUPPORT_EMAIL } from '@/content/site';
import { SiteShell } from './SiteShell';

/** İade, çocuk güvenliği, hesap silme gibi kısa belge sayfaları. */
export function DocPage({ doc, children }: { doc: SiteDoc; children?: ReactNode }) {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-semibold sm:text-5xl">{doc.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">{doc.intro}</p>
        {children}
        {doc.sections.map((sec) => (
          <section key={sec.title} className="glass mt-5 rounded-card border p-5">
            <h2 className="font-sans text-lg font-bold">{sec.title}</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{sec.body}</p>
          </section>
        ))}
        {SUPPORT_EMAIL && (
          <p className="mt-8 text-sm text-ink-3">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-500 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        )}
      </article>
    </SiteShell>
  );
}
