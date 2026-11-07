/**
 * Uygulama içi rehber (/guide) metinleri. Her dil bu tipi doldurur; tip beş dilin aynı bölümlere
 * sahip olmasını derleme anında garanti eder. Rakamlar metne yazılmaz: {likes}, {chatCost} gibi
 * yer tutucular @hitaba/shared kurallarından doldurulur (bkz. content/site SITE_VARS).
 * Telefon ekranı taslaklarındaki düğme/etiket metinleri uygulamanın kendi çevirilerinden gelir.
 */

export interface GuideItem {
  emoji: string;
  title: string;
  tip?: string;
}

export interface GuideHero {
  eyebrow: string;
  title: string;
  lead: string;
  badges: string[];
}

export interface GuideSection {
  kicker: string;
  title: string;
}

/** Telefon taslağının yanında kısa maddeler. */
export interface GuideShow extends GuideSection {
  points: string[];
}

export interface GuideStops extends GuideSection {
  stops: Array<GuideItem & { link?: string }>;
}

export interface GuideEnd {
  title: string;
  text: string;
}

export interface GuideDoDont {
  title: string;
  yes: string[];
  no: string[];
}

export interface GuideContent {
  ui: {
    title: string;
    description: string;
    pick: string;
    pickSub: string;
    man: string;
    manHint: string;
    woman: string;
    womanHint: string;
    payment: string;
    paymentHint: string;
    back: string;
    tapHere: string;
    yes: string;
    no: string;
    example: string;
    jump: string;
    /** Tarayıcıda/telefon taslağında sabit kalan örnek adlar ve yer. */
    sampleMan: string;
    sampleWoman: string;
    sampleCity: string;
  };
  /** Profil adımları (iki rehberde ortak; kadına özel adım ayrı). */
  steps: {
    kicker: string;
    title: string;
    items: GuideItem[];
    wali: GuideItem;
    cta: string;
  };
  adab: GuideDoDont;
  man: {
    hero: GuideHero;
    example: string;
    photo: GuideShow;
    journey: GuideStops;
    pay: { title: string; text: string; cta: string };
    end: GuideEnd;
    ctaFeed: string;
  };
  woman: {
    hero: GuideHero;
    shy: GuideSection & { items: GuideItem[] };
    example: string;
    photo: GuideShow;
    wali: GuideShow & { cta: string };
    journey: GuideStops;
    free: { title: string; text: string };
    safety: GuideSection & { items: GuideItem[] };
    end: GuideEnd;
  };
  payment: {
    hero: GuideHero;
    women: string;
    steps: Array<GuideItem & { cta?: string }>;
    prices: { title: string; perCoin: string; best: string };
    refund: { title: string; items: string[]; note: string; link: string };
    faq: Array<{ q: string; a: string }>;
    end: GuideEnd;
    /** Telegram'ın ödeme penceresini taklit eden taslak (uygulamada karşılığı yok). */
    tg: { open: string; botHint: string; pay: string; noStars: string; done: string };
  };
}
