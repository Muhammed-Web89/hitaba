'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { PROFILE_STEP_ORDER, type OwnProfile, type ProfileStepKey } from '@hitaba/shared';
import { draftFrom, payloadFor, StepFields, type Draft } from '@/components/ProfileSteps';
import { Button, EmptyState, IconButton, Notice, PageLoader } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/format';

export default function EditStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = use(params);
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const router = useRouter();
  const { me } = useAuth();
  const { data: profile, mutate } = useSWR<OwnProfile>('/profile');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !draft) setDraft(draftFrom(profile));
  }, [profile, draft]);

  if (!PROFILE_STEP_ORDER.includes(step as ProfileStepKey) || step === 'rules') return <EmptyState icon="user" title={tc('notFound')} />;
  if (!draft || !me) return <PageLoader />;
  const key = step as ProfileStepKey;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/profile/steps/${key}`, { method: 'PUT', body: payloadFor(key, draft!, me!.gender) });
      await mutate();
      router.push('/app/profile');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <IconButton icon="back" label={tc('back')} onClick={() => router.push('/app/profile')} className="flip-rtl" />
      <h1 className="mt-2 text-2xl font-semibold">{t(`steps.${key}.title`)}</h1>
      <p className="mt-1 text-ink-2">{t(`steps.${key}.why`)}</p>
      <div className="mt-6 space-y-5">
        <StepFields step={key} draft={draft} set={(p) => setDraft({ ...draft, ...p })} gender={me.gender} />
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <Button className="mt-6 w-full" size="lg" loading={busy} onClick={save}>
        {tc('save')}
      </Button>
    </div>
  );
}
