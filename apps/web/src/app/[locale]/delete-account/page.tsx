import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { DocPage } from '@/components/site/DocPage';
import { getSite } from '@/content/site';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const doc = getSite((await params).locale).docs.deleteAccount;
  return { title: doc.title, description: doc.description };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const doc = getSite(locale).docs.deleteAccount;
  return (
    <DocPage doc={doc}>
      <section className="glass mt-8 rounded-card border border-brand-500/30 p-5">
        <h2 className="font-sans text-lg font-bold">{doc.howTitle}</h2>
        <ol className="mt-3 space-y-2">
          {doc.steps.map((step, i) => (
            <li key={step} className="flex gap-3 text-[15px] text-ink-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-brand-ink">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <Link href="/app/settings" className="glow mt-4 inline-flex h-11 items-center gap-2 rounded-control bg-brand-500 px-4 font-semibold text-brand-ink">
          <Icon name="settings" size={18} /> {doc.inAppButton}
        </Link>
      </section>
    </DocPage>
  );
}
