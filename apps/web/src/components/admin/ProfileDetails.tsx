'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui';

export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-ink-3">{k}</dt>
      <dd className="whitespace-pre-wrap break-words">{v === null || v === undefined || v === '' ? '—' : v}</dd>
    </div>
  );
}

/** Profil alanları ve şifresi çözülmüş ön eleme cevapları — onay ekranı ve kullanıcı sayfası ortak kullanır. */
export function ProfileDetails({ profile: p, screening, gender }: { profile: any; screening: Record<string, unknown> | null; gender: string }) {
  const t = useTranslations('admin');
  const tf = useTranslations('onboarding.fields');
  const te = useTranslations('enums');
  const screeningValue = (k: string, v: unknown) => {
    if (typeof v === 'boolean') return t(v ? 'yes' : 'no');
    if ((k === 'prayer' || k === 'hijab') && typeof v === 'string') return te(`${k}.${v}` as never);
    return String(v);
  };
  return (
    <>
      <Card className="p-4">
        <dl className="divide-y divide-line">
          <KV k={tf('displayName')} v={p.displayName} />
          <KV k={t('age')} v={p.age} />
          <KV k={tf('country')} v={`${p.city ?? ''}, ${p.country ?? ''}`} />
          <KV k={tf('nationality')} v={p.nationality} />
          <KV
            k={tf('maritalStatus')}
            v={
              p.maritalStatus &&
              `${te(`marital.${p.maritalStatus}` as 'marital.MARRIED', { gender })} · ${tf('nikahCount')}: ${p.nikahCount} · ${tf('childrenCount')}: ${p.childrenCount}`
            }
          />
          <KV k={tf('aboutMe')} v={p.aboutMe} />
          <KV k={tf('aboutSpouse')} v={p.aboutSpouse} />
          <KV k={tf('beliefsManhaj')} v={p.beliefsManhaj} />
        </dl>
      </Card>
      <Card className="p-4">
        <h3 className="mb-2 font-semibold">{t('screening')}</h3>
        {screening ? (
          <dl className="divide-y divide-line">
            {Object.entries(screening).map(([k, v]) => (
              <KV key={k} k={tf.has(k as never) ? tf(k as never) : k} v={screeningValue(k, v)} />
            ))}
          </dl>
        ) : (
          '—'
        )}
      </Card>
    </>
  );
}
