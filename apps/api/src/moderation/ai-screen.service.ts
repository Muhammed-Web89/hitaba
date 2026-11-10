import { Injectable } from '@nestjs/common';
import { scanForContactInfo } from '@hitaba/shared';
import sharp from 'sharp';

/**
 * Yapay zekâ ön taraması (§5.2). İlk sürüm kural tabanlıdır; gerçek bir metin/görsel
 * moderasyon sağlayıcısı aynı arayüzün arkasına takılır. Sağlayıcıya yalnızca içerik
 * gönderilir — isim, iletişim veya kullanıcı kimliği gönderilmez (§7).
 *
 * Bayraklar yalnızca moderatöre ipucudur; nihai karar her zaman insandadır.
 */
@Injectable()
export class AiScreenService {
  screenText(text: string): string[] {
    const flags: string[] = [];
    const contact = scanForContactInfo(text);
    if (contact.blocked) flags.push(...contact.signals.map((s) => `contact:${s.toLowerCase()}`));
    if (/(.)\1{9,}/.test(text)) flags.push('spam:repeated_chars');
    if (text.trim().split(/\s+/).length < 8) flags.push('quality:too_short');
    return flags;
  }

  async screenImage(data: Buffer): Promise<string[]> {
    const flags: string[] = [];
    const meta = await sharp(data).metadata();
    if ((meta.width ?? 0) < 400 || (meta.height ?? 0) < 400) flags.push('quality:low_resolution');
    return flags;
  }
}

const VOWELS = /[aeiouyäöüıâîûàáèéìíòóùúаеёиоуыэюяўіәөұүі]/iu;
const LATIN_OR_CYRILLIC = /[a-zа-яёўқғҳәөұүі]/iu;

/** Bir kelime gerçek bir sözcüğe benziyor mu: tek harf, aynı harfin tekrarı veya sesli harfsiz klavye karalaması değil. */
function wordLike(word: string): boolean {
  const w = word.toLowerCase();
  if ([...w].length < 2) return false;
  if (/(.)\1\1/u.test(w)) return false;
  if (new Set(w).size === 1) return false;
  // Arap yazısında kısa sesliler yazılmaz; yalnızca uzunluk ve tekrar kontrolü yeterli.
  if (!LATIN_OR_CYRILLIC.test(w)) return true;
  if (!VOWELS.test(w)) return w.length <= 3; // "va", "в", "ve" gibi kısa bağlaçlar; uzun sessiz dizisi karalamadır
  return !/[^aeiouyäöüıâîûàáèéìíòóùúаеёиоуыэюяўіәөұүіʼ'‘’ьъ]{5,}/iu.test(w);
}

/**
 * Serbest metin söze benziyor mu. En az 2 farklı gerçek kelime olmalı ve kelimelerin çoğu gerçek
 * kelime olmalı. "a b c d e…", "aaaa", "....", "asdfgh jkl", "lorem ipsum" gibi doldurmalar elenir;
 * kısa ama gerçek yazılar ("Quvnoq hazilkashman") geçer, onlara moderatör karar verir.
 */
export function looksLikeText(text: string | null | undefined): boolean {
  const words = (text ?? '').match(/[\p{L}ʼ'‘’]+/gu)?.map((w) => w.replace(/^['‘’ʼ]+|['‘’ʼ]+$/g, '')).filter(Boolean) ?? [];
  const real = words.filter(wordLike).map((w) => w.toLowerCase());
  const distinct = new Set(real.filter((w) => w !== 'lorem' && w !== 'ipsum'));
  return distinct.size >= 2 && real.length >= words.length * 0.6;
}
