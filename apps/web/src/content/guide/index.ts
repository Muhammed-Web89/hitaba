import ar from './ar';
import en from './en';
import ru from './ru';
import tr from './tr';
import type { GuideContent } from './types';
import uz from './uz';

export type { GuideContent, GuideItem } from './types';

const CONTENT: Record<string, GuideContent> = { uz, ru, tr, en, ar };

export function getGuide(locale: string): GuideContent {
  return CONTENT[locale] ?? en;
}

export const GUIDE_TOPICS = ['man', 'woman', 'payment'] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];
