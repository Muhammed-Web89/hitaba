'use client';

import { useId } from 'react';

/**
 * Çift uçlu aralık kaydırıcısı. Değer tüm aralığı kapsıyorsa "filtre yok" sayılır (undefined döner).
 * İki yerel range girdisi üst üste: klavye ve ekran okuyucu erişimi tarayıcıdan gelir.
 */
export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  unit,
  marks,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: [number | undefined, number | undefined];
  onChange: (v: [number | undefined, number | undefined]) => void;
  unit?: string;
  marks?: number[];
}) {
  const id = useId();
  const lo = value[0] ?? min;
  const hi = value[1] ?? max;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const set = (a: number, b: number) => onChange([a <= min ? undefined : a, b >= max ? undefined : b]);
  const thumb =
    'pointer-events-none absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:cursor-grab ' +
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-surface ' +
    '[&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:shadow-card ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full ' +
    '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-brand-500';

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span id={id} className="text-xs font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
        <span className="font-serif text-2xl font-semibold tabular-nums text-brand-600">
          {lo} – {hi}
          {unit && <span className="ms-1 font-sans text-sm font-normal text-ink-3">{unit}</span>}
        </span>
      </div>
      <div className="relative h-8" role="group" aria-labelledby={id}>
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-alt" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-500" style={{ insetInlineStart: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label} min`}
          onChange={(e) => set(Math.min(Number(e.target.value), hi - step), hi)}
          className={thumb}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label} max`}
          onChange={(e) => set(lo, Math.max(Number(e.target.value), lo + step))}
          className={thumb}
        />
      </div>
      {marks && (
        <div className="relative mt-1 h-4 text-xs text-ink-3">
          {marks.map((m) => (
            <span key={m} className="absolute -translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: `${pct(m)}%` }}>
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
