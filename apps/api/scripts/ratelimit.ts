/**
 * İstek sınırı doğrulaması — çalışan API'ye karşı (varsayılan http://localhost:4000).
 *   npx tsx scripts/ratelimit.ts
 *
 * Üretimdeki proxy zincirini taklit eder: güvenilen proxy, gerçek istemci IP'sini X-Forwarded-For
 * zincirinin SONUNA ekler. Saldırganın başa yazdığı sahte IP'ler sınırı aşmaya yetmemeli.
 */
import assert from 'node:assert/strict';

const API = process.env.API_URL ?? 'http://localhost:4000';
// Her çalıştırmada farklı "istemci" — önceki çalıştırmaların sayaçlarına takılmamak için.
const clientIp = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

async function post(path: string, body: unknown, spoofed?: string, token?: string) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': spoofed ? `${spoofed}, ${clientIp}` : clientIp,
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function main() {
  console.log(`client ${clientIp}`);

  console.log('1. login: 10/dk sonra 429, sahte X-Forwarded-For ile aşılamaz');
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    // Her istekte farklı sahte IP — sınır yine gerçek istemciye göre işlemeli.
    statuses.push(await post('/auth/login', { email: 'nobody@example.org', password: 'wrong-password' }, `10.9.8.${i}`));
  }
  console.log('   ', statuses.join(' '));
  assert.ok(statuses.slice(0, 10).every((s) => s === 401), 'ilk 10 deneme 401 olmalı');
  assert.ok(statuses.slice(10).every((s) => s === 429), '11. denemeden itibaren 429 olmalı');

  console.log('2. başka bir istemci etkilenmez');
  const other = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' },
    body: JSON.stringify({ email: 'nobody@example.org', password: 'wrong-password' }),
  });
  assert.equal(other.status, 401);

  console.log('3. doğrulama e-postası yeniden gönderimi: 15 dakikada 3');
  const email = `rl.${Date.now()}@test.dev`;
  const reg = await fetch(API + '/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
    body: JSON.stringify({
      email,
      password: 'password123',
      gender: 'MALE',
      consents: { privacy: true, terms: true, sensitiveData: true, adult: true },
    }),
  });
  assert.equal(reg.status, 201);
  const { accessToken } = (await reg.json()) as { accessToken: string };
  const resend: number[] = [];
  for (let i = 0; i < 4; i++) resend.push(await post('/auth/resend-verification', {}, undefined, accessToken));
  console.log('   ', resend.join(' '));
  assert.deepEqual(resend, [204, 204, 204, 429]);

  console.log('\n✓ İstek sınırı doğrulandı');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
