'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';
import { Button, Notice } from './ui';

/** E-postası doğrulanmamış hesaplara gösterilir; profil incelemeye gönderilmeden önce gerekli. */
export function VerifyEmailBanner() {
  const t = useTranslations('verify');
  const errorText = useErrorText();
  const { me } = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!me || me.emailVerified) return null;

  async function resend() {
    setState('busy');
    setError(null);
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      setState('sent');
    } catch (e) {
      setError(errorText(e));
      setState('idle');
    }
  }

  return (
    <Notice tone="warning" icon="info">
      <strong>{t('bannerTitle')}</strong>
      <br />
      {t('bannerText', { email: me.email ?? '' })}
      <div className="mt-2">
        {state === 'sent' ? (
          <span className="font-semibold text-brand-600">{t('sent')}</span>
        ) : (
          <Button size="sm" variant="secondary" loading={state === 'busy'} onClick={resend}>
            {t('resend')}
          </Button>
        )}
        {error && <p className="mt-1 text-danger">{error}</p>}
      </div>
    </Notice>
  );
}
