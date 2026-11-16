import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Mini App initData doğrulaması (HMAC-SHA256).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
  now = Date.now(),
): TelegramWebAppUser | null {
  if (!botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > maxAgeSeconds) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TelegramWebAppUser | null;
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

/**
 * Telegram Login Widget doğrulaması (tarayıcı ve Android uygulaması). Gizli anahtar bot token'ının SHA-256'sıdır.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLoginWidget(
  fields: Record<string, string>,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
  now = Date.now(),
): TelegramWebAppUser | null {
  if (!botToken || !fields.hash || !fields.id) return null;
  const dataCheckString = Object.keys(fields)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(fields.hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const authDate = Number(fields.auth_date);
  if (!authDate || now / 1000 - authDate > maxAgeSeconds) return null;
  const id = Number(fields.id);
  if (!Number.isSafeInteger(id)) return null;
  return { id, first_name: fields.first_name, last_name: fields.last_name, username: fields.username };
}
