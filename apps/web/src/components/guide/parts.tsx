'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { fill } from '@/content/site';
import type { GuideItem } from '@/content/guide';
import { Link } from '@/i18n/navigation';
import { Icon } from '../icons';
import { cx } from '../ui';

/** Ekrana girince yukarı kayarak belirir (IntersectionObserver yoksa hemen görünür). */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.shown = '';
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.shown = '';
        io.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx('reveal', className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/**
 * Telefon çerçevesi. Birden çok ekran verilirse sırayla, yumuşak geçişle döner (ekran görüntüsü
 * slaytı gibi); alttaki noktalara dokunarak da geçilebilir.
 */
export function Phone({
  children,
  interval = 3600,
  className,
  label,
  index,
  onIndex,
}: {
  children: ReactNode;
  interval?: number;
  className?: string;
  label?: string;
  /** Dışarıdan yönetilen ekran (ödeme adımları listesiyle eş zamanlı). */
  index?: number;
  onIndex?: (i: number) => void;
}) {
  const screens = Children.toArray(children);
  const [own, setOwn] = useState(0);
  const i = index ?? own;
  const setI = (v: number) => (onIndex ? onIndex(v) : setOwn(v));
  useEffect(() => {
    if (screens.length < 2) return;
    const id = setTimeout(() => setI((i + 1) % screens.length), interval);
    return () => clearTimeout(id);
    // setI her çizimde yeni; zamanlayıcı yalnızca ekran değişince kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens.length, interval, i]);
  return (
    <figure className={cx('mx-auto w-full max-w-[272px]', className)} aria-label={label}>
      <div className="relative rounded-[38px] border border-line bg-surface p-2 shadow-card">
        <div className="relative h-[452px] overflow-hidden rounded-[30px] border border-line bg-base">
          <div className="absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-line" aria-hidden="true" />
          {screens.map((s, k) => (
            <div
              key={k}
              className={cx('absolute inset-0 pt-6 transition-opacity duration-500', k === i ? 'opacity-100' : 'pointer-events-none opacity-0')}
              aria-hidden={k !== i}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
      {screens.length > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {screens.map((_, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              aria-label={`${k + 1} / ${screens.length}`}
              className={cx('h-2 rounded-full transition-all', k === i ? 'w-6 bg-brand-500' : 'w-2 bg-line')}
            />
          ))}
        </div>
      )}
    </figure>
  );
}

/** "Buraya dokun": hedefin üstünde atan halka ve basan parmak. Hedef `relative` olmalı. */
export function Tap({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cx('pointer-events-none absolute inset-0 z-10', className)} aria-hidden="true">
      <span className="guide-ping absolute inset-0 rounded-[inherit] border-2 border-accent" />
      <span className="guide-tap absolute -bottom-6 end-[-6px] text-[28px] leading-none drop-shadow">👆</span>
      {label && (
        <span className="absolute -top-7 start-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-brand-ink rtl:translate-x-1/2">
          {label}
        </span>
      )}
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">{children}</p>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">{children}</h2>;
}

/** Büyük emoji + kısa başlık + tek satır ipucu kartları. */
export function ItemGrid({ items, cols = 2 }: { items: GuideItem[]; cols?: 1 | 2 }) {
  return (
    <div className={cx('mt-6 grid gap-3', cols === 2 && 'sm:grid-cols-2')}>
      {items.map((it, k) => (
        <Reveal key={it.title} delay={k * 60}>
          <div className="glass flex h-full items-start gap-4 rounded-card border p-4">
            <span className="text-4xl leading-none">{it.emoji}</span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-snug">{fill(it.title)}</span>
              {it.tip && <span className="mt-0.5 block text-[15px] text-ink-2">{fill(it.tip)}</span>}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Numaralı adım listesi: işaretlenebilir (yalnızca bu cihazda hatırlanır). */
export function Checklist({ items, storageKey }: { items: GuideItem[]; storageKey: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {});
    } catch {
      /* yoksay */
    }
  }, [storageKey]);
  const toggle = (k: string) => {
    const next = { ...done, [k]: !done[k] };
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* yoksay */
    }
  };
  const n = items.filter((it) => done[it.title]).length;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 rounded-card bg-brand-50 px-4 py-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-alt">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-brand-500 transition-all duration-500" style={{ width: `${(n / items.length) * 100}%` }} />
        </div>
        <b className="min-w-12 text-end text-lg tabular-nums">
          {n}/{items.length}
        </b>
      </div>
      <ol className="mt-3 grid gap-2">
        {items.map((it) => {
          const on = !!done[it.title];
          return (
            <li key={it.title}>
              <button
                type="button"
                onClick={() => toggle(it.title)}
                aria-pressed={on}
                className={cx('glass glow flex w-full items-center gap-3 rounded-card border p-3 text-start transition-colors', on && 'border-brand-500/60')}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    on ? 'animate-pop border-brand-500 bg-brand-500 text-brand-ink' : 'border-line',
                  )}
                >
                  {on && <Icon name="check" size={16} />}
                </span>
                <span className="text-2xl leading-none">{it.emoji}</span>
                <span className="min-w-0">
                  <span className={cx('block text-[17px] font-semibold leading-snug', on && 'text-ink-3 line-through decoration-brand-500 decoration-2')}>{fill(it.title)}</span>
                  {it.tip && <span className="block text-sm text-ink-2">{fill(it.tip)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Durak yolu: noktalı altın çizgiyle birbirine bağlı emoji durakları. */
export function Stops({ stops, linkLabel }: { stops: Array<GuideItem & { link?: string }>; linkLabel: (href: string) => string }) {
  return (
    <ol className="relative mt-6 grid gap-5 before:absolute before:bottom-6 before:start-[27px] before:top-6 before:border-s-2 before:border-dotted before:border-accent/70">
      {stops.map((s, k) => (
        <li key={s.title}>
          <Reveal delay={k * 80} className="flex items-start gap-4">
            <span className="relative z-[1] flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-base text-2xl">{s.emoji}</span>
            <span className="min-w-0 pt-1.5">
              <span className="block text-xl font-semibold leading-snug">{fill(s.title)}</span>
              {s.tip && <span className="block text-[15px] text-ink-2">{fill(s.tip)}</span>}
              {s.link && (
                <Link href={s.link} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-500">
                  {linkLabel(s.link)}
                  <Icon name="forward" size={14} className="flip-rtl" />
                </Link>
              )}
            </span>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

/** Büyük, basılı hissi veren bağlantı düğmesi. */
export function GoLink({ href, children, tone = 'brand', external, tap }: { href: string; children: ReactNode; tone?: 'brand' | 'gold' | 'plain'; external?: boolean; tap?: boolean }) {
  const cls = cx(
    tap && 'guide-glow',
    'glow relative inline-flex min-h-12 items-center gap-2 rounded-control px-5 text-base font-bold transition-transform active:translate-y-0.5',
    tone === 'brand' && 'bg-brand-500 text-brand-ink shadow-[0_6px_24px_-6px_var(--brand-500)]',
    tone === 'gold' && 'bg-accent text-brand-ink shadow-[0_6px_24px_-8px_var(--accent-500)]',
    tone === 'plain' && 'glass border text-ink',
  );
  const body = (
    <>
      {children}
      <Icon name="forward" size={18} className="flip-rtl" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

export function DoDont({ title, yes, no, yesLabel, noLabel }: { title: string; yes: string[]; no: string[]; yesLabel: string; noLabel: string }) {
  return (
    <>
      <H2>{title}</H2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          { label: `✅ ${yesLabel}`, list: yes, cls: 'bg-brand-50' },
          { label: `⛔ ${noLabel}`, list: no, cls: 'bg-warning-bg' },
        ].map((col) => (
          <Reveal key={col.label}>
            <div className={cx('h-full rounded-card p-5', col.cls)}>
              <p className="mb-3 text-xl font-semibold">{col.label}</p>
              <ul className="grid gap-2.5 text-[17px] font-semibold">
                {col.list.map((x) => (
                  <li key={x}>{fill(x)}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </>
  );
}

export function Hero({ eyebrow, title, lead, badges, art }: { eyebrow: string; title: string; lead: string; badges: string[]; art?: ReactNode }) {
  return (
    <div className={cx('grid items-center gap-8 pt-6', Boolean(art) && 'sm:grid-cols-[1.15fr_0.85fr]')}>
      <Reveal>
        <span className="inline-block rounded-full border border-accent px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-accent">{eyebrow}</span>
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] sm:text-5xl">{title}</h1>
        <p className="mt-3 text-xl text-ink-2">{lead}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {badges.map((b, k) => (
            <span key={b} className="guide-float rounded-full border border-line bg-surface-alt px-3 py-1.5 text-sm font-semibold" style={{ animationDelay: `${k * 0.4}s` }}>
              {fill(b)}
            </span>
          ))}
        </div>
      </Reveal>
      {art}
    </div>
  );
}

export function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('mt-16 scroll-mt-20', className)}>
      {children}
    </section>
  );
}

/** Telefon taslağı + yanında numaralı kısa maddeler. */
export function ShowRow({ phone, children, flip }: { phone: ReactNode; children: ReactNode; flip?: boolean }) {
  return (
    <div className="mt-6 grid items-center gap-8 sm:grid-cols-2">
      <Reveal className={cx(flip && 'sm:order-2')}>{phone}</Reveal>
      <div>{children}</div>
    </div>
  );
}

export function Points({ points }: { points: string[] }) {
  return (
    <ol className="grid gap-3">
      {points.map((p, k) => (
        <li key={p}>
          <Reveal delay={k * 90} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 font-serif text-lg font-semibold text-brand-ink">{k + 1}</span>
            <span className="pt-1 text-lg font-semibold leading-snug">{fill(p)}</span>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
