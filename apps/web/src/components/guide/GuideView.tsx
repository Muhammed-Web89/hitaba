'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CONNECT_PACKAGES } from '@hitaba/shared/client';
import { getGuide, type GuideTopic } from '@/content/guide';
import { fill, TELEGRAM_BOT_URL } from '@/content/site';
import { Link, useRouter } from '@/i18n/navigation';
import { Icon } from '../icons';
import { LogoMark } from '../Logo';
import { ThemeToggleButton } from '../ThemeToggle';
import { cx, IconButton } from '../ui';
import {
  packageOffer,
  ScreenBrotherWait,
  ScreenChat,
  ScreenFeed,
  ScreenMutual,
  ScreenOpenChat,
  ScreenPackages,
  ScreenPhotoAsk,
  ScreenProfileStep,
  ScreenSisterDecide,
  ScreenStarsSheet,
  ScreenSuccess,
  ScreenTelegram,
  ScreenWali,
  ScreenWalletTap,
} from './mocks';
import { Checklist, DoDont, GoLink, H2, Hero, ItemGrid, Kicker, Phone, Points, Reveal, Section, ShowRow, Stops } from './parts';

const TOPIC_EMOJI: Record<GuideTopic, string> = { man: '🧔', woman: '🧕', payment: '⭐' };

function useGuide() {
  return getGuide(useLocale());
}

