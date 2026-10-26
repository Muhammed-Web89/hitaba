'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ReportCategory } from '@hitaba/shared';
import { api } from '@/lib/api';
import { useErrorText } from '@/lib/format';
import { Button, Field, Modal, Notice, Select, Textarea } from './ui';

export function ReportDialog({ open, onClose, targetUserId, chatId }: { open: boolean; onClose: () => void; targetUserId: string; chatId?: string }) {
  const t = useTranslations('report');
  const te = useTranslations('enums.report');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const [category, setCategory] = useState<ReportCategory>('INAPPROPRIATE');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setState('busy');
    setError(null);
    try {
      await api('/reports', { method: 'POST', body: { targetUserId, chatId, category, details: details.trim() || undefined } });
      setState('done');
    } catch (e) {
      setError(errorText(e));
      setState('idle');
    }
  }

  const close = () => {
    onClose();
    setTimeout(() => {
      setState('idle');
      setDetails('');
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
          {t('thanks')}
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
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      )}
    </Modal>
  );
}
