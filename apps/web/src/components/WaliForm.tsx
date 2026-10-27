'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Relation, RULES } from '@hitaba/shared';
import { api } from '@/lib/api';
import { useErrorText, useRelativeTime } from '@/lib/format';
import { Button, Card, Field, IconButton, Input, Modal, Notice, Select } from './ui';

interface WaliState {
  url: string | null;
  waliName: string | null;
  waliRelation: Relation | null;
  lastAccessAt: string | null;
  witnesses: { id: string; name: string; relation: Relation }[];
}

const RELATIONS = Object.values(Relation);

export function WaliForm({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations('wali');
  const te = useTranslations('enums.relation');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const time = useRelativeTime();
  const { data, mutate } = useSWR<WaliState>('/wali');
  const [waliName, setWaliName] = useState('');
  const [waliRelation, setWaliRelation] = useState<Relation>('FATHER');
  const [witnesses, setWitnesses] = useState<{ name: string; relation: Relation }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!data) return;
    setWaliName(data.waliName ?? '');
    setWaliRelation(data.waliRelation ?? 'FATHER');
    setWitnesses(data.witnesses.map(({ name, relation }) => ({ name, relation })));
  }, [data]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await mutate(
        await api<WaliState>('/wali', {
          method: 'PUT',
          body: {
            waliName: waliName.trim() || undefined,
            waliRelation: waliName.trim() ? waliRelation : undefined,
            witnesses: witnesses.filter((w) => w.name.trim().length >= 2),
          },
        }),
        { revalidate: false },
      );
      onSaved?.();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // Link, kullanıcının o an eriştiği adresten üretilir (yayın adresi değişse de doğru kalır).
  const link = data?.url ? `${window.location.origin}${new URL(data.url).pathname}` : null;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* yoksay */
    }
  }

  return (
    <div className="space-y-5">
      <Notice icon="shield">{t('intro')}</Notice>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label={t('waliName')}>
          <Input value={waliName} onChange={(e) => setWaliName(e.target.value)} maxLength={60} />
        </Field>
        <Field label={t('relation')}>
          <Select value={waliRelation} onChange={(e) => setWaliRelation(e.target.value as Relation)}>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {te(r)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{t('witnesses', { max: RULES.maxWitnesses })}</span>
          {witnesses.length < RULES.maxWitnesses && (
            <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setWitnesses([...witnesses, { name: '', relation: 'SISTER' }])}>
              {t('addWitness')}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {witnesses.map((w, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
              <Input
                aria-label={t('witnessName')}
                placeholder={t('witnessName')}
                value={w.name}
                maxLength={60}
                onChange={(e) => setWitnesses(witnesses.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <Select
                aria-label={t('relation')}
                value={w.relation}
                onChange={(e) => setWitnesses(witnesses.map((x, j) => (j === i ? { ...x, relation: e.target.value as Relation } : x)))}
              >
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {te(r)}
                  </option>
                ))}
              </Select>
              <IconButton icon="trash" label={tc('delete')} onClick={() => setWitnesses(witnesses.filter((_, j) => j !== i))} />
            </div>
          ))}
          {!witnesses.length && <p className="text-sm text-ink-3">{t('noWitnesses')}</p>}
        </div>
        <p className="mt-2 text-xs text-ink-3">{t('witnessPrivacy')}</p>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      <Button className="w-full" onClick={save} loading={busy}>
        {tc('save')}
      </Button>

      {data?.url && (
        <Card className="space-y-3 p-4">
          <div>
            <h3 className="font-semibold">{t('linkTitle')}</h3>
            <p className="text-sm text-ink-2">{t('linkText')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-control bg-surface-alt px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs" dir="ltr">
              {link}
            </code>
            <Button size="sm" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copy}>
              {copied ? tc('copied') : tc('copy')}
            </Button>
          </div>
          <p className="text-xs text-ink-3">{data.lastAccessAt ? t('lastAccess', { when: time.ago(data.lastAccessAt) }) : t('neverAccessed')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon="link" onClick={() => api<WaliState>('/wali/link', { method: 'POST' }).then((d) => mutate(d, { revalidate: false }))}>
              {t('regenerate')}
            </Button>
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmRevoke(true)}>
              {t('revoke')}
            </Button>
          </div>
        </Card>
      )}

      <Modal
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        title={t('revoke')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRevoke(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api('/wali/link', { method: 'DELETE' });
                setConfirmRevoke(false);
                await mutate();
              }}
            >
              {tc('confirm')}
            </Button>
          </>
        }
      >
        {t('revokeConfirm')}
      </Modal>
    </div>
  );
}
