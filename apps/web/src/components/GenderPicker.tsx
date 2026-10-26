'use client';

import { useTranslations } from 'next-intl';
import type { Gender } from '@hitaba/shared';
import { cx } from './ui';

export function GenderPicker({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  const t = useTranslations('auth');
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{t('genderQuestion')}</legend>
      <div className="grid grid-cols-2 gap-3">
        {(['MALE', 'FEMALE'] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={value === g}
            onClick={() => onChange(g)}
            className={cx(
              'rounded-card border p-4 text-start transition-colors',
              value === g ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:bg-surface-alt',
            )}
          >
            <span className="block font-serif text-lg font-semibold">{t(g === 'MALE' ? 'brother' : 'sister')}</span>
            <span className="mt-0.5 block text-xs text-ink-3">{t(g === 'MALE' ? 'brotherHint' : 'sisterHint')}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">{t('genderPermanent')}</p>
    </fieldset>
  );
}
