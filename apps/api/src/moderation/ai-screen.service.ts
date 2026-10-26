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
