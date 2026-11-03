/**
 * Tanıtım sitesinin uzun metinleri (kurallar, SSS, belgeler, ana sayfa). Her dil bu tipi doldurur;
 * tip, beş dilin aynı bölümlere sahip olmasını derleme anında garanti eder.
 * Rakamlar (jeton fiyatları, limitler) metne yazılmaz; @hitaba/shared kurallarından gelir ve {placeholder} ile eklenir.
 */

export type RuleTag = 'allowed' | 'forbidden' | 'info';

export interface RuleItem {
  title: string;
  text: string;
  tag?: RuleTag;
}

export interface RuleSection {
  id: string;
  title: string;
  lead?: string;
  /** Kayıtta verilen sözler (alıntı olarak gösterilir). */
  pledges?: string[];
  items: RuleItem[];
}

export interface DocSection {
  title: string;
  body: string;
}

export interface SiteDoc {
  title: string;
  description: string;
  intro: string;
  sections: DocSection[];
}

export interface SiteContent {
  nav: {
    how: string;
    pricing: string;
    rules: string;
    faq: string;
    openTelegram: string;
    webVersion: string;
    menu: string;
    skip: string;
  };
  footer: {
    tagline: string;
    app: string;
    support: string;
    documents: string;
    telegram: string;
    web: string;
    deleteAccount: string;
    contact: string;
    rights: string;
  };
  landing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    trust: string[];
    whyTitle: string;
    whyLead: string;
    pathTitle: string;
    pathLead: string;
    path: Array<{ title: string; text: string }>;
    forHer: { title: string; points: string[] };
    forHim: { title: string; points: string[] };
    circleTitle: string;
    circleLead: string;
    circle: Array<{ title: string; text: string }>;
    pricingTitle: string;
    pricingLead: string;
    freeTitle: string;
    free: string[];
    connectsTitle: string;
    connectsNote: string;
    perConnect: string;
    launchBadge: string;
    launchNote: string;
    freePrice: string;
    introBadge: string;
    introNote: string;
    welcomeNote: string;
    faqTitle: string;
    faqMore: string;
    ctaTitle: string;
    ctaText: string;
  };
  rules: {
    title: string;
    description: string;
    intro: string;
    contents: string;
    important: { title: string; text: string };
    tags: Record<RuleTag, string>;
    copyLink: string;
    copied: string;
    sections: RuleSection[];
  };
  faq: {
    title: string;
    description: string;
    intro: string;
    groups: Array<{ title: string; items: Array<{ q: string; a: string }> }>;
  };
  docs: {
    refund: SiteDoc;
    childSafety: SiteDoc;
    deleteAccount: SiteDoc & { howTitle: string; steps: string[]; inAppButton: string };
  };
}
