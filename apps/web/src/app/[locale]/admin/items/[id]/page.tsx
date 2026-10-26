'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import type { ModerationTarget } from '@hitaba/shared';
import { Button, Card, Chip, EmptyState, Field, Notice, PageLoader, Textarea } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, mediaUrl } from '@/lib/api';
import { useErrorText } from '@/lib/format';
import { Transcript } from '@/components/Transcript';

interface Detail {
  item: { id: string; targetType: ModerationTarget; status: string; aiFlags: string[]; subjectUserId: string; subjectGender: string; reason: string | null };
  context: any;
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin');
  const errorText = useErrorText();
  const router = useRouter();
  const { data, error: loadError } = useSWR<Detail>(`/moderation/items/${id}`);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loadError) return <Notice tone="danger">{errorText(loadError)}</Notice>;
  if (!data) return <PageLoader />;
  const { item, context } = data;

  async function decide(decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    setError(null);
    try {
      await api(`/moderation/items/${id}/decision`, { method: 'POST', body: { decision, reason: reason.trim() || undefined } });
      router.push('/admin');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="info">{t(`target.${item.targetType}`)}</Chip>
          <Chip>{t(`gender.${item.subjectGender as 'MALE' | 'FEMALE'}`)}</Chip>
          {item.aiFlags.map((f) => (
            <Chip key={f} tone="accent">
              {f}
            </Chip>
          ))}
          <Link href={`/admin/users/${item.subjectUserId}`} className="text-sm font-semibold text-brand-600 hover:underline">
            {t('openUser')}
          </Link>
        </div>
        {!context ? <EmptyState icon="info" title={t('targetGone')} /> : <ContextView type={item.targetType} context={context} />}
      </div>

      <aside>
        <Card className="sticky top-4 space-y-4 p-4">
          <h2 className="text-lg font-semibold">{t('decision')}</h2>
          {item.status !== 'PENDING' ? (
            <Notice>{t('alreadyDecided', { status: item.status })}</Notice>
          ) : (
            <>
              <Field label={t('reason')} hint={t('reasonHint')}>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </Field>
              {error && <Notice tone="danger">{error}</Notice>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="danger" loading={busy} onClick={() => decide('REJECT')}>
                  {t('reject')}
                </Button>
                <Button loading={busy} onClick={() => decide('APPROVE')}>
                  {t('approve')}
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-ink-3">{t('auditNote')}</p>
        </Card>
      </aside>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-ink-3">{k}</dt>
      <dd className="whitespace-pre-wrap break-words">{v === null || v === undefined || v === '' ? '—' : v}</dd>
    </div>
  );
}

function ContextView({ type, context }: { type: ModerationTarget; context: any }) {
  const t = useTranslations('admin');
  const tf = useTranslations('onboarding.fields');

  if (type === 'PHOTO') {
    return (
      <Card className="p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(context.url)} alt="" className="max-h-[70vh] rounded-card object-contain" />
      </Card>
    );
  }

  if (type === 'PROFILE') {
    const p = context.profile;
    return (
      <>
        <Card className="p-4">
          <dl className="divide-y divide-line">
            <KV k={tf('displayName')} v={p.displayName} />
            <KV k={t('age')} v={p.age} />
            <KV k={tf('country')} v={`${p.city ?? ''}, ${p.country ?? ''}`} />
            <KV k={tf('nationality')} v={p.nationality} />
            <KV k={tf('maritalStatus')} v={`${p.maritalStatus} · ${tf('nikahCount')}: ${p.nikahCount} · ${tf('childrenCount')}: ${p.childrenCount}`} />
            <KV k={tf('aboutMe')} v={p.aboutMe} />
            <KV k={tf('aboutSpouse')} v={p.aboutSpouse} />
            <KV k={tf('beliefsManhaj')} v={p.beliefsManhaj} />
          </dl>
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">{t('screening')}</h3>
          {context.screening ? (
            <dl className="divide-y divide-line">
              {Object.entries(context.screening).map(([k, v]) => (
                <KV key={k} k={tf.has(k as never) ? tf(k as never) : k} v={String(v)} />
              ))}
            </dl>
          ) : (
            '—'
          )}
        </Card>
      </>
    );
  }

  if (type === 'MAHRAM_CONTACT') {
    const m = context.mahramContact;
    return (
      <Card className="p-4">
        <dl className="divide-y divide-line">
          <KV k={t('mahramName')} v={`${m.name} · ${m.relation}`} />
          <KV k={t('mahramContact')} v={<span dir="ltr">{m.contact}</span>} />
          <KV k={t('note')} v={m.note} />
        </dl>
      </Card>
    );
  }

  // MESSAGE: tutulan mesaj + sohbet dökümü
  return (
    <>
      <Card className="border-warning p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-warning">{t('heldMessage')}</p>
        <p className="mt-2 whitespace-pre-wrap text-[15px]">{context.message.text}</p>
        <div className="mt-2 flex gap-1">
          {context.message.contactSignals.map((s: string) => (
            <Chip key={s} tone="warning">
              {s}
            </Chip>
          ))}
        </div>
      </Card>
      <Transcript messages={context.transcript} />
    </>
  );
}
