import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyTelegramInitData } from './telegram-init-data';

const BOT = '123456:TEST-TOKEN';

function sign(fields: Record<string, string>, token = BOT): string {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = Date.UTC(2026, 9, 26);
const fields = {
  auth_date: String(Math.floor(now / 1000) - 60),
  query_id: 'AAE',
  user: JSON.stringify({ id: 42, first_name: 'Ali', username: 'ali' }),
};

test('accepts a correctly signed payload', () => {
  const user = verifyTelegramInitData(sign(fields), BOT, 86400, now);
  assert.equal(user?.id, 42);
});

test('rejects tampered data', () => {
  const tampered = sign(fields).replace('Ali', 'Eve');
  assert.equal(verifyTelegramInitData(tampered, BOT, 86400, now), null);
});

test('rejects a different bot token', () => {
  assert.equal(verifyTelegramInitData(sign(fields, '999:OTHER'), BOT, 86400, now), null);
});

test('rejects stale auth_date', () => {
  const old = { ...fields, auth_date: String(Math.floor(now / 1000) - 2 * 86400) };
  assert.equal(verifyTelegramInitData(sign(old), BOT, 86400, now), null);
});
