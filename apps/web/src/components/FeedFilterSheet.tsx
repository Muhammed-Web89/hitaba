'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { NATIONALITY_CODES, RULES, type FeedFilter } from '@hitaba/shared/client';
import { useAuth } from '@/lib/auth';
import { useCatalog } from '@/lib/catalog';
import { LANGUAGE_CODES, useDisplayNames } from '@/lib/format';
import { CityPicker } from './pickers';
import { RangeSlider } from './RangeSlider';
import { Button, cx, IconButton, Select, Toggle } from './ui';

const countActive = (f: FeedFilter) => Object.values(f).filter((v) => v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && !v.length)).length;

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass glow rounded-card border p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Tam ekran filtre sayfası; değişiklikler "Uygula" ile bir sonraki profilden itibaren geçerli olur. */
export function FilterSheet({ onClose, value, onApply }: { onClose: () => void; value: FeedFilter; onApply: (f: FeedFilter) => void }) {
  const t = useTranslations('feed.filter');
  const tf = useTranslations('feed');
  const names = useDisplayNames();
  const catalog = useCatalog();
  const { me } = useAuth();
  const [f, setF] = useState<FeedFilter>(value);
  const isMale = me?.gender === 'MALE';
  const toggle = (key: keyof FeedFilter, label: string, hint?: string) => (
    <Toggle checked={!!f[key]} onChange={(v) => setF({ ...f, [key]: v || undefined })} label={label} description={hint} />
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-base/95 pt-[var(--app-safe-top)] backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="filters-title">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-2">
        <IconButton icon="x" label={tf('close')} onClick={onClose} />
        <h2 id="filters-title" className="text-lg font-semibold">
          {tf('filters')}
        </h2>
        <button type="button" onClick={() => setF({})} className={cx('px-3 text-sm font-semibold', countActive(f) ? 'text-brand-600' : 'text-ink-3')}>
          {t('clear')}
        </button>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <FilterSection title={t('where')}>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t('country')}</span>
            <Select value={f.countries?.[0] ?? ''} onChange={(e) => setF({ ...f, countries: e.target.value ? [e.target.value] : undefined, city: e.target.value ? f.city : undefined })}>
              <option value="">{t('any')}</option>
              {names.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          {f.countries?.length ? (
            <div>
              <span className="mb-1 block text-sm text-ink-2">{t('city')}</span>
              <CityPicker country={f.countries[0]} value={f.city ?? ''} placeholder={t('any')} onChange={(city) => setF({ ...f, city: city || undefined })} />
              {f.city && (
                <button type="button" onClick={() => setF({ ...f, city: undefined })} className="mt-1 text-xs font-semibold text-brand-500">
                  {t('anyCity')}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-3">{t('pickCountryFirst')}</p>
          )}
        </FilterSection>

        <FilterSection title={t('origin')}>
          <div>
            <span className="mb-1.5 block text-sm text-ink-2">{t('nationality')}</span>
            <div className="flex flex-wrap gap-1.5">
              {[undefined, ...NATIONALITY_CODES].map((code) => {
                const on = f.nationality === code;
                return (
                  <button
                    key={code ?? 'any'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setF({ ...f, nationality: code })}
                    className={cx('glow rounded-full border px-3 py-1.5 text-xs font-semibold', on ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'glass text-ink-2')}
                  >
                    {code ? catalog.nationality(code) : t('any')}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{t('language')}</span>
            <Select value={f.language ?? ''} onChange={(e) => setF({ ...f, language: e.target.value || undefined })}>
              <option value="">{t('any')}</option>
              {LANGUAGE_CODES.map((l) => (
                <option key={l} value={l}>
                  {names.language(l)}
                </option>
              ))}
            </Select>
          </label>
        </FilterSection>

        <section className="space-y-6 glass glow rounded-card border p-4">
          <RangeSlider label={t('age')} min={RULES.minAge} max={RULES.maxAge} value={[f.ageMin, f.ageMax]} onChange={([a, b]) => setF({ ...f, ageMin: a, ageMax: b })} marks={[18, 30, 50, 80]} />
          <RangeSlider label={t('height')} min={120} max={230} unit="cm" value={[f.heightMin, f.heightMax]} onChange={([a, b]) => setF({ ...f, heightMin: a, heightMax: b })} marks={[120, 150, 180, 230]} />
          <RangeSlider label={t('weight')} min={35} max={200} unit="kg" value={[f.weightMin, f.weightMax]} onChange={([a, b]) => setF({ ...f, weightMin: a, weightMax: b })} marks={[35, 80, 140, 200]} />
        </section>

        <FilterSection title={t('profile')}>
          {toggle('willingToRelocate', t('relocate'), t('relocateHint'))}
          {toggle('withPhoto', t('withPhoto'), t('withPhotoHint'))}
          {toggle('noChildren', t('noChildren'), t('noChildrenHint'))}
          {toggle('neverMarried', t('neverMarried'), t('neverMarriedHint'))}
          {isMale && toggle('openToPolygamy', t('polygamy'), t('polygamyHint'))}
          {isMale && toggle('notBusy', t('notBusy'), t('notBusyHint'))}
        </FilterSection>
      </div>

      <footer className="shrink-0 glass border-t px-4 py-3" style={{ paddingBottom: 'max(12px, var(--app-safe-bottom))' }}>
        <div className="mx-auto max-w-lg">
          <Button size="lg" className="w-full" onClick={() => onApply(f)}>
            {t('apply')}
          </Button>
          <p className="mt-2 text-center text-xs text-ink-3">{t('applyHint')}</p>
        </div>
      </footer>
    </div>
  );
}
