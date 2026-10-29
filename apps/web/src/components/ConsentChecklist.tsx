'use client';

import { useTranslations } from 'next-intl';
import type { ConsentInput } from '@hitaba/shared';
import { Link } from '@/i18n/navigation';

export type ConsentState = Record<keyof ConsentInput, boolean>;

export const EMPTY_CONSENTS: ConsentState = { privacy: false, terms: false, sensitiveData: false, adult: false };

export const allConsented = (c: ConsentState): c is ConsentInput => Object.values(c).every(Boolean);

const linkClass = 'font-semibold text-brand-600 underline underline-offset-2';

/**
 * Kayıt rızaları — her biri ayrı ve önceden işaretsiz (KVKK/GDPR: açık, özgür, bilgilendirilmiş rıza).
 * Hassas veri (din, sağlık tarama soruları) rızası ayrıca gösterilir.
 */
export function ConsentChecklist({ value, onChange }: { value: ConsentState; onChange: (v: ConsentState) => void }) {
  const t = useTranslations('consent');
  const item = (key: keyof ConsentState, label: React.ReactNode) => (
    <label key={key} className="flex items-start gap-3 text-sm leading-relaxed">
      <input
        type="checkbox"
        required
        checked={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand-500)]"
      />
      <span>{label}</span>
    </label>
  );
  return (
    <fieldset className="space-y-3 rounded-card border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-semibold">{t('title')}</legend>
      {item(
        'privacy',
        t.rich('privacy', {
          link: (chunks) => (
            <Link href="/privacy" target="_blank" className={linkClass}>
              {chunks}
            </Link>
          ),
        }),
      )}
      {item(
        'terms',
        t.rich('terms', {
          link: (chunks) => (
            <Link href="/terms" target="_blank" className={linkClass}>
              {chunks}
            </Link>
          ),
        }),
      )}
      {item('sensitiveData', t('sensitiveData'))}
      {item('adult', t('adult'))}
      <p className="text-xs text-ink-3">{t('withdraw')}</p>
    </fieldset>
  );
}
