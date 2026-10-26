/**
 * İletişim bilgisi dedektörü (§5.5): telefon, @kullanıcı adı, link, e-posta ve
 * bunların maskelenmiş/parçalanmış hâlleri. Sunucu otoritedir; istemci yalnızca
 * önceden uyarı göstermek için kullanır.
 *
 * Yanlış pozitif kabul edilebilir — mesaj silinmez, moderatör onayına tutulur.
 */

export type ContactSignal = 'PHONE' | 'EMAIL' | 'URL' | 'HANDLE' | 'MESSENGER';

export interface ContactScanResult {
  blocked: boolean;
  signals: ContactSignal[];
}

const DIGIT_WORDS: Record<string, string> = {
  // tr
  sifir: '0', bir: '1', iki: '2', uc: '3', dort: '4', bes: '5', alti: '6', yedi: '7', sekiz: '8', dokuz: '9',
  // uz
  nol: '0', ikki: '2', toʻrt: '4', tort: '4', besh: '5', olti: '6', yetti: '7', sakkiz: '8', toqqiz: '9',
  // ru (translit + cyrillic)
  odin: '1', dva: '2', tri: '3', chetyre: '4', pyat: '5', shest: '6', sem: '7', vosem: '8', devyat: '9',
  ноль: '0', один: '1', два: '2', три: '3', четыре: '4', пять: '5', шесть: '6', семь: '7', восемь: '8', девять: '9',
  // en
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

const MESSENGER_WORDS = [
  'telegram', 'телеграм', 'telegramm', 'whatsapp', 'вотсап', 'ватсап', 'watsap', 'instagram', 'инстаграм',
  'insta', 'инста', 'imo', 'viber', 'вайбер', 'signal', 'snapchat', 'facebook', 'tiktok', 'discord', 'skype',
];

function normalize(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // Arapça-Hint ve Farsça rakamlar
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .toLowerCase()
      .replace(/[ıİ]/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
  );
}

function digitWordsToDigits(text: string): string {
  return text
    .split(/(\s+|[.,;:!?\-_/|])/)
    .map((tok) => DIGIT_WORDS[tok] ?? tok)
    .join('');
}

export function scanForContactInfo(raw: string): ContactScanResult {
  const signals = new Set<ContactSignal>();
  const text = normalize(raw);

  // E-posta — "ali (at) mail (dot) com" gibi maskeler dahil
  const deobfuscated = text
    .replace(/\s*[\[(]\s*(at|собака|kuchuk)\s*[\])]\s*/g, '@')
    .replace(/\s+(at)\s+/g, '@')
    .replace(/\s*[\[(]\s*(dot|nokta|точка|nuqta)\s*[\])]\s*/g, '.')
    .replace(/\s+(dot|nokta|точка|nuqta)\s+/g, '.');
  if (/[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}/.test(deobfuscated)) signals.add('EMAIL');

  // URL / alan adı
  if (
    /(https?:\/\/|www\.)\S+/.test(deobfuscated) ||
    /\b[a-z0-9-]{2,}\.(com|net|org|ru|uz|tr|me|io|app|link|ly|gg|info|kz|tj|kg)\b/.test(deobfuscated) ||
    /\b(t|wa)\s*\.\s*me\b/.test(deobfuscated)
  ) {
    signals.add('URL');
  }

  // @handle (e-posta değilse)
  if (/(^|[^a-z0-9.])@[a-z0-9_]{3,}/.test(text)) signals.add('HANDLE');

  // Telefon: rakamları kelimelerden çevir, ayırıcıları kaldır, 7+ ardışık rakam ara
  const digitsOnly = digitWordsToDigits(text).replace(/[\s.\-()_/|+*]+/g, '');
  if (/\d{7,}/.test(digitsOnly)) signals.add('PHONE');

  // Mesajlaşma uygulaması adı + kullanıcı adına benzeyen bir belirteç (rakam/alt çizgi içeren)
  const hasMessenger = MESSENGER_WORDS.some((w) => text.includes(w));
  if (hasMessenger && /\b(?=[a-z0-9_]*[0-9_])[a-z][a-z0-9_]{3,}\b/.test(text)) {
    signals.add('MESSENGER');
  }

  return { blocked: signals.size > 0, signals: [...signals] };
}
