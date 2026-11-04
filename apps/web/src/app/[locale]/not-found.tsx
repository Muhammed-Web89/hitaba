'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/icons';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('screens');
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-card border p-6 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-brand-50 text-accent">
          <Icon name="compass" size={26} />
        </span>
        <h1 className="text-2xl font-semibold">{t('notFoundTitle')}</h1>
        <p className="mt-2 text-ink-2">{t('notFoundText')}</p>
        <Link href="/" className="glow mt-5 inline-flex h-12 w-full items-center justify-center rounded-control bg-brand-500 font-semibold text-brand-ink">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
