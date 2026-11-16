'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuthTokens, ConsentInput, Gender, Me } from '@hitaba/shared/client';
import { AuthShell } from '@/components/AuthShell';
import { allConsented, ConsentChecklist, EMPTY_CONSENTS } from '@/components/ConsentChecklist';
import { GenderPicker } from '@/components/GenderPicker';
import { Button, Notice, PageLoader } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, tokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';
import { homeFor } from '@/lib/routing';
import { cachedMe } from '@/lib/cache';
import { lastTelegramUser, loadTelegramSdk, rememberTelegramUser, telegramUserId } from '@/lib/telegram';

const WIDGET_KEYS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'];

/** Telegram Login Widget yönlendirmesiyle gelen alanlar (tarayıcı / Android uygulaması). */
function widgetFields(): Record<string, string> | null {
  const qs = new URLSearchParams(window.location.search);
  if (!qs.get('hash') || !qs.get('id')) return null;
  return Object.fromEntries(WIDGET_KEYS.flatMap((k) => (qs.has(k) ? [[k, qs.get(k) as string]] : [])));
}

/**
 * Telegram girişi. Mini App'te initData, tarayıcıda Login Widget alanları sunucuda HMAC-SHA256 ile doğrulanır.
 */
export default function TelegramEntry() {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const router = useRouter();
  const { signIn } = useAuth();
  const [state, setState] = useState<'loading' | 'signup' | 'notTelegram' | 'error'>('loading');
  const [consents, setConsents] = useState(EMPTY_CONSENTS);
  const [gender, setGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(
    async (g?: Gender, consents?: ConsentInput) => {
      const widget = widgetFields();
      const wa = window.Telegram?.WebApp;
      if (!widget && !wa?.initData) return setState('notTelegram');
      try {
        const source = widget ? { widget } : { initData: wa?.initData };
        const t = await api<AuthTokens>('/auth/telegram', { method: 'POST', body: { ...source, gender: g, consents }, auth: false });
        await signIn(t);
        rememberTelegramUser(telegramUserId());
        router.replace(homeFor(cachedMe<Me>() ?? (await api<Me>('/me'))));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'signup_required') return setState('signup');
        setError(errorText(e));
        setState('error');
      }
    },
    [errorText, router, signIn],
  );

  useEffect(() => {
    // Bu cihazda aynı Telegram hesabıyla daha önce girildiyse sunucuyu beklemeden son ekrana geç;
    // oturum arka planda tazelenir (süresi dolmuşsa yenileme belirteci zaten devreye girer).
    const known = cachedMe<Me>();
    const tgId = telegramUserId();
    if (known && tokens.refresh && tgId && tgId === lastTelegramUser()) {
      router.replace(homeFor(known));
      return;
    }
    if (widgetFields()) void authenticate();
    else void loadTelegramSdk().then(() => authenticate());
  }, [authenticate, router]);

  return (
    <>
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
