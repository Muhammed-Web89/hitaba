import assert from 'node:assert/strict';
import { test } from 'node:test';
import { base32Decode, base32Encode, totpAt, verifyTotp } from './totp';

// RFC 6238 Ek B test anahtarı ("12345678901234567890"), SHA-1.
const SECRET = base32Encode(Buffer.from('12345678901234567890'));

test('RFC 6238 test vectors', () => {
  assert.equal(totpAt(SECRET, Math.floor(59 / 30)), '287082');
  assert.equal(totpAt(SECRET, Math.floor(1111111109 / 30)), '081804');
  assert.equal(totpAt(SECRET, Math.floor(1234567890 / 30)), '005924');
  assert.equal(totpAt(SECRET, Math.floor(2000000000 / 30)), '279037');
});

test('base32 round trip', () => {
  const buf = Buffer.from([0, 1, 2, 250, 255, 7, 9]);
  assert.deepEqual(base32Decode(base32Encode(buf)), buf);
});

test('verify accepts ±1 step and rejects others', () => {
  const now = 1_800_000_000_000;
  const step = Math.floor(now / 30_000);
  assert.equal(verifyTotp(SECRET, totpAt(SECRET, step), now), step);
  assert.equal(verifyTotp(SECRET, totpAt(SECRET, step - 1), now), step - 1);
  assert.equal(verifyTotp(SECRET, totpAt(SECRET, step - 3), now), null);
  assert.equal(verifyTotp(SECRET, 'abc', now), null);
});
