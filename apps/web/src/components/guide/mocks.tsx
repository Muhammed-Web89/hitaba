'use client';

/**
 * Rehberdeki telefon ekranı taslakları. Uygulamanın görünümünü (renkler, kartlar, düğmeler) ve
 * kendi çevirilerini kullanır; böylece beş dilde ve iki temada gerçek ekranla aynı görünür.
 * Etkileşimsizdir: üzerindeki 👆 işareti kullanıcının nereye dokunacağını gösterir.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CONNECT_PACKAGES, INTRO_OFFER, LAUNCH_OFFER, RULES } from '@hitaba/shared/client';
import { getGuide } from '@/content/guide';
import { Icon } from '../icons';
import { LogoMark } from '../Logo';
import { FemaleEmblem, GirihRing } from '../ProfileView';
import { cx } from '../ui';
import { Tap } from './parts';

type Who = 'man' | 'woman';

/** Paketin şu anki fiyatı: cüzdan sayfasıyla aynı kural (lansman > tanışma indirimi > liste). */
export function packageOffer(p: (typeof CONNECT_PACKAGES)[number]): { price: number; promo: 'launch' | 'intro' | null } {
  if (LAUNCH_OFFER.active && p.id === LAUNCH_OFFER.packageId) return { price: 0, promo: 'launch' };
  if (p.id === INTRO_OFFER.packageId) return { price: INTRO_OFFER.stars, promo: 'intro' };
  return { price: p.stars, promo: null };
}

function useG() {
  return getGuide(useLocale());
}

function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex h-full flex-col px-3 pb-3 text-ink', className)}>{children}</div>;
}

function AppBar({ balance, tapWallet, showWallet }: { balance?: number; tapWallet?: boolean; showWallet?: boolean }) {
  const g = useG();
  return (
    <div className="flex h-11 items-center justify-between border-b border-line px-1">
      <span className="flex items-center gap-1.5">
        <LogoMark size={22} />
        <span className="font-serif text-base font-semibold">Hitaba</span>
      </span>
      <span className="flex items-center gap-2 text-ink-2">
        {showWallet && (
          <span className="relative inline-flex h-7 items-center gap-1 rounded-full border border-line px-2 text-xs font-semibold text-ink">
            <Icon name="wallet" size={13} className="text-accent" />
            <span className="tabular-nums">{balance ?? 0}</span>
            {tapWallet && <Tap label={g.ui.tapHere} />}
          </span>
        )}
        <Icon name="sun" size={16} />
        <Icon name="bell" size={16} />
      </span>
    </div>
  );
}

function BottomNav({ active }: { active: 'feed' | 'likes' | 'chats' | 'profile' }) {
  const t = useTranslations('nav');
  const items = [
    ['feed', 'compass'],
    ['likes', 'heart'],
    ['chats', 'chat'],
    ['profile', 'user'],
  ] as const;
  return (
    <div className="mt-auto grid grid-cols-4 border-t border-line pt-2">
      {items.map(([k, icon]) => (
        <span key={k} className={cx('flex flex-col items-center gap-0.5 text-[9px] font-semibold', k === active ? 'text-brand-500' : 'text-ink-3')}>
          <Icon name={icon} size={16} />
          {t(k)}
        </span>
      ))}
    </div>
  );
}

/** Küçük avatar: kadında başörtülü amblem, erkekte baş harf (taslakta gerçek fotoğraf yok). */
function Avatar({ who, size = 64 }: { who: Who; size?: number }) {
  const g = useG();
  const inner = Math.round(size * 0.62);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <GirihRing />
      <span
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-brand-50 font-serif font-semibold text-brand-500"
        style={{ width: inner, height: inner, fontSize: inner * 0.45 }}
      >
        {who === 'woman' ? <FemaleEmblem /> : g.ui.sampleMan.slice(0, 1)}
      </span>
    </span>
  );
}

/** Erkeğin fotoğrafı yerine nötr bir siluet (taslakta gerçek yüz gösterilmez). */
function PhotoPlaceholder({ blur }: { blur?: boolean }) {
  return (
    <div className={cx('relative flex h-36 items-end justify-center overflow-hidden rounded-card bg-gradient-to-b from-brand-100 to-surface-alt', blur && 'blur-[3px]')}>
      <svg viewBox="0 0 100 80" className="h-28 text-brand-500/60" aria-hidden="true">
        <circle cx="50" cy="30" r="17" fill="currentColor" />
        <path d="M14 80c3-19 18-29 36-29s33 10 36 29Z" fill="currentColor" />
      </svg>
    </div>
  );
}

