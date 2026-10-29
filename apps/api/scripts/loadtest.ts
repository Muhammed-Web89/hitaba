/**
 * Yük testi — 200–400 üyeli bir topluluğun yoğun saatini taklit eder.
 *   API_URL=https://staging-api... LT_USERS=100 LT_SECONDS=60 npm run loadtest
 *
 * - Sanal kullanıcılar seed/test hesaplarıyla giriş yapar (yalnızca staging/yerel; üretimde demo hesap yoktur,
 *   LT_EMAILS ile gerçek test hesapları verilebilir).
 * - Her istek farklı bir istemci IP'si taşır (X-Forwarded-For) — tek makineden gelen yük, IP başına
 *   istek sınırına takılıp sonucu çarpıtmasın. API bu başlığa yalnızca güvenilen proxy'den gelirse güvenir.
 * - Karışım: okuma ağırlıklı (me, feed, sohbet listesi, mesajlar); LT_WRITES=1 ile mesaj gönderme de.
 * Eşikler aşılırsa çıkış kodu 1 olur (CI'da kullanılabilir).
 */
import autocannon, { type Request } from 'autocannon';

const API = process.env.API_URL ?? 'http://localhost:4000';
const USERS = Number(process.env.LT_USERS ?? 100);
const SECONDS = Number(process.env.LT_SECONDS ?? 30);
const P95_LIMIT_MS = Number(process.env.LT_P95_MS ?? 500);
const ERROR_LIMIT = Number(process.env.LT_ERROR_RATE ?? 0.01);
const EMAILS = (process.env.LT_EMAILS ?? 'ali@hitaba.dev,umar@hitaba.dev,maryam@hitaba.dev,aisha@hitaba.dev').split(',');
const PASSWORD = process.env.LT_PASSWORD ?? 'hitaba123';
/** Mesaj yazma senaryosu gerçek sohbetlere mesaj ekler — yalnızca ayrı test hesaplarıyla açın. */
const WRITES = process.env.LT_WRITES === '1';

interface Session {
  token: string;
  chatId: string | null;
}

let ipCounter = 0;
const nextIp = () => {
  ipCounter = (ipCounter + 1) % 60000;
  return `100.${64 + Math.floor(ipCounter / 65536)}.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
};

async function login(email: string): Promise<Session> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  const { accessToken } = (await res.json()) as { accessToken: string };
  const chats = (await (await fetch(`${API}/chats`, { headers: { authorization: `Bearer ${accessToken}` } })).json()) as {
    id: string;
    status: string;
  }[];
  return { token: accessToken, chatId: chats.find((c) => c.status === 'ACTIVE')?.id ?? null };
}

async function main() {
  const sessions = await Promise.all(EMAILS.map(login));
  const withChat = sessions.filter((s) => s.chatId);
  console.log(`${WRITES ? 'okuma+yazma' : 'yalnızca okuma'} · ${sessions.length} hesap, ${withChat.length} aktif sohbet · ${USERS} eşzamanlı kullanıcı · ${SECONDS} sn → ${API}`);

  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const auth = (s: Session) => ({ authorization: `Bearer ${s.token}`, 'x-forwarded-for': nextIp(), 'content-type': 'application/json' });

  // Ağırlıklar: gerçek kullanımda okuma, yazmadan çok daha sık.
  const scenarios: Array<[number, () => Request]> = [
    [3, () => ({ method: 'GET', path: '/me', headers: auth(pick(sessions)) })],
    [3, () => ({ method: 'POST', path: '/feed/next', headers: auth(pick(sessions)), body: '{}' })],
    [2, () => ({ method: 'GET', path: '/chats', headers: auth(pick(sessions)) })],
    [2, () => ({ method: 'GET', path: '/notifications', headers: auth(pick(sessions)) })],
    ...(withChat.length
      ? ([
          [2, () => { const s = pick(withChat); return { method: 'GET', path: `/chats/${s.chatId}/messages`, headers: auth(s) }; }],
          ...(WRITES ? [[1, () => { const s = pick(withChat); return { method: 'POST', path: `/chats/${s.chatId}/messages`, headers: auth(s), body: JSON.stringify({ text: 'Yük testi mesajı — lütfen dikkate almayın' }) }; }]] : []),
        ] as Array<[number, () => Request]>)
      : []),
  ];
  const bag = scenarios.flatMap(([w, f]) => Array.from({ length: w }, () => f));

  const result = await autocannon({
    url: API,
    connections: USERS,
    duration: SECONDS,
    requests: [{ setupRequest: (req) => ({ ...req, ...pick(bag)() }) }],
  });

  const total = result.requests.total;
  const errors = result.errors + result.timeouts + result.non2xx;
  const errorRate = total ? errors / total : 1;
  const p95 = result.latency.p97_5 ?? result.latency.p99;
  console.log(`
istek/sn (ort)   ${result.requests.average}
toplam istek     ${total}
gecikme p50      ${result.latency.p50} ms
gecikme p97.5    ${result.latency.p97_5} ms
gecikme p99      ${result.latency.p99} ms
gecikme max      ${result.latency.max} ms
hata/timeout/!2xx ${result.errors}/${result.timeouts}/${result.non2xx}  (oran ${(errorRate * 100).toFixed(2)}%)
durum kodları    ${JSON.stringify(result.statusCodeStats)}`);

  const ok = p95 <= P95_LIMIT_MS && errorRate <= ERROR_LIMIT;
  console.log(ok ? `\n✓ Eşikler sağlandı (p97.5 ≤ ${P95_LIMIT_MS} ms, hata ≤ ${ERROR_LIMIT * 100}%)` : `\n✗ Eşik aşıldı (p97.5 ≤ ${P95_LIMIT_MS} ms, hata ≤ ${ERROR_LIMIT * 100}%)`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
