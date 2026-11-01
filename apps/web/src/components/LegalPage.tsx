import { getTranslations } from 'next-intl/server';
import { POLICY_VERSION } from '@hitaba/shared/client';
import { SiteShell } from './site/SiteShell';

const SECTIONS = {
  privacy: ['controller', 'data', 'sensitive', 'purpose', 'visibility', 'processors', 'retention', 'rights', 'security', 'minors', 'contact'],
  terms: ['purpose', 'eligibility', 'account', 'conduct', 'contact', 'photos', 'moderation', 'payments', 'liability', 'changes'],
} as const;

/** Gizlilik politikası / kullanım koşulları — metinler legal.* çevirilerinde. */
export async function LegalPage({ doc }: { doc: keyof typeof SECTIONS }) {
  const t = await getTranslations(`legal.${doc}`);
  const tl = await getTranslations('legal');
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t('title')}</h1>
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
    </SiteShell>
  );
}