function Skeleton({ w }: { w: string }) {
  return <span className="block h-2 rounded-full bg-surface-alt" style={{ width: w }} />;
}

function Bubble({ mine, children }: { mine?: boolean; children: ReactNode }) {
  return (
    <div className={cx('max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-snug', mine ? 'ms-auto rounded-se-sm bg-bubble' : 'rounded-ss-sm bg-surface-alt')}>{children}</div>
  );
}

function MockButton({ children, tap, tone = 'brand', className }: { children: ReactNode; tap?: boolean; tone?: 'brand' | 'plain' | 'gold'; className?: string }) {
  const g = useG();
  return (
    <span
      className={cx(
        'relative flex h-9 items-center justify-center gap-1.5 rounded-control px-3 text-xs font-bold',
        tone === 'brand' && 'bg-brand-500 text-brand-ink',
        tone === 'gold' && 'bg-accent text-brand-ink',
        tone === 'plain' && 'border border-line text-ink',
        className,
      )}
    >
      {children}
      {tap && <Tap label={g.ui.tapHere} />}
    </span>
  );
}

/** Yazı makinesi: örnek metni harf harf yazar, bitince bekleyip baştan başlar. */
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v > text.length + 40 ? 0 : v + 1)), 55);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span>
      {text.slice(0, n)}
      <span className="guide-caret ms-px inline-block h-3 w-px translate-y-0.5 bg-brand-500" />
    </span>
  );
}

// ── Profil ──────────────────────────────────────────────────────────────

export function ScreenProfileStep({ who }: { who: Who }) {
  const g = useG();
  const t = useTranslations('onboarding');
  const total = g.steps.items.length + (who === 'woman' ? 1 : 0);
  return (
    <Screen>
      <div className="flex h-11 items-center justify-between">
        <LogoMark size={22} />
        <span className="text-[10px] text-ink-3">{t('stepOf', { current: 5, total })}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-alt">
        <div className="h-full bg-brand-500" style={{ width: `${(5 / total) * 100}%` }} />
      </div>
      <p className="mt-4 text-lg font-semibold">{t('steps.about.title')}</p>
      <p className="text-[11px] text-ink-2">{t('steps.about.why')}</p>
      <div className="mt-3 h-40 overflow-hidden rounded-control border border-brand-500 bg-surface p-2.5 text-[11px] leading-relaxed">
        <Typewriter text={(who === 'man' ? g.man.example : g.woman.example).replace(/[“”]/g, '')} />
      </div>
      <div className="mt-auto">
        <MockButton tap>{t('saveContinue')}</MockButton>
      </div>
    </Screen>
  );
}

// ── Akış ve eşleşme ─────────────────────────────────────────────────────

/** Akış kartı. `viewer` kimin baktığıdır: erkek kadın kartını görür, kadın erkek kartını. */
export function ScreenFeed({ viewer }: { viewer: Who }) {
  const g = useG();
  const t = useTranslations('feed');
  const other: Who = viewer === 'man' ? 'woman' : 'man';
  const max = viewer === 'man' ? RULES.maleDailyFreeLikes : RULES.femaleDailyLikes;
  return (
    <Screen>
      <AppBar showWallet={viewer === 'man'} balance={1} />
      <p className="mt-2 text-center text-[10px] text-ink-3">{t('likesLeft', { n: max - 2, max })}</p>
      <div className="glass mt-2 rounded-card border p-3">
        <div className="flex items-center gap-3">
          <Avatar who={other} size={58} />
          <div className="min-w-0">
            <p className="font-serif text-lg font-semibold leading-tight">
              {other === 'woman' ? g.ui.sampleWoman : g.ui.sampleMan} <span className="font-sans text-xs font-normal text-ink-2">24–26</span>
            </p>
            <p className="flex items-center gap-1 text-[10px] text-ink-3">
              <Icon name="pin" size={11} /> {g.ui.sampleCity}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Skeleton w="100%" />
          <Skeleton w="92%" />
          <Skeleton w="70%" />
        </div>
        <div className="mt-3 flex gap-1.5">
          {['ruler', 'book', 'home'].map((i) => (
            <span key={i} className="inline-flex h-5 w-10 items-center justify-center rounded-full bg-surface-alt text-ink-3">
              <Icon name={i as 'ruler'} size={11} />
            </span>
          ))}
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <MockButton tone="plain">
          <Icon name="x" size={14} /> {t('pass')}
        </MockButton>
        <span className="relative">
          <MockButton tap>
            <Icon name="heart" size={14} /> {t('like')}
          </MockButton>
          <span className="guide-rise pointer-events-none absolute -top-2 start-6 text-lg" aria-hidden="true">
            ❤️
          </span>
          <span className="guide-rise pointer-events-none absolute -top-2 end-8 text-sm" style={{ animationDelay: '0.9s' }} aria-hidden="true">
            💚
          </span>
        </span>
      </div>
      <BottomNav active="feed" />
    </Screen>
  );
}

