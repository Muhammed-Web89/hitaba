'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuthTokens, ConsentInput, Gender, Me } from '@hitaba/shared';
import { AuthShell } from '@/components/AuthShell';
import { allConsented, ConsentChecklist, EMPTY_CONSENTS } from '@/components/ConsentChecklist';
import { GenderPicker } from '@/components/GenderPicker';
import { Button, Notice, PageLoader } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';
import { homeFor } from '@/lib/routing';
import '@/lib/telegram';

/** Telegram Mini App girişi: initData sunucuda HMAC-SHA256 ile doğrulanır. */
export default function TelegramEntry() {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const router = useRouter();
  const { signIn } = useAuth();
  const [state, setState] = useState<'loading' | 'signup' | 'notTelegram' | 'error'>('loading');
  const [consents, setConsents] = useState(EMPTY_CONSENTS);
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const authenticate = useCallback(
    async (g?: Gender, consents?: ConsentInput) => {
      const wa = window.Telegram?.WebApp;
      if (!wa?.initData) return setState('notTelegram');
      wa.ready();
      wa.expand();
      if (wa.colorScheme) document.documentElement.dataset.theme = wa.colorScheme;
      try {
        const tokens = await api<AuthTokens>('/auth/telegram', { method: 'POST', body: { initData: wa.initData, gender: g, consents }, auth: false });
        await signIn(tokens);
        router.replace(homeFor(await api<Me>('/me')));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'signup_required') return setState('signup');
        setError(errorText(e));
        setState('error');
      }
    },
    [errorText, router, signIn],
  );

  useEffect(() => {
    if (scriptReady) void authenticate();
  }, [scriptReady, authenticate]);

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      {state === 'loading' && <PageLoader />}
      {state === 'signup' && (
        <AuthShell title={t('tgWelcome')} subtitle={t('registerSubtitle')}>
          <div className="space-y-5">
            <GenderPicker value={gender} onChange={setGender} />
            <ConsentChecklist value={consents} onChange={setConsents} />
            <Button
              size="lg"
              className="w-full"
              disabled={!gender || !allConsented(consents)}
              onClick={() => gender && allConsented(consents) && authenticate(gender, consents)}
            >
              {t('registerSubmit')}
            </Button>
          </div>
        </AuthShell>
      )}
      {state === 'notTelegram' && (
        <AuthShell title={t('tgOnly')}>
          <Notice>{t('tgOnlyText')}</Notice>
        </AuthShell>
      )}
      {state === 'error' && (
        <AuthShell title={t('tgWelcome')}>
          <Notice tone="danger">{error}</Notice>
        </AuthShell>
      )}
    </>
  );
}
