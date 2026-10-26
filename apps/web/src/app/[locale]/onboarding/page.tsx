'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { Me, OwnProfile } from '@hitaba/shared';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { draftFrom, payloadFor, StepFields, stepsFor, type Draft } from '@/components/ProfileSteps';
import { Button, Notice, PageLoader } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const router = useRouter();
  const { me, loading, signedIn, refreshMe } = useAuth();
  const { data: profile, mutate } = useSWR<OwnProfile>(me ? '/profile' : null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !signedIn) router.replace('/login');
  }, [loading, signedIn, router]);

  useEffect(() => {
    if (me && me.status !== 'ONBOARDING' && me.status !== 'REJECTED') router.replace('/app');
  }, [me, router]);

  const steps = useMemo(() => (me ? stepsFor(me.gender) : []), [me]);

  // Taslaktan devam: ilk tamamlanmamış adım.
  useEffect(() => {
    if (!profile || draft) return;
    setDraft(draftFrom(profile));
    const first = steps.findIndex((s) => s !== 'photos' && s !== 'wali' && !profile.completedSteps.includes(s));
    setIndex(first === -1 ? steps.length - 1 : first);
  }, [profile, draft, steps]);

  if (!me || !profile || !draft) return <PageLoader />;

  const step = steps[index];
  const set = (patch: Draft) => setDraft({ ...draft, ...patch });
  const isLast = index === steps.length - 1;

  async function next() {
    setError(null);
    setBusy(true);
    try {
      if (step !== 'photos' && step !== 'wali') {
        await api(`/profile/steps/${step}`, { method: 'PUT', body: payloadFor(step, draft!, me!.gender) });
      }
      if (isLast) {
        await api<Me>('/profile/submit', { method: 'POST' });
        await refreshMe();
        router.replace('/app');
        return;
      }
      await mutate();
      setIndex(index + 1);
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'steps_incomplete' && Array.isArray(e.details)) {
        const missing = steps.findIndex((s) => (e.details as string[]).includes(s));
        if (missing >= 0) setIndex(missing);
      }
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-28">
      <header className="flex h-16 items-center justify-between">
        <Logo href="/onboarding" />
        <span className="text-sm text-ink-3">{t('stepOf', { current: index + 1, total: steps.length })}</span>
      </header>
      <div className="h-1 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      {me.status === 'REJECTED' && (
        <div className="mt-5">
          <Notice tone="warning" icon="info">
            <strong>{t('rejectedTitle')}</strong>
            <br />
            {me.statusReason ?? t('rejectedNoReason')}
          </Notice>
        </div>
      )}

      <main className="mt-6">
        <h1 className="text-2xl font-semibold">{t(`steps.${step}.title`)}</h1>
        <p className="mt-1 text-ink-2">{t(`steps.${step}.why`)}</p>
        <div className="mt-6 space-y-5">
          <StepFields step={step} draft={draft} set={set} gender={me.gender} />
        </div>
        {error && (
          <div className="mt-5">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-lg gap-3">
          <Button variant="secondary" disabled={index === 0 || busy} onClick={() => setIndex(index - 1)} aria-label={tc('back')}>
            <Icon name="back" size={18} className="flip-rtl" />
          </Button>
          <Button className="flex-1" size="lg" loading={busy} onClick={next} disabled={step === 'rules' && !draft.acceptedRules}>
            {isLast ? t('submit') : step === 'photos' || step === 'wali' ? t('continue') : t('saveContinue')}
          </Button>
        </div>
      </footer>
    </div>
  );
}

