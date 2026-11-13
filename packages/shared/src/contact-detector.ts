/**
 * İletişim bilgisi dedektörü (§5.5): telefon, @kullanıcı adı, link, e-posta ve
 * bunların maskelenmiş/parçalanmış hâlleri. Sunucu otoritedir; istemci yalnızca
 * önceden uyarı göstermek için kullanır.
 *
 * Yanlış pozitif kabul edilebilir — mesaj silinmez, moderatör onayına tutulur.
 */

/**
 * INTENT: iletişim bilgisi isteme/verme niyeti — iletişim adı + isteme fiili ("raqamingizni bering", "скиньте телеграм");
 * PROFANITY: küfür ve ahlaka aykırı sözler. İkisi de mesajı moderatöre tutar.
 */
export type ContactSignal = 'PHONE' | 'EMAIL' | 'URL' | 'HANDLE' | 'MESSENGER' | 'INTENT' | 'PROFANITY';

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

/**
 * İletişim niyeti ikili kelimeyle anlaşılır: bir iletişim adı ("raqam", "kontakt", "telegram", "номер")
 * VE aynı mesajda bir isteme/gönderme fiili ("bering", "yuboring", "скиньте", "ver"). Tek başına
 * "aloqa" ya da "telefon" sohbeti durdurmaz — rakam sınırı zaten numara paylaşımını engeller.
 * PREFIX: kelime bununla başlıyorsa ("raqamingizni", "телефоном"); EXACT: yalnızca kendisi.
 */
const CONTACT_PREFIX = [
  // uz (lotin)
  'nomer', 'raqam', 'telefon', 'aloqa', 'kontakt', 'lichka', 'akkaunt', 'link', 'ssilka',
  // uz / ru (kiril)
  'номер', 'ракам', 'рақам', 'телефон', 'алока', 'алоқа', 'контакт', 'личк', 'аккаунт', 'линк', 'ссылк',
  // tr
  'numara', 'iletisim', 'irtibat', 'hesab',
  // en
  'number', 'phone', 'contact', 'account', 'handle', 'username',
  // ar
  'رقم', 'هاتف', 'جوال', 'تلفون', 'تليفون', 'واتس', 'تلجرام', 'تيليجرام', 'انستا', 'حساب', 'رابط',
  ...MESSENGER_WORDS.filter((w) => w.length > 4),
];
const CONTACT_EXACT = ['tel', 'тел', 'imo', 'tg', 'тг', 'wp', 'insta', 'инста', 'лс', 'dm'];

const REQUEST_PREFIX = [
  // uz: ber-, yubor-, tashla-, yoz-, qoldir-, ayt-, ulash-, olib
  'ber', 'yubor', 'jonat', 'tashla', 'yoz', 'qoldir', 'ayt', 'ulash', 'olib', 'oling',
  'бер', 'юбор', 'жўнат', 'жонат', 'ташла', 'ёз', 'қолдир', 'колдир', 'айт', 'улаш', 'олиб', 'олинг',
  // ru
  'дай', 'дайт', 'дашь', 'скин', 'кин', 'отправ', 'пиш', 'напиш', 'остав', 'добав', 'сброс', 'подел', 'перешл',
  // tr
  'ver', 'gonder', 'yaz', 'paylas', 'birak', 'yolla', 'ekle',
  // en
  'give', 'send', 'share', 'text', 'drop', 'write', 'leave', 'add',
  // ar
  'اعط', 'أعط', 'ارسل', 'أرسل', 'ابعث', 'اكتب', 'شارك', 'هات',
];
// "at" (tr: numaranı at) kısa olduğu için yalnızca kendisi; "bormi" (bor mi?) da soru biçimiyle istek sayılır.
const REQUEST_EXACT = ['at', 'atar', 'atarmisin', 'atin', 'bormi', 'борми', 'dm'];

const PROFANITY_PREFIX = [
  // ru
  'хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебал', 'ебан', 'ебу', 'выеб', 'заеб', 'уеб', 'бляд', 'блят', 'мудак', 'мудил', 'пидор', 'пидар', 'гандон',
  'шлюх', 'залуп', 'дроч', 'трах', 'секс', 'порн', 'интим', 'голая', 'голые', 'раздеть', 'раздева', 'минет', 'оргазм', 'эрот',
  // uz
  'jalab', 'jalap', 'qanjiq', 'dalbayob', 'dalbayop', 'onangni', 'gandon', 'yalangoch', 'erotik', 'intim', 'porno', 'sikish', 'sikay', 'sikam',
  'жалаб', 'қанжиқ', 'канжик', 'далбаёб', 'онангни', 'ялангоч', 'яланғоч', 'сикиш', 'сикай',
  // tr
  'orospu', 'siktir', 'sikerim', 'yarrak', 'yarak', 'kahpe', 'pezevenk', 'amcik', 'ciplak', 'sevisme', 'sevisel', 'gotunu',
  // en
  'fuck', 'bitch', 'slut', 'whore', 'pussy', 'porn', 'horny', 'nude', 'naked', 'boob', 'blowjob', 'erotic',
  // ar
  'شرموط', 'عاهر', 'قحب', 'منيوك', 'سكس',
];
// Türkçe "sık sık", "sıkıştı" normalize edilince "sik…" olur; bu yüzden o kökler listede yok.
const PROFANITY_EXACT = ['бля', 'сука', 'суки', 'сучка', 'ебать', 'amk', 'oc', 'seks', 'sex', 'sexy', 'seksi', 'shit', 'dick', 'كس', 'زب', 'نيك', 'عارية', 'عاري'];

function normalize(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // Arapça harekeler ve kelime içi kesme işaretleri (o‘g‘il → ogil)
      .replace(/[ً-ْٰ]/g, '')
      .replace(/[ʻʼ'‘’`]/g, '')
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

const norm = (list: string[]) => list.map(normalize);
const LISTS = {
  CONTACT: { prefix: norm(CONTACT_PREFIX), exact: new Set(norm(CONTACT_EXACT)) },
  REQUEST: { prefix: norm(REQUEST_PREFIX), exact: new Set(norm(REQUEST_EXACT)) },
  PROFANITY: { prefix: norm(PROFANITY_PREFIX), exact: new Set(norm(PROFANITY_EXACT)) },
} as const;

function hasWord(words: string[], kind: keyof typeof LISTS): boolean {
  const { prefix, exact } = LISTS[kind];
  return words.some((w) => exact.has(w) || prefix.some((p) => w.startsWith(p)));
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

  const words = text.match(/[\p{L}]+/gu) ?? [];
  if (hasWord(words, 'CONTACT') && hasWord(words, 'REQUEST')) signals.add('INTENT');
  if (hasWord(words, 'PROFANITY')) signals.add('PROFANITY');

  return { blocked: signals.size > 0, signals: [...signals] };
}
