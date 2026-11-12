'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { RULES, type ModerationTarget } from '@hitaba/shared/client';
import { Button, Card, Chip, EmptyState, Field, Notice, PageLoader, Textarea } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, mediaUrl } from '@/lib/api';
import { useErrorText } from '@/lib/format';
import { Transcript } from '@/components/Transcript';
import { KV, ProfileDetails } from '@/components/admin/ProfileDetails';

interface Detail {
  item: { id: string; targetType: ModerationTarget; status: string; aiFlags: string[]; subjectUserId: string; subjectGender: string; reason: string | null };
  context: any;
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin');
  const flagLabel = useFlagLabel();
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
              {flagLabel(f)}
            </Chip>
          ))}
          <Link href={`/admin/users/${item.subjectUserId}`} className="text-sm font-semibold text-brand-600 hover:underline">
            {t('openUser')}
          </Link>
        </div>
        {!context ? <EmptyState icon="info" title={t('targetGone')} /> : <ContextView type={item.targetType} context={context} gender={item.subjectGender} />}
      </div>

      <aside>
        <Card className="sticky top-4 space-y-4 p-4">
          <h2 className="text-lg font-semibold">{t('decision')}</h2>
          {item.status !== 'PENDING' ? (
            <Notice>{t('alreadyDecided', { status: t(`itemStatus.${item.status}` as never) })}</Notice>
          ) : (
            <>
              <Field label={t('reason')} hint={t('reasonHint')}>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </Field>
              {item.targetType === 'MESSAGE' && <Notice tone="warning">{t('banOnRejectNote')}</Notice>}
              {item.targetType === 'CHAT_EXTENSION' && <Notice>{t('extensionNote', { quota: RULES.chatMessageQuota })}</Notice>}
              {error && <Notice tone="danger">{error}</Notice>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="danger" loading={busy} onClick={() => decide('REJECT')}>
                  {item.targetType === 'MESSAGE' ? t('rejectAndBan') : t('reject')}
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

/** AI bayrakları "contact:phone" biçimindedir; çevirisi yoksa ham kod gösterilir. */
function useFlagLabel() {
  const t = useTranslations('admin.flags');
  return (flag: string) => {
    const key = flag.replace(':', '_');
    return t.has(key as never) ? t(key as never) : flag;
  };
}

function ContextView({ type, context, gender }: { type: ModerationTarget; context: any; gender: string }) {
  const t = useTranslations('admin');
  const te = useTranslations('enums');
  const flagLabel = useFlagLabel();

  if (type === 'PHOTO') {
    return (
      <Card className="p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(context.url)} alt="" loading="lazy" decoding="async" className="max-h-[70vh] rounded-card object-contain" />
      </Card>
    );
  }

  if (type === 'PROFILE') {
    return <ProfileDetails profile={context.profile} screening={context.screening} gender={gender} />;
  }

  if (type === 'MAHRAM_CONTACT') {
    const m = context.mahramContact;
    return (
      <Card className="p-4">
        <dl className="divide-y divide-line">
          <KV k={t('mahramName')} v={`${m.name} · ${te(`relation.${m.relation}` as never)}`} />
          <KV k={t('mahramContact')} v={<span dir="ltr">{m.contact}</span>} />
          <KV k={t('note')} v={m.note} />
        </dl>
      </Card>
    );
  }

  if (type === 'CHAT_EXTENSION') return <Transcript messages={context.transcript} />;

  // MESSAGE: tutulan mesaj + sohbet dökümü
  return (
    <>
      <Card className="border-warning p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-warning">{t('heldMessage')}</p>
        <p className="mt-2 whitespace-pre-wrap text-[15px]">{context.message.text}</p>
        <div className="mt-2 flex gap-1">
          {context.message.contactSignals.map((s: string) => (
            <Chip key={s} tone="warning">
              {flagLabel(`contact:${s.toLowerCase()}`)}
            </Chip>
          ))}
        </div>
      </Card>
      <Transcript messages={context.transcript} />
    </>
  );
}
