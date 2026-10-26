import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Icon, type IconName } from '@/components/icons';
import { LandingCta } from '@/components/LandingCta';
import { LocaleMenu } from '@/components/LocaleMenu';
import { Logo } from '@/components/Logo';
import type { Locale } from '@/i18n/routing';

const PRINCIPLES: Array<{ key: 'witnessed' | 'wali' | 'privacy' | 'moderation'; icon: IconName }> = [
  { key: 'witnessed', icon: 'users' },
  { key: 'wali', icon: 'shield' },
  { key: 'privacy', icon: 'lock' },
  { key: 'moderation', icon: 'eye' },
];

const STEPS = ['profile', 'match', 'photo', 'chat', 'family'] as const;

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('landing');

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <LocaleMenu />
      </header>

      <section className="grid items-center gap-10 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-16">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            {t('eyebrow')}
          </p>
          <h1 className="text-4xl font-semibold sm:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-lg text-lg text-ink-2">{t('subtitle')}</p>
          <LandingCta />
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card" aria-hidden="true">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="h-12 w-12 rounded-full bg-brand-100" />
            <div className="flex-1">
              <div className="h-3 w-28 rounded bg-surface-alt" />
              <div className="mt-2 h-2.5 w-20 rounded bg-surface-alt" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600">
              <Icon name="users" size={14} /> {t('mock.witnesses')}
            </span>
          </div>
          <div className="space-y-3 py-4">
            <div className="max-w-[75%] rounded-card bg-surface-alt px-3 py-2 text-sm">{t('mock.msg1')}</div>
            <div className="ms-auto max-w-[75%] rounded-card bg-bubble px-3 py-2 text-sm">{t('mock.msg2')}</div>
            <div className="flex gap-2 rounded-card bg-warning-bg px-3 py-2 text-xs text-warning">
              <Icon name="pause" size={16} className="shrink-0" /> {t('mock.held')}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map(({ key, icon }) => (
          <div key={key} className="rounded-card border border-line bg-surface p-5">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <Icon name={icon} />
            </span>
            <h3 className="text-lg font-semibold">{t(`principles.${key}.title`)}</h3>
            <p className="mt-1 text-sm text-ink-2">{t(`principles.${key}.text`)}</p>
          </div>
        ))}
      </section>

      <section className="py-10">
        <h2 className="text-3xl font-semibold">{t('howTitle')}</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s} className="relative rounded-card border border-line bg-surface p-4">
              <span className="font-serif text-2xl text-accent">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-1 font-semibold">{t(`steps.${s}.title`)}</h3>
              <p className="mt-1 text-sm text-ink-2">{t(`steps.${s}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-line py-8 text-sm text-ink-3">
        <p>{t('footer')}</p>
      </footer>
    </div>
  );
}
