'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AuthTokens, Me } from '@hitaba/shared/client';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field, Input, Notice } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';
import { homeFor } from '@/lib/routing';

export default function LoginPage() {
  const t = useTranslations('auth');
  const errorText = useErrorText();
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // İki adımlı doğrulaması açık hesap: şifre doğruysa API kodu ister.
  const [needOtp, setNeedOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = needOtp ? { email, password, otp } : { email, password };
      const tokens = await api<AuthTokens>('/auth/login', { method: 'POST', body, auth: false });
      await signIn(tokens);
      router.replace(homeFor(await api<Me>('/me')));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_required') {
        setNeedOtp(true);
        setBusy(false);
        return;
      }
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/register" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
            {t('registerLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('email')}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('password')}>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {needOtp && (
          <Field label={t('otpLabel')} hint={t('otpHint')}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {t('loginSubmit')}
        </Button>
      </form>
    </AuthShell>
  );
}
