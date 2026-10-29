'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/AuthShell';
import { Notice, PageLoader } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';

// useSearchParams statik ön-render sırasında Suspense sınırı ister.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const t = useTranslations('verify');
  const errorText = useErrorText();
  const token = useSearchParams().get('token') ?? '';
  const { signedIn, refreshMe } = useAuth();
  const [state, setState] = useState<'busy' | 'ok' | 'error'>('busy');
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Strict mode'da çift çağrı tek kullanımlık token'ı yakmasın.
    if (ran.current) return;
    ran.current = true;
    api('/auth/verify-email', { method: 'POST', body: { token }, auth: false })
      .then(() => {
        setState('ok');
        if (signedIn) void refreshMe();
      })
      .catch((e) => {
        setError(errorText(e));
        setState('error');
      });
  }, [token, signedIn, refreshMe, errorText]);

  if (state === 'busy') return <PageLoader />;
  return (
    <AuthShell title={state === 'ok' ? t('okTitle') : t('errorTitle')}>
      {state === 'ok' ? (
        <Notice tone="success" icon="check">
          {t('okText')}
        </Notice>
      ) : (
        <Notice tone="danger">{error}</Notice>
      )}
      <Link href={signedIn ? '/onboarding' : '/login'} className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-control bg-brand-500 font-semibold text-brand-ink">
        {t('continue')}
      </Link>
    </AuthShell>
  );
}
