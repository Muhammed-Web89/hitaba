'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ReportCategory } from '@hitaba/shared/client';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/format';
import { Button, Field, Modal, Notice, Select, Textarea, Toggle } from './ui';

/**
 * Şikâyet ve engelleme. Engellenen kişi bir daha akışta, beğenilerde, eşleşmelerde görünmez; açık sohbet kapanır.
 * onBlocked: pencere kapanınca çağrılır (akış sonraki karta geçer, sohbet/eşleşme sayfası listeye döner).
 */
export function ReportDialog({
  open,
  onClose,
  targetUserId,
  chatId,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  chatId?: string;
  onBlocked?: () => void;
}) {
  const t = useTranslations('report');
  const te = useTranslations('enums.report');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const [category, setCategory] = useState<ReportCategory>('INAPPROPRIATE');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [reported, setReported] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setState('busy');
    setError(null);
    try {
      await api('/reports', { method: 'POST', body: { targetUserId, chatId, category, details: details.trim() || undefined } });
      setReported(true);
      if (alsoBlock) {
        await api(`/blocks/${targetUserId}`, { method: 'POST' });
        setBlocked(true);
      }
      setState('done');
    } catch (e) {
      setError(errorText(e));
      setState('idle');
    }
  }

  async function blockOnly() {
    setState('busy');
    setError(null);
    try {
      await api(`/blocks/${targetUserId}`, { method: 'POST' });
      setBlocked(true);
      setState('done');
    } catch (e) {
      setError(errorText(e));
      setState('idle');
    }
  }

  const close = () => {
    onClose();
    if (blocked) onBlocked?.();
    setTimeout(() => {
      setState('idle');
      setDetails('');
      setBlocked(false);
      setReported(false);
      setConfirmBlock(false);
    }, 200);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('title')}
      footer={
        state === 'done' ? (
          <Button onClick={close}>{tc('close')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {tc('cancel')}
            </Button>
            <Button variant="danger" loading={state === 'busy'} onClick={submit}>
              {t('submit')}
            </Button>
          </>
        )
      }
    >
      {state === 'done' ? (
        <Notice tone="success" icon="check">
          {t(reported ? (blocked ? 'thanksBlocked' : 'thanks') : 'blockedOnly')}
        </Notice>
      ) : (
        <div className="space-y-4">
          <Field label={t('category')}>
            <Select value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
              {Object.values(ReportCategory).map((c) => (
                <option key={c} value={c}>
                  {te(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('details')}>
            <Textarea rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <Toggle checked={alsoBlock} onChange={setAlsoBlock} label={t('alsoBlock')} description={t('blockHint')} />
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="border-t border-line pt-3">
            {confirmBlock ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-2">{t('blockConfirm')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmBlock(false)}>
                    {tc('cancel')}
                  </Button>
                  <Button size="sm" variant="danger" loading={state === 'busy'} onClick={blockOnly}>
                    {t('blockOnly')}
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className="text-sm font-semibold text-danger hover:underline" onClick={() => setConfirmBlock(true)}>
                {t('blockOnly')}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