/** Rehberin çerçevesi: geri, logo, tema ve üç rehber arasında geçiş sekmeleri. */
function Shell({ topic, children }: { topic?: GuideTopic; children: ReactNode }) {
  const g = useGuide();
  const router = useRouter();
  const label: Record<GuideTopic, string> = { man: g.ui.man, woman: g.ui.woman, payment: g.ui.payment };
  return (
    <div className="min-h-dvh pb-20">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <IconButton
            icon="back"
            label={g.ui.back}
            className="flip-rtl"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/app'))}
          />
          <Link href="/guide" className="inline-flex items-center gap-2">
            <LogoMark />
            <span className="font-serif text-lg font-semibold">{g.ui.title}</span>
          </Link>
          <ThemeToggleButton />
        </div>
        {topic && (
          <nav className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-2.5" aria-label={g.ui.title}>
            {(['man', 'woman', 'payment'] as const).map((k) => (
              <Link
                key={k}
                href={`/guide/${k}`}
                aria-current={k === topic ? 'page' : undefined}
                className={cx(
                  'shrink-0 rounded-full border px-3 py-1 text-sm font-semibold',
                  k === topic ? 'border-brand-500 bg-brand-500 text-brand-ink' : 'border-line text-ink-2',
                )}
              >
                {TOPIC_EMOJI[k]} {label[k]}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4">{children}</main>
    </div>
  );
}

function Example({ text }: { text: string }) {
  const g = useGuide();
  return (
    <Reveal className="mt-5 rounded-card border-2 border-dashed border-accent/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">✍️ {g.ui.example}</p>
      <p className="mt-1.5 font-serif text-lg italic leading-snug">{text}</p>
    </Reveal>
  );
}

function EndCard({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <Reveal className="mt-20 rounded-[28px] bg-brand-500 px-5 py-10 text-center text-brand-ink">
      <p className="font-serif text-3xl font-semibold">{title}</p>
      <p className="mt-2 text-lg opacity-90">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 [&_a]:bg-base [&_a]:text-ink">{children}</div>
    </Reveal>
  );
}

function useStopLabel() {
  const t = useTranslations('nav');
  return (href: string) => (href === '/app/feed' ? t('feed') : href === '/app/likes' ? t('likes') : t('chats'));
}

// ── Seçim sayfası ───────────────────────────────────────────────────────

export function GuideIndex() {
  const g = useGuide();
  const cards: Array<{ k: GuideTopic; title: string; hint: string; cls: string }> = [
    { k: 'man', title: g.ui.man, hint: g.ui.manHint, cls: 'from-brand-100' },
    { k: 'woman', title: g.ui.woman, hint: g.ui.womanHint, cls: 'from-accent/20' },
    { k: 'payment', title: g.ui.payment, hint: g.ui.paymentHint, cls: 'from-brand-50' },
  ];
  return (
    <Shell>
      <Reveal className="pt-10 text-center">
        <p className="guide-float text-6xl">📘</p>
        <h1 className="mt-4 text-balance text-4xl font-semibold sm:text-5xl">{g.ui.pick}</h1>
        <p className="mt-2 text-xl text-ink-2">{g.ui.pickSub}</p>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {cards.map((c, k) => (
          <Reveal key={c.k} delay={k * 90}>
            <Link
              href={`/guide/${c.k}`}
              className={cx('glass glow flex h-full flex-col items-center rounded-[24px] border bg-gradient-to-b to-transparent p-6 text-center transition-transform hover:-translate-y-1', c.cls)}
            >
              <span className="guide-float text-6xl" style={{ animationDelay: `${k * 0.5}s` }}>
                {TOPIC_EMOJI[c.k]}
              </span>
              <span className="mt-3 text-2xl font-semibold">{c.title}</span>
              <span className="mt-1 text-ink-2">{c.hint}</span>
              <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-brand-ink">
                <Icon name="forward" size={20} className="flip-rtl" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
}

// ── Erkek rehberi ───────────────────────────────────────────────────────

function ManGuide() {
  const g = useGuide();
  const stopLabel = useStopLabel();
  const M = g.man;
  return (
    <>
      <Hero
        {...M.hero}
        art={
          <Phone>
            <ScreenFeed viewer="man" />
            <ScreenMutual viewer="man" />
            <ScreenOpenChat />
          </Phone>
        }
      />

      <Section id="profile">
        <Kicker>{g.steps.kicker}</Kicker>
        <H2>{g.steps.title}</H2>
        <ShowRow phone={<Phone><ScreenProfileStep who="man" /></Phone>}>
          <Checklist items={g.steps.items} storageKey="hitaba.guide.man" />
        </ShowRow>
        <Example text={M.example} />
        <div className="mt-6">
          <GoLink href="/app/profile" tap>
            ✍️ {g.steps.cta}
          </GoLink>
        </div>
      </Section>

      <Section id="photo">
        <ShowRow flip phone={<Phone><ScreenBrotherWait /></Phone>}>
          <Kicker>{M.photo.kicker}</Kicker>
          <H2>{M.photo.title}</H2>
          <div className="mt-6">
            <Points points={M.photo.points} />
          </div>
        </ShowRow>
      </Section>

      <Section id="journey">
        <Kicker>{M.journey.kicker}</Kicker>
        <H2>{M.journey.title}</H2>
        <div className="grid items-start gap-8 sm:grid-cols-2">
          <Stops stops={M.journey.stops} linkLabel={stopLabel} />
          <Reveal className="mt-6">
            <Phone>
              <ScreenFeed viewer="man" />
              <ScreenMutual viewer="man" />
              <ScreenBrotherWait />
              <ScreenOpenChat />
              <ScreenChat viewer="man" />
            </Phone>
          </Reveal>
        </div>
      </Section>

      <Section id="pay">
        <Reveal className="relative overflow-hidden rounded-[28px] border-2 border-accent p-6 sm:p-8">
          <span className="guide-float pointer-events-none absolute -end-4 -top-4 text-8xl opacity-20" aria-hidden="true">
            🔑
          </span>
          <p className="font-serif text-3xl font-semibold sm:text-4xl">{M.pay.title}</p>
          <p className="mt-2 text-lg text-ink-2">{M.pay.text}</p>
          <div className="mt-5">
            <GoLink href="/guide/payment" tone="gold" tap>
              ⭐ {M.pay.cta}
            </GoLink>
          </div>
        </Reveal>
      </Section>

      <Section id="adab">
        <DoDont {...g.adab} yesLabel={g.ui.yes} noLabel={g.ui.no} />
      </Section>

      <EndCard {...M.end}>
        <GoLink href="/app/profile">✍️ {g.steps.cta}</GoLink>
        <GoLink href="/app/feed">👀 {M.ctaFeed}</GoLink>
      </EndCard>
    </>
  );
}

// ── Kadın rehberi ───────────────────────────────────────────────────────

function WomanGuide() {
  const g = useGuide();
  const stopLabel = useStopLabel();
  const W = g.woman;
  // Kadının adımlarında veli adımı kurallardan hemen önce gelir.
  const items = [...g.steps.items.slice(0, -1), g.steps.wali, g.steps.items[g.steps.items.length - 1]];
  return (
    <>
      <Hero
        {...W.hero}
        art={
          <Phone>
            <ScreenSisterDecide />
            <ScreenChat viewer="woman" />
            <ScreenWali />
          </Phone>
        }
      />

      <Section id="shy">
        <Kicker>{W.shy.kicker}</Kicker>
        <H2>{W.shy.title} 🤍</H2>
        <ItemGrid items={W.shy.items} />
      </Section>

      <Section id="profile">
        <Kicker>{g.steps.kicker}</Kicker>
        <H2>{g.steps.title}</H2>
        <ShowRow phone={<Phone><ScreenProfileStep who="woman" /></Phone>}>
          <Checklist items={items} storageKey="hitaba.guide.woman" />
        </ShowRow>
        <Example text={W.example} />
        <div className="mt-6">
          <GoLink href="/app/profile" tap>
            ✍️ {g.steps.cta}
          </GoLink>
        </div>
      </Section>

      <Section id="photo">
        <ShowRow
          flip
          phone={
            <Phone>
              <ScreenSisterDecide />
              <ScreenPhotoAsk />
            </Phone>
          }
        >
          <Kicker>{W.photo.kicker}</Kicker>
          <H2>{W.photo.title}</H2>
          <div className="mt-6">
            <Points points={W.photo.points} />
          </div>
        </ShowRow>
      </Section>

      <Section id="wali">
        <ShowRow
          phone={
            <Phone>
              <ScreenWali />
              <ScreenChat viewer="woman" />
            </Phone>
          }
        >
          <Kicker>{W.wali.kicker}</Kicker>
          <H2>{W.wali.title}</H2>
          <div className="mt-6">
            <Points points={W.wali.points} />
          </div>
          <div className="mt-6">
            <GoLink href="/app/wali" tap>
              🛡️ {W.wali.cta}
            </GoLink>
          </div>
        </ShowRow>
      </Section>

      <Section id="journey">
        <Kicker>{W.journey.kicker}</Kicker>
        <H2>{W.journey.title}</H2>
        <Stops stops={W.journey.stops} linkLabel={stopLabel} />
      </Section>

      <Section id="free">
        <Reveal className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-accent/25 via-brand-50 to-transparent p-8 text-center">
          <p className="guide-float text-7xl">🎉</p>
          <p className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">{W.free.title}</p>
          <p className="mx-auto mt-2 max-w-md text-lg text-ink-2">{W.free.text}</p>
        </Reveal>
      </Section>

      <Section id="safety">
        <Kicker>{W.safety.kicker}</Kicker>
        <H2>{W.safety.title}</H2>
        <ItemGrid items={W.safety.items} />
      </Section>

      <Section id="adab">
        <DoDont {...g.adab} yesLabel={g.ui.yes} noLabel={g.ui.no} />
      </Section>

      <EndCard {...W.end}>
        <GoLink href="/app/profile">✍️ {g.steps.cta}</GoLink>
        <GoLink href="/app/wali">🛡️ {W.wali.cta}</GoLink>
      </EndCard>
    </>
  );
}

// ── Ödeme rehberi ───────────────────────────────────────────────────────

function PaymentGuide() {
  const g = useGuide();
  const tw = useTranslations('wallet');
  const P = g.payment;
  const [step, setStep] = useState(0);
  const screens = [<ScreenTelegram key="tg" />, <ScreenWalletTap key="w" />, <ScreenPackages key="p" />, <ScreenStarsSheet key="s" />, <ScreenSuccess key="ok" />];
  const best = CONNECT_PACKAGES[CONNECT_PACKAGES.length - 1].id;
  return (
    <>
      <Hero {...P.hero} />
      <Reveal className="mt-5">
        <Link href="/guide/woman" className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-sm font-semibold">
          🧕 {P.women}
          <Icon name="forward" size={14} className="flip-rtl" />
        </Link>
      </Reveal>

      <Section id="steps">
        <div className="grid items-start gap-8 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="sm:sticky sm:top-28">
            <Phone index={step} onIndex={setStep} interval={4200}>
              {screens}
            </Phone>
          </div>
          <ol className="grid gap-3">
            {P.steps.map((s, k) => {
              const on = k === step;
              return (
                <li key={s.title}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setStep(k)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setStep(k)}
                    aria-current={on ? 'step' : undefined}
                    className={cx('glass glow cursor-pointer rounded-card border p-4 transition-all', on ? 'border-brand-500 shadow-[0_0_28px_-10px_var(--brand-500)]' : 'opacity-70')}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cx(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] font-serif text-xl font-semibold transition-colors',
                          on ? 'bg-brand-500 text-brand-ink' : 'bg-surface-alt',
                        )}
                      >
                        {k + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xl font-semibold leading-snug">
                          {s.emoji} {s.title}
                        </span>
                        {s.tip && <span className="mt-0.5 block text-[15px] text-ink-2">{s.tip}</span>}
                      </span>
                    </div>
                    {s.cta && (
                      <div className="mt-3 ps-14" onClick={(e) => e.stopPropagation()}>
                        {k === 0 ? (
                          <GoLink href={TELEGRAM_BOT_URL} external tap={on}>
                            {s.cta}
                          </GoLink>
                        ) : (
                          <GoLink href="/app/wallet" tone="plain" tap={on}>
                            👛 {s.cta}
                          </GoLink>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>

      <Section id="prices">
        <H2>{P.prices.title}</H2>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {CONNECT_PACKAGES.map((p, k) => {
            const o = packageOffer(p);
            const badge = o.promo === 'launch' ? tw('launchBadge') : p.id === best ? P.prices.best : null;
            return (
              <Reveal key={p.id} delay={k * 80}>
                <div className={cx('glass relative flex h-full flex-col items-center rounded-card border px-2 pb-4 pt-6 text-center', badge && 'border-accent/70')}>
                  {badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase text-brand-ink">
                      {badge}
                    </span>
                  )}
                  <span className="font-serif text-4xl font-semibold">{p.connects}</span>
                  <span className="text-sm text-ink-3">{tw('connects', { n: p.connects })}</span>
                  {o.promo === 'launch' ? (
                    <span className="mt-2 leading-tight">
                      <s className="block text-sm text-ink-3">⭐ {p.stars}</s>
                      <span className="text-lg font-bold text-brand-500">{tw('free')}</span>
                    </span>
                  ) : (
                    <span className="mt-2 text-lg font-bold text-accent">⭐ {p.stars}</span>
                  )}
                  <span className="mt-1 text-xs text-ink-3">{fill(P.prices.perCoin, { n: Math.round(p.stars / p.connects) })}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section id="refund">
        <Reveal className="rounded-[24px] bg-brand-50 p-6">
          <p className="font-serif text-2xl font-semibold">{P.refund.title}</p>
          <ul className="mt-3 grid gap-2 text-lg font-semibold">
            {P.refund.items.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-brand-500">✓</span>
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-ink-2">⏳ {P.refund.note}</p>
          <Link href="/refund" className="mt-3 inline-flex items-center gap-1 font-semibold text-brand-500">
            {P.refund.link}
            <Icon name="forward" size={16} className="flip-rtl" />
          </Link>
        </Reveal>
      </Section>

      <Section id="faq">
        <div className="grid gap-3">
          {P.faq.map((f) => (
            <Reveal key={f.q}>
              <details className="glass group rounded-card border p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-lg font-semibold">
                  ❓ {f.q}
                  <Icon name="chevronDown" size={18} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-ink-2">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </Section>

      <EndCard {...P.end}>
        <GoLink href="/app/wallet">👛 {P.steps[1].cta}</GoLink>
        <GoLink href={TELEGRAM_BOT_URL} external>
          📱 {P.steps[0].cta}
        </GoLink>
      </EndCard>
    </>
  );
}

export function GuideTopicView({ topic }: { topic: GuideTopic }) {
  return (
    <Shell topic={topic}>
      {topic === 'man' && <ManGuide />}
      {topic === 'woman' && <WomanGuide />}
      {topic === 'payment' && <PaymentGuide />}
    </Shell>
  );
}
