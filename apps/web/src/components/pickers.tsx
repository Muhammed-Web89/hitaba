'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { INTEREST_CODES, RULES } from '@hitaba/shared/client';
import { INTEREST_ICONS, useCatalog } from '@/lib/catalog';
import { citiesFor, normalizeCity } from '@/lib/cities';
import { Icon, type IconName } from './icons';
import { cx } from './ui';

/** Yazmayı azaltan seçim bileşenleri: hepsi dokunarak doldurulur. */

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  icon?: IconName;
}

/** Tek seçimli çipler (radyo grubu). */
export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  wide,
}: {
  label: string;
  options: ChoiceOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  /** Çipler satırı eşit genişlikte doldurur (az seçenek için). */
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-2 text-sm font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className={cx('gap-2', wide ? 'grid grid-flow-col auto-cols-fr' : 'flex flex-wrap')}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cx(
                'glow inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control border px-3.5 py-2 text-sm font-semibold transition-colors',
                on ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'glass text-ink-2 hover:text-ink',
              )}
            >
              {o.icon && <Icon name={o.icon} size={17} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** − sayı + sayacı (klavye açılmaz). */
export function Stepper({ label, icon, value, min = 0, max, onChange, format }: { label: string; icon?: IconName; value: number; min?: number; max: number; onChange: (v: number) => void; format?: (n: number) => string }) {
  const id = useId();
  return (
    <div className="glass flex items-center justify-between gap-3 rounded-card border px-4 py-3">
      <span id={id} className="flex items-center gap-2 text-[15px] font-semibold">
        {icon && <Icon name={icon} size={18} className="text-brand-500" />}
        {label}
      </span>
      <div className="flex items-center gap-1" role="group" aria-labelledby={id}>
        <button type="button" aria-label="−" disabled={value <= min} onClick={() => onChange(value - 1)} className="glow flex h-10 w-10 items-center justify-center rounded-full border border-line disabled:opacity-30">
          <Icon name="minus" size={18} />
        </button>
        <output aria-live="polite" className="min-w-10 text-center font-serif text-xl font-semibold tabular-nums">
          {format ? format(value) : value}
        </output>
        <button type="button" aria-label="+" disabled={value >= max} onClick={() => onChange(value + 1)} className="glow flex h-10 w-10 items-center justify-center rounded-full border border-line disabled:opacity-30">
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Tek değerli kaydırıcı (boy, kilo). */
export function ValueSlider({ label, icon, min, max, value, unit, onChange }: { label: string; icon?: IconName; min: number; max: number; value: number; unit: string; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="glass block rounded-card border p-4">
      <span className="mb-3 flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon && <Icon name={icon} size={18} className="text-brand-500" />}
          {label}
        </span>
        <span className="font-serif text-3xl font-semibold tabular-nums text-brand-500">
          {value}
          <span className="ms-1 font-sans text-sm font-normal text-ink-3">{unit}</span>
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-base [&::-moz-range-thumb]:bg-brand-500 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--brand-500)_var(--p),var(--bg-surface-alt)_var(--p))] [&::-webkit-slider-thumb]:-mt-[11px] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-base [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-[0_0_14px_var(--brand-500)]"
        style={{ ['--p' as string]: `${pct}%` }}
      />
    </label>
  );
}

/** Aranabilir şehir seçimi; listede yoksa yazılan ad kullanılabilir. */
export function CityPicker({ country, value, onChange, placeholder }: { country: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const t = useTranslations('pickers');
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const cities = useMemo(() => citiesFor(country), [country]);

  useEffect(() => setQuery(value), [value]);
  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const q = normalizeCity(query);
  const matches = q && q !== normalizeCity(value) ? cities.filter((c) => c.keys.some((k) => k.includes(q))) : cities;
  const exact = cities.some((c) => c.keys.includes(q));
  const pick = (v: string) => {
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder ?? t('citySearch')}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => query.trim() && query.trim() !== value && onChange(query.trim())}
          className="h-12 w-full rounded-control border border-line bg-surface ps-10 pe-10 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand-500 focus:outline-none"
        />
        <Icon name="chevronDown" size={18} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-3" />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="glass absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-card border p-1 shadow-card">
          {matches.map((c) => (
            <li key={c.name} role="option" aria-selected={c.name === value}>
              <button
                type="button"
                onClick={() => pick(c.name)}
                className={cx('glow flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-start text-[15px]', c.name === value && 'text-brand-500')}
              >
                <Icon name="pin" size={16} className="shrink-0 text-ink-3" />
                <span className="flex-1">{c.name}</span>
                {c.name === value && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
          {query.trim() && !exact && (
            <li role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(query.trim())} className="glow flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-start text-[15px] text-brand-500">
                <Icon name="plus" size={16} />
                {t('useCity', { city: query.trim() })}
              </button>
            </li>
          )}
          {!matches.length && !query.trim() && <li className="px-3 py-2.5 text-sm text-ink-3">{t('typeCity')}</li>}
        </ul>
      )}
    </div>
  );
}

/** TikTok/Pinterest tarzı ilgi alanı ızgarası: ikonlu kartlar, çoklu seçim. */
export function InterestGrid({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations('pickers');
  const catalog = useCatalog();
  const full = value.length >= RULES.maxInterests;
  return (
    <fieldset>
      <legend className="mb-1 flex w-full items-baseline justify-between text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          <Icon name="sparkle" size={16} className="text-accent" />
          {t('interests')}
        </span>
        <span className="text-xs font-semibold tabular-nums text-ink-3">
          {value.length}/{RULES.maxInterests}
        </span>
      </legend>
      <p className="mb-3 text-xs text-ink-3">{t('interestsHint')}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {INTEREST_CODES.map((code) => {
          const on = value.includes(code);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(on ? value.filter((v) => v !== code) : [...value, code])}
              className={cx(
                'glow relative flex aspect-[4/3.4] flex-col items-center justify-center gap-1.5 rounded-card border p-2 text-center text-xs font-semibold leading-tight transition-all disabled:opacity-40',
                on ? 'border-brand-500 bg-brand-100 text-ink shadow-[0_0_18px_-4px_var(--brand-500)]' : 'glass text-ink-2',
              )}
            >
              <Icon name={INTEREST_ICONS[code]} size={26} className={on ? 'text-brand-500' : 'text-ink-3'} />
              {catalog.interest(code)}
              {on && (
                <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-brand-ink">
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Alışkanlık kutucuğu: büyük ikon + iki ikonlu düğme (⃠ hayır / ✓ evet). Kısa ad yalnızca ikonun altında
 * küçük yazılır ve ekran okuyucu için etiket olur.
 */
export function HabitTile({ icon, label, value, onChange }: { icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations('pickers');
  return (
    <div role="radiogroup" aria-label={label} className={cx('glass flex flex-col items-center gap-2 rounded-card border p-3', value && 'border-warning/60')}>
      <span className="relative flex h-12 w-12 items-center justify-center" title={label}>
        <Icon name={icon} size={30} className={value ? 'text-warning' : 'text-ink-2'} />
        {!value && <Icon name="ban" size={46} strokeWidth={1.6} className="absolute inset-0 m-auto text-brand-500/80" />}
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-ink-3">{label}</span>
      <div className="grid w-full grid-cols-2 gap-1.5">
        {([false, true] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={v ? t('yes') : t('no')}
            title={v ? t('yes') : t('no')}
            onClick={() => onChange(v)}
            className={cx(
              'glow flex h-9 items-center justify-center rounded-control border',
              value === v ? (v ? 'border-warning bg-warning-bg text-warning' : 'border-brand-500 bg-brand-500 text-brand-ink') : 'border-line text-ink-3',
            )}
          >
            <Icon name={v ? 'check' : 'ban'} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