export function ScreenMutual({ viewer }: { viewer: Who }) {
  const t = useTranslations('feed');
  return (
    <Screen className="justify-center bg-base">
      <div className="glass rounded-card border p-5 text-center">
        <div className="animate-pop flex justify-center gap-2">
          <Avatar who="man" size={54} />
          <Avatar who="woman" size={54} />
        </div>
        <p className="guide-float mt-2 text-3xl">💞</p>
        <p className="mt-1 text-lg font-semibold">{t('mutualTitle')}</p>
        <p className="mt-1 text-[11px] text-ink-2">{viewer === 'man' ? t('mutualTextBrother') : t('mutualTextSister')}</p>
        <MockButton tap className="mt-4">
          {t('viewMutual')}
        </MockButton>
      </div>
    </Screen>
  );
}

/** Erkek: fotoğrafı kadın görüp karar verecek. */
export function ScreenBrotherWait() {
  const g = useG();
  const t = useTranslations('match');
  return (
    <Screen>
      <AppBar showWallet balance={1} />
      <div className="mt-4 flex items-center gap-3">
        <Avatar who="woman" size={52} />
        <p className="font-serif text-lg font-semibold">{g.ui.sampleWoman}</p>
      </div>
      <div className="glass mt-4 rounded-card border p-4 text-center">
        <span className="guide-float mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <Icon name="clock" size={24} />
        </span>
        <p className="mt-3 text-[12px] leading-snug text-ink-2">{t('brotherWaitingText')}</p>
      </div>
      <BottomNav active="likes" />
    </Screen>
  );
}

/** Kadın: erkeğin fotoğrafını görür ve onaylar. */
export function ScreenSisterDecide() {
  const g = useG();
  const t = useTranslations('match');
  return (
    <Screen>
      <div className="mt-3 flex items-center gap-2">
        <Icon name="back" size={16} className="flip-rtl text-ink-3" />
        <p className="font-serif text-lg font-semibold">{g.ui.sampleMan}</p>
        <span className="text-[10px] text-ink-3">27–29</span>
      </div>
      <div className="mt-3">
        <PhotoPlaceholder />
      </div>
      <p className="mt-3 line-clamp-4 text-[11px] leading-snug text-ink-2">{t('sisterDecisionText')}</p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <MockButton tone="plain">{t('declinePhoto')}</MockButton>
        <MockButton tap>{t('approvePhoto')}</MockButton>
      </div>
    </Screen>
  );
}

/** Kadın: erkek fotoğrafı yeniden görmek istiyor. */
export function ScreenPhotoAsk() {
  const g = useG();
  const t = useTranslations('match.photo');
  return (
    <Screen>
      <AppBar />
      <div className="glass mt-4 rounded-card border p-4">
        <div className="flex items-center gap-3">
          <Avatar who="man" size={46} />
          <p className="text-[12px] leading-snug">
            <b className="font-semibold">{g.ui.sampleMan}</b> {t('sisterAsk')}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MockButton tone="plain">{t('deny')}</MockButton>
          <MockButton tap>{t('allow')}</MockButton>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-card bg-brand-50 p-3 text-[11px] text-ink-2">
        <span className="text-xl">🔑</span>
        {t('onceNote')}
      </div>
      <BottomNav active="likes" />
    </Screen>
  );
}

