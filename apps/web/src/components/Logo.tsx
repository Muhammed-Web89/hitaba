import { Link } from '@/i18n/navigation';

/** Sekiz köşeli yıldız (girih) motifli logo. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink" aria-label="Hitaba">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="var(--brand-500)" strokeWidth="2" />
        <rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="var(--accent-500)" strokeWidth="2" transform="rotate(45 16 16)" />
        <circle cx="16" cy="16" r="3.2" fill="var(--brand-500)" />
      </svg>
      <span className="font-serif text-xl font-semibold tracking-tight">Hitaba</span>
    </Link>
  );
}
