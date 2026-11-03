'use client';

import { useTranslations } from 'next-intl';
import { Icon, type IconName } from './icons';
import { Button, Modal } from './ui';

/**
 * Kadın başka biriyle sohbetteyken beğenmeden önce gösterilen uyarı. Beğeni gönderilirse
 * sunucu onu bekletir: kadına bildirim gitmez, sohbeti bitince iletilir.
 */
export function BusyLikeDialog({ open, onClose, onConfirm, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; loading?: boolean }) {
  const t = useTranslations('busyLike');
  const steps: Array<{ icon: IconName; label: string }> = [
    { icon: 'heart', label: t('step1') },
    { icon: 'clock', label: t('step2') },
    { icon: 'bell', label: t('step3') },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button icon="heart" loading={loading} onClick={onConfirm}>
            {t('confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-brand-50 text-accent shadow-[0_0_24px_-8px_var(--accent-500)]">
            <Icon name="users" size={20} />
          </span>
          <p className="leading-relaxed">{t('text')}</p>
        </div>
        <ol className="grid grid-cols-3 gap-2" aria-label={t('stepsLabel')}>
          {steps.map((s, i) => (
            <li key={s.icon} className="relative flex flex-col items-center gap-1.5 rounded-card bg-surface-alt px-2 py-3 text-center">
              <Icon name={s.icon} size={18} className="text-brand-500" />
              <span className="text-xs font-semibold leading-tight text-ink">{s.label}</span>
              {i < steps.length - 1 && (
                <Icon name="forward" size={12} className="flip-rtl absolute -end-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-base text-ink-3" />
              )}
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-3">{t('note')}</p>
      </div>
    </Modal>
  );
}
