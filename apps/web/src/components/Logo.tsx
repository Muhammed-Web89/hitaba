import { Link } from '@/i18n/navigation';

/** Sekiz köşeli yıldız (girih) motifli logo. */
export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink" aria-label="Hitaba">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="var(--brand-500)" strokeWidth="2" />
        <rect x="6" y="6" width="20" height="20" rx="3" fill="none" stroke="var(--accent-500)" strokeWidth="2" transform="rotate(45 16 16)" />
        {/* Ortada H: köprü tam yatay ortada */}
        <g fill="var(--brand-500)">
          <rect x="11.68" y="10.77" width="2" height="10.46" rx="0.36" />
          <rect x="18.32" y="10.77" width="2" height="10.46" rx="0.36" />
          <rect x="12.68" y="15" width="6.64" height="2" />
        </g>
      </svg>
      <span className="font-serif text-xl font-semibold tracking-tight">Hitaba</span>
    </Link>
  );
}
