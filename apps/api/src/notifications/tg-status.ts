import type { User } from '@prisma/client';

/** Bot sohbetinde sabitlenmiş durum satırı — uygulamayı açmadan özet. */
export interface TgStatusCounts {
  status: User['status'];
  gender: User['gender'];
  likedMe: number;
  matches: number;
  chats: number;
  connects: number;
  unread: number;
}

const PROFILE: Record<string, string> = { uz: 'Anketa', ru: 'Анкета', tr: 'Profil', en: 'Profile', ar: 'الملف' };
const LEGEND: Record<string, string> = {
  uz: '❤️ sizni yoqtirganlar · 🤝 oʻzaro · 💬 suhbatlar · 🔔 yangi',
  ru: '❤️ симпатии вам · 🤝 взаимные · 💬 чаты · 🔔 новое',
  tr: '❤️ sizi beğenenler · 🤝 karşılıklı · 💬 sohbetler · 🔔 yeni',
  en: '❤️ liked you · 🤝 mutual · 💬 chats · 🔔 new',
  ar: '❤️ أعجبوا بك · 🤝 متبادل · 💬 محادثات · 🔔 جديد',
};
const CONNECTS: Record<string, string> = { uz: 'tanga', ru: 'монеты', tr: 'jeton', en: 'connects', ar: 'عملات' };
export const OPEN_APP: Record<string, string> = { uz: 'Hitaba’ni ochish', ru: 'Открыть Hitaba', tr: 'Hitaba’yı aç', en: 'Open Hitaba', ar: 'افتح هِتابة' };

const STATUS_EMOJI: Partial<Record<User['status'], string>> = {
  APPROVED: '✅',
  PENDING_MODERATION: '⏳',
  ONBOARDING: '✏️',
  REJECTED: '⚠️',
  FROZEN: '⏸',
};

export function tgStatusText(locale: string, c: TgStatusCounts): string {
  const parts = [
    `${PROFILE[locale] ?? PROFILE.en} ${STATUS_EMOJI[c.status] ?? '•'}`,
    `❤️ ${c.likedMe}`,
    `🤝 ${c.matches}`,
    `💬 ${c.chats}`,
    ...(c.gender === 'MALE' ? [`💎 ${c.connects}`] : []),
    ...(c.unread ? [`🔔 ${c.unread}`] : []),
  ];
  const legend = LEGEND[locale] ?? LEGEND.en;
  return `${parts.join(' · ')}\n${c.gender === 'MALE' ? `${legend} · 💎 ${CONNECTS[locale] ?? CONNECTS.en}` : legend}`;
}