/** Erkek: kadın onayladı, sohbeti açar. */
export function ScreenOpenChat() {
  const g = useG();
  const t = useTranslations('match');
  return (
    <Screen>
      <AppBar showWallet balance={1} />
      <div className="mt-4 flex items-center gap-3">
        <Avatar who="woman" size={52} />
        <div>
          <p className="font-serif text-lg font-semibold">{g.ui.sampleWoman}</p>
          <p className="text-[10px] text-brand-500">✓ {t('photo.title')}</p>
        </div>
      </div>
      <div className="glass mt-4 rounded-card border p-4">
        <p className="text-[11px] leading-snug text-ink-2">{t('openChatText', { cost: RULES.chatOpenCost })}</p>
        <MockButton tap className="mt-4">
          <Icon name="chat" size={14} /> {t('openChat', { cost: RULES.chatOpenCost })}
        </MockButton>
      </div>
      <BottomNav active="likes" />
    </Screen>
  );
}

// ── Sohbet ve veli ──────────────────────────────────────────────────────

export function ScreenChat({ viewer }: { viewer: Who }) {
  const g = useG();
  const t = useTranslations('chat');
  const tl = useTranslations('landing.mock');
  const tr = useTranslations('enums.relation');
  return (
    <Screen className="px-0">
      <div className="flex items-center gap-2 border-b border-line px-3 pb-2 pt-2">
        <Icon name="back" size={16} className="flip-rtl text-ink-3" />
        <div>
          <p className="text-sm font-semibold leading-tight">{viewer === 'man' ? g.ui.sampleWoman : g.ui.sampleMan}</p>
          <p className="text-[9px] text-ink-3">27–29 · {g.ui.sampleCity}</p>
        </div>
      </div>
      <div className="relative border-b border-line bg-brand-50 px-3 py-2 text-[10px]">
        <p className="flex items-center gap-1.5 font-semibold text-brand-500">
          <Icon name="users" size={12} /> {t('watchers', { n: 4 })}
        </p>
        <div className="mt-1 grid gap-0.5 text-ink-2">
          <span>👁 {t('watcher.maleModerator')}</span>
          <span>👁 {t('watcher.femaleModerator')}</span>
          <span>🛡 {t('watcher.ai')}</span>
          <span>👤 {t('watcher.witness', { relation: tr('MOTHER') })}</span>
        </div>
        {viewer === 'woman' && <Tap className="rounded-none" />}
      </div>
      <div className="grid gap-2 px-3 pt-3">
        <Bubble mine={viewer === 'man'}>{tl('msg1')}</Bubble>
        <Bubble mine={viewer === 'woman'}>{tl('msg2')}</Bubble>
        <div className="flex items-center gap-1.5 rounded-control bg-warning-bg px-2 py-1.5 text-[10px] text-warning">
          <Icon name="pause" size={12} /> {tl('held')}
        </div>
      </div>
      <div className="mx-3 mt-auto flex h-9 items-center rounded-full border border-line px-3 text-[11px] text-ink-3">{t('placeholder')}</div>
    </Screen>
  );
}

export function ScreenWali() {
  const t = useTranslations('wali');
  const tc = useTranslations('common');
  const tr = useTranslations('enums.relation');
  return (
    <Screen>
      <AppBar />
      <p className="mt-3 text-lg font-semibold">{t('title')}</p>
      <div className="glass mt-3 rounded-card border p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="link" size={14} className="text-brand-500" /> {t('linkTitle')}
        </p>
        <p className="mt-1 text-[11px] text-ink-2">{t('linkText')}</p>
        <MockButton tap className="mt-7">
          <Icon name="copy" size={14} /> {tc('copy')}
        </MockButton>
      </div>
      <div className="glass mt-3 rounded-card border p-3">
        <p className="text-[11px] font-semibold">{t('witnesses', { max: RULES.maxWitnesses })}</p>
        <div className="mt-2 flex gap-1.5">
          {(['MOTHER', 'SISTER'] as const).map((r) => (
            <span key={r} className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
              👤 {tr(r)}
            </span>
          ))}
        </div>
      </div>
      <BottomNav active="profile" />
    </Screen>
  );
}

// ── Ödeme ───────────────────────────────────────────────────────────────

