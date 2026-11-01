import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { RuleAnchor } from '@/components/site/RuleAnchor';
import { SiteShell } from '@/components/site/SiteShell';
import { fill, getSite, type RuleTag } from '@/content/site';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = getSite((await params).locale);
  return { title: s.rules.title, description: s.rules.description };
}

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const TAG_STYLE: Record<RuleTag, string> = {
  allowed: 'bg-brand-100 text-brand-500',
  forbidden: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger',
  info: 'bg-info-bg text-info',
};

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const R = getSite(locale).rules;
  const tl = await getTranslations('legal');

  return (
    <SiteShell>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">{R.contents}</p>
          <ol className="space-y-1 text-sm">
            {R.sections.map((sec, i) => (
              <li key={sec.id}>
                <a href={`#${sec.id}`} className="flex gap-2 rounded-control px-2 py-1.5 text-ink-2 hover:bg-surface-alt hover:text-ink">
                  <span className="w-5 shrink-0 tabular-nums text-ink-3">{i + 1}.</span>
                  {sec.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article>
          <h1 className="text-4xl font-semibold sm:text-5xl">{R.title}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-ink-2">
            {R.intro}{' '}
            <Link href="/terms" className="font-semibold text-brand-500 hover:underline">
              {tl('terms.title')} <span className="flip-rtl inline-block">→</span>
            </Link>
          </p>
          <div className="mt-6 flex gap-3 rounded-card border border-warning/40 bg-warning-bg p-4 text-sm">
            <Icon name="info" size={20} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-ink-2">
              <strong className="text-warning">{R.important.title}. </strong>
              {R.important.text}
            </p>
          </div>

          {R.sections.map((sec, i) => (
            <section key={sec.id} id={sec.id} className="mt-14 scroll-mt-24">
              <h2 className="flex items-baseline gap-3 text-2xl font-semibold sm:text-3xl">
                <span className="font-serif text-accent">{i + 1}</span>
                {sec.title}
              </h2>
              {sec.lead && <p className="mt-2 text-ink-2">{sec.lead}</p>}
              {sec.pledges && (
                <ol className="mt-5 space-y-2">
                  {sec.pledges.map((p, j) => (
                    <li key={p}>
                      <blockquote className="flex gap-3 rounded-card border-s-4 border-accent bg-surface-alt px-4 py-3 font-serif text-[17px] italic text-ink">
                        <span className="not-italic text-accent">{j + 1}.</span> “{p}”
                      </blockquote>
                    </li>
                  ))}
                </ol>
              )}
              <ul className="mt-5 space-y-3">
                {sec.items.map((it, j) => {
                  const id = `r-${i + 1}-${j + 1}`;
                  return (
                    <li key={id} id={id} className="glass scroll-mt-24 rounded-card border p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <RuleAnchor id={id} number={`${i + 1}.${j + 1}`} label={R.copyLink} copiedLabel={R.copied} />
                        <h3 className="font-sans text-[16px] font-bold">{it.title}</h3>
                        {it.tag && <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide', TAG_STYLE[it.tag])}>{R.tags[it.tag]}</span>}
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{fill(it.text)}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </article>
      </div>
    </SiteShell>
  );
}
