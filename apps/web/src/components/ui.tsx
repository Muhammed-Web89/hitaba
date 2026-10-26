'use client';

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, type IconName } from './icons';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: IconName }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-brand-500 text-brand-ink hover:bg-brand-600',
        variant === 'secondary' && 'border border-line bg-transparent text-ink hover:bg-surface-alt',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-alt hover:text-ink',
        variant === 'danger' && 'bg-danger text-white hover:opacity-90',
        className,
      )}
    >
      {loading ? <Spinner size={16} /> : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, size = 20, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx('inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-alt hover:text-ink disabled:opacity-40', className)}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('rounded-card border border-line bg-surface shadow-card', className)}>
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children, counter }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; counter?: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
        {label}
        {counter}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-3">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}

const control =
  'w-full rounded-control border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-brand-500 focus:outline-none';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, 'h-11', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, 'min-h-28 py-2.5 leading-relaxed', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, 'h-11 appearance-auto', props.className)} />;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[15px] font-semibold">{label}</span>
        {description && <span className="block text-sm text-ink-3">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-500' : 'bg-line')}
      >
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'start-6' : 'start-1')} />
      </button>
    </div>
  );
}

export function Chip({ children, active, onClick, tone = 'neutral' }: { children: ReactNode; active?: boolean; onClick?: () => void; tone?: 'neutral' | 'brand' | 'accent' | 'warning' | 'info' }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick && { type: 'button' as const, onClick, 'aria-pressed': active })}
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold',
        active ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'border-line',
        !active && tone === 'neutral' && 'bg-surface-alt text-ink-2',
        !active && tone === 'brand' && 'border-transparent bg-brand-100 text-brand-700 dark:text-brand-300',
        !active && tone === 'accent' && 'border-accent/40 bg-transparent text-accent',
        !active && tone === 'warning' && 'border-transparent bg-warning-bg text-warning',
        !active && tone === 'info' && 'border-transparent bg-info-bg text-info',
        onClick && 'cursor-pointer',
      )}
    >
      {children}
    </Tag>
  );
}

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  const t = useTranslations('common');
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-brand-500" role="status" aria-label={t('loading')}>
      <Spinner size={32} />
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-2">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', icon = 'info', children }: { tone?: 'info' | 'warning' | 'success' | 'danger'; icon?: IconName; children: ReactNode }) {
  return (
    <div
      className={cx(
        'flex gap-3 rounded-card px-4 py-3 text-sm',
        tone === 'info' && 'bg-info-bg text-info',
        tone === 'warning' && 'bg-warning-bg text-warning',
        tone === 'success' && 'bg-brand-50 text-brand-600',
        tone === 'danger' && 'bg-warning-bg text-danger',
      )}
    >
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-ink-2 [&_strong]:text-ink">{children}</div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="mt-3 text-[15px] text-ink-2">{children}</div>
      </div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">{children}</h2>
      {action}
    </div>
  );
}
