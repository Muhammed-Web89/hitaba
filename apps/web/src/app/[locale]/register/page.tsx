'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AuthTokens, Gender } from '@hitaba/shared';
import { AuthShell } from '@/components/AuthShell';
import { allConsented, ConsentChecklist, EMPTY_CONSENTS } from '@/components/ConsentChecklist';
import { GenderPicker } from '@/components/GenderPicker';
import { Button, Field, Input, Notice } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const errorText = useErrorText();
  const router = useRouter();
  const { signIn } = useAuth();
  const [gender, setGender] = useState<Gender | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consents, setConsents] = useState(EMPTY_CONSENTS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!gender) return setError(t('genderRequired'));
    if (!allConsented(consents)) return setError(t('consentRequired'));
    setBusy(true);
    setError(null);
    try {
      const tokens = await api<AuthTokens>('/auth/register', { method: 'POST', body: { email, password, gender, locale, consents }, auth: false });
      await signIn(tokens);
      router.replace('/onboarding');
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t('registerTitle')}
      subtitle={t('registerSubtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
            {t('loginLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <GenderPicker value={gender} onChange={setGender} />
        <Field label={t('email')}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('password')} hint={t('passwordHint')}>
          <Input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ConsentChecklist value={consents} onChange={setConsents} />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!allConsented(consents)}>
          {t('registerSubmit')}
        </Button>
      </form>
    </AuthShell>
  );
}
