import type { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { LocaleMenu } from '@/components/LocaleMenu';
import { Logo } from '@/components/Logo';
import { getSite, SUPPORT_EMAIL, TELEGRAM_BOT_URL } from '@/content/site';
import { Link } from '@/i18n/navigation';

/** Tanıtım sitesinin ortak çerçevesi: üst menü (mobilde açılır), içerik ve çok sütunlu alt bilgi. */
export async function SiteShell({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const s = getSite(locale);
  const tl = await getTranslations('legal');
  const nav = [
    { href: '/#how', label: s.nav.how },
    { href: '/#pricing', label: s.nav.pricing },
    { href: '/rules', label: s.nav.rules },
    { href: '/faq', label: s.nav.faq },
  ];

  return (
    <div className="min-h-dvh">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-brand-ink">
        {s.nav.skip}
      </a>
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label={s.nav.menu}>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="glow rounded-control px-3 py-2 text-sm font-semibold text-ink-2 hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LocaleMenu />
            </div>
            <Link href="/login" className="glow hidden h-10 items-center rounded-control border border-line px-3 text-sm font-semibold md:inline-flex">
              {s.nav.webVersion}
            </Link>
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener"
              className="glow inline-flex h-10 items-center gap-1.5 rounded-control bg-brand-500 px-3 text-sm font-semibold text-brand-ink shadow-[0_6px_24px_-8px_var(--brand-500)]"
            >
              <Icon name="send" size={16} /> <span className="hidden sm:inline">{s.nav.openTelegram}</span>
              <span className="sm:hidden">Telegram</span>
            </a>
            <details className="group relative lg:hidden">
              <summary className="glow flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-control border border-line [&::-webkit-details-marker]:hidden" aria-label={s.nav.menu}>
                <Icon name="filter" size={18} />
              </summary>
              <div className="glass absolute end-0 top-12 w-60 space-y-1 rounded-card border p-2 shadow-card">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="block rounded-control px-3 py-2.5 font-semibold hover:bg-surface-alt">
                    {n.label}
                  </Link>
                ))}
                <Link href="/login" className="block rounded-control px-3 py-2.5 font-semibold hover:bg-surface-alt">
                  {s.nav.webVersion}
                </Link>
                <div className="px-1 pt-1 sm:hidden">
                  <LocaleMenu />
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="content">{children}</main>

      <footer className="mt-20 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-3">{s.footer.tagline}</p>
          </div>
          <FooterCol title={s.footer.app}>
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener" className="hover:text-ink">
              {s.footer.telegram}
            </a>
            <Link href="/login" className="hover:text-ink">
              {s.footer.web}
            </Link>
            <Link href="/#how" className="hover:text-ink">
              {s.nav.how}
            </Link>
            <Link href="/#pricing" className="hover:text-ink">
              {s.nav.pricing}
            </Link>
          </FooterCol>
          <FooterCol title={s.footer.support}>
            <Link href="/faq" className="hover:text-ink">
              {s.nav.faq}
            </Link>
            <Link href="/delete-account" className="hover:text-ink">
              {s.footer.deleteAccount}
            </Link>
            {SUPPORT_EMAIL && (
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">
                {s.footer.contact}
              </a>
            )}
          </FooterCol>
          <FooterCol title={s.footer.documents}>
            <Link href="/rules" className="hover:text-ink">
              {s.rules.title}
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              {tl('privacy.title')}
            </Link>
            <Link href="/terms" className="hover:text-ink">
              {tl('terms.title')}
            </Link>
            <Link href="/refund" className="hover:text-ink">
              {s.docs.refund.title}
            </Link>
            <Link href="/child-safety" className="hover:text-ink">
              {s.docs.childSafety.title}
            </Link>
          </FooterCol>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-3 sm:px-6">
            © {new Date().getFullYear()} Hitaba · hitaba.me · {s.footer.rights}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 font-sans text-xs font-bold uppercase tracking-wider text-ink-3">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-ink-2">{children}</div>
    </div>
  );
}