export function ScreenTelegram() {
  const g = useG();
  return (
    <Screen className="bg-[#17212b] px-0 text-white">
      <div className="flex items-center gap-2 bg-[#232e3c] px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0e1621]">
          <LogoMark size={22} />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">Hitaba</p>
          <p className="text-[9px] text-white/50">bot</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-3">
        <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-[#182533] px-3 py-2 text-[11px]">{g.payment.tg.botHint} 🤍</div>
        <span className="relative flex h-9 items-center justify-center rounded-control bg-[#2b5278] text-xs font-bold">
          {g.payment.tg.open}
          <Tap />
        </span>
      </div>
    </Screen>
  );
}

export function ScreenWalletTap() {
  return (
    <Screen>
      <AppBar showWallet tapWallet balance={0} />
      <div className="glass mt-6 rounded-card border p-3">
        <div className="flex items-center gap-3">
          <Avatar who="woman" size={52} />
          <div className="grid flex-1 gap-1.5">
            <Skeleton w="60%" />
            <Skeleton w="40%" />
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          <Skeleton w="100%" />
          <Skeleton w="85%" />
        </div>
      </div>
      <BottomNav active="feed" />
    </Screen>
  );
}

export function ScreenPackages() {
  const t = useTranslations('wallet');
  const tapId = CONNECT_PACKAGES[1].id;
  return (
    <Screen>
      <AppBar showWallet balance={0} />
      <div className="glass mt-3 flex items-center justify-between rounded-card border p-3">
        <div>
          <p className="text-[10px] text-ink-3">{t('balance')}</p>
          <p className="font-serif text-2xl font-semibold">0</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-accent">
          <Icon name="wallet" size={20} />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold">{t('packages')}</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {CONNECT_PACKAGES.map((p) => {
          const o = packageOffer(p);
          const deal = o.promo === 'launch';
          return (
            <div key={p.id} className={cx('glass relative flex flex-col items-center rounded-card border px-1 pb-2 pt-3 text-center', deal && 'border-accent/70')}>
              {deal && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-1.5 text-[8px] font-bold uppercase text-brand-ink">
                  {t('launchBadge')}
                </span>
              )}
              <span className="font-serif text-xl font-semibold">{p.connects}</span>
              <span className="text-[9px] text-ink-3">{t('connects', { n: p.connects })}</span>
              <span className="mt-1 text-[11px] font-semibold text-accent">{deal ? t('free') : `⭐ ${p.stars}`}</span>
              <MockButton tap={p.id === tapId} className="mt-2 h-7 w-full px-1 text-[10px]">
                {deal ? t('claimFree') : t('buy')}
              </MockButton>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

export function ScreenStarsSheet() {
  const g = useG();
  const t = useTranslations('wallet');
  const p = CONNECT_PACKAGES[1];
  return (
    <Screen className="relative px-0 pb-0">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative mt-auto rounded-t-2xl bg-[#1c2733] px-4 pb-5 pt-4 text-white">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0e1621]">
            <LogoMark size={28} />
          </span>
          <div>
            <p className="text-sm font-semibold">
              Hitaba · {p.connects} {t('connects', { n: p.connects })}
            </p>
            <p className="text-[10px] text-white/60">Telegram Stars</p>
          </div>
        </div>
        <p className="mt-4 text-center font-serif text-3xl font-semibold">⭐ {p.stars}</p>
        <span className="relative mt-4 flex h-10 items-center justify-center rounded-control bg-[#3e88f7] text-sm font-bold">
          {g.payment.tg.pay} ⭐ {p.stars}
          <Tap />
        </span>
        <p className="mt-3 text-center text-[10px] text-[#6ab3f3]">{g.payment.tg.noStars}</p>
      </div>
    </Screen>
  );
}

export function ScreenSuccess() {
  const g = useG();
  const t = useTranslations('wallet');
  const p = CONNECT_PACKAGES[1];
  return (
    <Screen>
      <AppBar showWallet balance={p.connects} />
      <div className="mt-6 flex flex-col items-center text-center">
        <span className="animate-pop flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-brand-ink">
          <Icon name="check" size={34} />
        </span>
        <p className="mt-3 text-lg font-semibold">{g.payment.tg.done}</p>
        <div className="relative mt-4">
          <p className="font-serif text-5xl font-semibold tabular-nums">{p.connects}</p>
          <span className="guide-rise absolute -end-8 top-0 text-lg font-bold text-accent" aria-hidden="true">
            +{p.connects}
          </span>
        </div>
        <p className="text-[11px] text-ink-3">{t('balance')}</p>
      </div>
      <div className="glass mt-6 flex items-center justify-between rounded-card border px-3 py-2.5 text-[11px]">
        <span className="font-semibold">{t('tx.PURCHASE')}</span>
        <span className="font-semibold text-success">+{p.connects}</span>
      </div>
    </Screen>
  );
}
