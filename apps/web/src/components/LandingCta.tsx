'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

const btn = 'inline-flex h-12 items-center justify-center rounded-control px-5 font-semibold transition-colors';

export function LandingCta() {
  const t = useTranslations('landing');
  const { me } = useAuth();
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {me ? (
        <Link href={me.role === 'USER' ? '/app' : '/admin'} className={`${btn} bg-brand-500 text-brand-ink hover:bg-brand-600`}>
          {t('openApp')}
        </Link>
      ) : (
        <>
          <Link href="/register" className={`${btn} bg-brand-500 text-brand-ink hover:bg-brand-600`}>
            {t('ctaRegister')}
          </Link>
          <Link href="/login" className={`${btn} border border-line hover:bg-surface-alt`}>
            {t('ctaLogin')}
          </Link>
        </>
      )}
    </div>
  );
}
