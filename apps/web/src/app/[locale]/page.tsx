import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CONNECT_PACKAGES, INTRO_OFFER } from '@hitaba/shared/client';
import { Icon, type IconName } from '@/components/icons';
import { LandingCta } from '@/components/LandingCta';
import { FaqList } from '@/components/site/FaqList';
import { SiteShell } from '@/components/site/SiteShell';
import { fill, getSite, TELEGRAM_BOT_URL } from '@/content/site';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

const PRINCIPLES: Array<{ key: 'witnessed' | 'wali' | 'privacy' | 'moderation'; icon: IconName }> = [
  { key: 'witnessed', icon: 'users' },
  { key: 'wali', icon: 'shield' },
  { key: 'privacy', icon: 'lock' },
  { key: 'moderation', icon: 'eye' },
];
const PATH_ICONS: IconName[] = ['edit', 'heart', 'camera', 'eye', 'chat', 'home'];
const CIRCLE_ICONS: IconName[] = ['users', 'sparkle', 'shield', 'lock'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const s = getSite((await params).locale);
  return { title: { absolute: `Hitaba — ${s.landing.title}` }, description: s.landing.subtitle };
}

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations('landing');
  const s = getSite(locale);
  const L = s.landing;
  const faqPreview = s.faq.groups.slice(0, 3).flatMap((g) => g.items.slice(0, 2));

  return (
    <SiteShell>
      {/* Giriş */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:py-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">{L.eyebrow}</p>
          <h1 className="text-4xl font-semibold leading-[1.1] sm:text-6xl">{L.title}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{L.subtitle}</p>
          <LandingCta />
          <ul className="mt-8 flex flex-wrap gap-2">
            {L.trust.map((x) => (
              <li key={x} className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-3 py-1.5 text-xs font-semibold text-ink-2">
                <Icon name="check" size={14} className="text-brand-500" /> {x}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass relative rounded-card border p-5" aria-hidden="true">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-serif text-xl font-semibold text-brand-500">U</span>
            <div className="flex-1">
              <div className="font-semibold">Umar · Maryam</div>
              <div className="text-xs text-ink-3">27–29 · Toshkent</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-500">
              <Icon name="users" size={14} /> {t('mock.witnesses')}
            </span>
          </div>
          <div className="space-y-3 py-4">
            <div className="max-w-[80%] rounded-2xl rounded-ss-sm bg-surface-alt px-3.5 py-2.5 text-sm">{t('mock.msg1')}</div>
            <div className="ms-auto max-w-[80%] rounded-2xl rounded-se-sm bg-bubble px-3.5 py-2.5 text-sm">{t('mock.msg2')}</div>
            <div className="flex gap-2 rounded-card bg-warning-bg px-3 py-2 text-xs text-warning">
              <Icon name="pause" size={16} className="shrink-0" /> {t('mock.held')}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-3">
            <Icon name="shield" size={14} className="text-accent" /> {L.circle[0].title} · {L.circle[1].title} · {L.circle[3].title}
          </div>
        </div>
      </section>

      {/* Neden Hitaba */}
      <Section title={L.whyTitle} lead={L.whyLead}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map(({ key, icon }) => (
            <div key={key} className="glass glow rounded-card border p-5">
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <Icon name={icon} />
              </span>
              <h3 className="text-lg font-semibold">{t(`principles.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{t(`principles.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Yol */}
      <Section id="how" title={L.pathTitle} lead={L.pathLead}>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {L.path.map((p, i) => (
            <li key={p.title} className="glass glow relative rounded-card border p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                  <Icon name={PATH_ICONS[i]} size={20} />
                </span>
                <span className="font-serif text-3xl text-accent/70">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{p.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Kadınlar / erkekler */}
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          {[L.forHer, L.forHim].map((side, i) => (
            <div key={side.title} className={`glass rounded-card border p-6 ${i === 0 ? 'border-accent/40' : ''}`}>
              <h3 className="flex items-center gap-2 text-2xl font-semibold">
                <Icon name={i === 0 ? 'shield' : 'user'} className={i === 0 ? 'text-accent' : 'text-brand-500'} /> {side.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {side.points.map((p) => (
                  <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-brand-500" />
                    {fill(p)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Çevre */}
      <Section title={L.circleTitle} lead={L.circleLead}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {L.circle.map((c, i) => (
            <div key={c.title} className="glass glow rounded-card border p-5 text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-brand-500/40 bg-brand-50 text-brand-500 shadow-[0_0_24px_-8px_var(--brand-500)]">
                <Icon name={CIRCLE_ICONS[i]} size={24} />
              </span>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{fill(c.text)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Fiyatlar */}
      <Section id="pricing" title={L.pricingTitle} lead={L.pricingLead}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="glass rounded-card border p-6">
            <h3 className="text-xl font-semibold">{L.freeTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {L.free.map((f) => (
                <li key={f} className="flex gap-2.5 text-[15px] text-ink-2">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-brand-500" /> {fill(f)}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass rounded-card border p-6">
            <h3 className="text-xl font-semibold">{L.connectsTitle}</h3>
            <p className="mt-1 text-sm text-ink-3">{L.connectsNote}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {CONNECT_PACKAGES.map((p) => {
                const intro = p.id === INTRO_OFFER.packageId;
                return (
                  <div key={p.id} className={`relative rounded-card border p-4 pt-5 text-center ${intro ? 'border-accent/70 shadow-[0_0_24px_-8px_var(--accent-500)]' : 'border-line'}`}>
                    {intro && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
                        {L.introBadge}
                      </span>
                    )}
                    <div className="font-serif text-3xl font-semibold">{p.connects}</div>
                    <div className="text-xs text-ink-3">{L.perConnect}</div>
                    {intro ? (
                      <div className="mt-2 leading-tight">
                        <s className="text-xs text-ink-3">⭐ {p.stars}</s>
                        <div className="text-lg font-semibold text-accent">⭐ {INTRO_OFFER.stars}</div>
                      </div>
                    ) : (
                      <div className="mt-2 font-semibold text-accent">⭐ {p.stars}</div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-ink-3">{fill(L.introNote)}</p>
            <p className="mt-1 text-xs text-ink-3">{fill(L.welcomeNote)}</p>
          </div>
        </div>
      </Section>

      {/* SSS */}
      <Section title={L.faqTitle}>
        <FaqList items={faqPreview} />
        <Link href="/faq" className="glow mt-5 inline-flex h-11 items-center gap-2 rounded-control border border-line px-4 font-semibold">
          {L.faqMore} <Icon name="forward" size={16} className="flip-rtl" />
        </Link>
      </Section>

      {/* Son çağrı */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="glass relative overflow-hidden rounded-card border border-brand-500/30 px-6 py-12 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,var(--brand-100),transparent)]" aria-hidden="true" />
          <h2 className="relative text-3xl font-semibold sm:text-4xl">{L.ctaTitle}</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-ink-2">{L.ctaText}</p>
          <div className="relative flex justify-center">
            <LandingCta />
          </div>
          <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener" className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:underline">
            <Icon name="send" size={16} /> {s.nav.openTelegram}
          </a>
        </div>
      </section>
    </SiteShell>
  );
}

function Section({ id, title, lead, children }: { id?: string; title?: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6">
      {title && <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>}
      {lead && <p className="mt-3 max-w-2xl text-ink-2">{lead}</p>}
      <div className={title ? 'mt-8' : ''}>{children}</div>
    </section>
  );
}
