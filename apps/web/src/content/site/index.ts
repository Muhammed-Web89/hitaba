import { CONNECT_PACKAGES, INTRO_OFFER, RULES } from '@hitaba/shared/client';
import ar from './ar';
import en from './en';
import ru from './ru';
import tr from './tr';
import type { SiteContent } from './types';
import uz from './uz';

export type { RuleTag, SiteContent } from './types';

const CONTENT: Record<string, SiteContent> = { uz, ru, tr, en, ar };

export function getSite(locale: string): SiteContent {
  return CONTENT[locale] ?? en;
}

/** Metinlerdeki {yer tutucu}lar — rakamlar tek kaynaktan (@hitaba/shared) gelir, metne elle yazılmaz. */
export const SITE_VARS: Record<string, number> = {
  likes: RULES.maleDailyFreeLikes,
  chatCost: RULES.chatOpenCost,
  welcome: RULES.welcomeConnects,
  witnesses: RULES.maxWitnesses,
  wives: RULES.maxCurrentWives,
  maxPhotos: RULES.maxPhotos,
  aboutMin: RULES.aboutMinChars,
  editMin: RULES.messageEditWindowMinutes,
  remind1: RULES.silenceFirstReminderHours,
  remind2: RULES.silenceSecondReminderHours,
  close: RULES.silenceAutoCloseHours,
  introStars: INTRO_OFFER.stars,
  stars: CONNECT_PACKAGES.find((p) => p.id === INTRO_OFFER.packageId)!.stars,
};

export const fill = (s: string, vars: Record<string, number | string> = SITE_VARS) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(vars[k] ?? m));

export const TELEGRAM_BOT_URL = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'HitabaBot'}`;
/** Destek e-postası tanımlıysa alt bilgide ve belgelerde gösterilir. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '';
