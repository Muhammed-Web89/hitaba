import { getTranslations } from 'next-intl/server';
import { POLICY_VERSION } from '@hitaba/shared';
import { LocaleMenu } from './LocaleMenu';
import { Logo } from './Logo';

const SECTIONS = {
  privacy: ['controller', 'data', 'sensitive', 'purpose', 'visibility', 'processors', 'retention', 'rights', 'security', 'minors', 'contact'],
  terms: ['purpose', 'eligibility', 'account', 'conduct', 'contact', 'photos', 'moderation', 'payments', 'liability', 'changes'],
} as const;

/** Gizlilik politikası / kullanım koşulları — metinler legal.* çevirilerinde. */
export async function LegalPage({ doc }: { doc: keyof typeof SECTIONS }) {
  const t = await getTranslations(`legal.${doc}`);
  const tl = await getTranslations('legal');
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <LocaleMenu />
      </header>
      <h1 className="mt-6 text-3xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-sm text-ink-3">{tl('version', { version: POLICY_VERSION })}</p>
      <div className="mt-4 rounded-card bg-warning-bg px-4 py-3 text-sm text-warning">{tl('draftNotice')}</div>
      <p className="mt-6 text-[15px] leading-relaxed text-ink-2">{t('intro')}</p>
      {SECTIONS[doc].map((key) => (
        <section key={key} className="mt-6">
          <h2 className="text-lg font-semibold">{t(`sections.${key}.title` as never)}</h2>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{t(`sections.${key}.body` as never)}</p>
        </section>
      ))}
    </div>
  );
}
