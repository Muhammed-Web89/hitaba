import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { FaqList } from '@/components/site/FaqList';
import { SiteShell } from '@/components/site/SiteShell';
import { getSite } from '@/content/site';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = getSite((await params).locale);
  return { title: s.faq.title, description: s.faq.description };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const F = getSite(locale).faq;
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-semibold sm:text-5xl">{F.title}</h1>
        <p className="mt-4 text-ink-2">{F.intro}</p>
        {F.groups.map((g) => (
          <section key={g.title} className="mt-10">
            <h2 className="mb-4 text-2xl font-semibold">{g.title}</h2>
            <FaqList items={g.items} />
          </section>
        ))}
      </div>
    </SiteShell>
  );
}
