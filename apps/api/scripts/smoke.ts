/**
 * Uçtan uca duman testi — çalışan API'ye karşı (varsayılan http://localhost:4000).
 *   npx tsx scripts/smoke.ts
 * Seed verisindeki moderatör hesaplarını kullanır.
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';

const API = process.env.API_URL ?? 'http://localhost:4000';
const run = Date.now().toString(36);

async function call<T = any>(method: string, path: string, token?: string, body?: unknown, raw = false): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body !== undefined && !(body instanceof FormData) && { 'content-type': 'application/json' }),
    },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status} ${text}`), { status: res.status, json });
  return json;
}

async function expectError(p: Promise<unknown>, error: string) {
  try {
    await p;
  } catch (e: any) {
    const got = e.json?.error ?? e.json?.message?.error;
    assert.equal(got, error, `expected ${error}, got ${JSON.stringify(e.json)}`);
    return;
  }
  assert.fail(`expected error ${error}`);
}

const login = (email: string) => call('POST', '/auth/login', undefined, { email, password: 'hitaba123' }).then((t) => t.accessToken as string);

async function onboard(gender: 'MALE' | 'FEMALE', name: string) {
  const { accessToken: t } = await call('POST', '/auth/register', undefined, {
    email: `${name.toLowerCase()}.${run}@test.dev`,
    password: 'password123',
    gender,
  });
  const about = 'Assalomu alaykum. Men oilani dinimiz asosida qurishni niyat qilganman, namozlarimni vaqtida o‘qiyman va halol kasb bilan shug‘ullanaman.';
  const steps: Record<string, unknown> = {
    basics: { displayName: name, birthDate: '1998-04-10' },
    location: { country: 'UZ', city: 'Toshkent', nationality: 'O‘zbek', languages: ['uz'], willingToRelocate: false, timezone: 'Asia/Tashkent' },
    body: { heightCm: gender === 'MALE' ? 180 : 162, weightKg: 70 },
    family: { maritalStatus: 'NEVER_MARRIED', nikahCount: 0, childrenCount: 0, ...(gender === 'FEMALE' && { polygamyAnswer: 'NO' }) },
    about: { aboutMe: about },
    spouse: { aboutSpouse: 'Dinli, mas’uliyatli va oilaga sodiq inson bo‘lishini xohlayman.' },
    beliefs: { beliefsManhaj: 'Ahli sunna val jamoa aqidasidaman, ulamolarni hurmat qilaman.' },
    screening: { prayer: 'ALWAYS', alcohol: false, drugs: false, relationsOutsideNikah: false, contagiousDisease: false, ...(gender === 'FEMALE' && { hijab: 'HIJAB' }) },
  };
  await expectError(call('POST', '/profile/submit', t), 'steps_incomplete');
  for (const [k, v] of Object.entries(steps)) await call('PUT', `/profile/steps/${k}`, t, v);
  await call('PUT', '/profile/steps/rules', t, { acceptedRules: true });

  const img = await sharp({ create: { width: 800, height: 1000, channels: 3, background: gender === 'MALE' ? '#2F8F5B' : '#C79A4B' } }).jpeg().toBuffer();
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(img)], { type: 'image/jpeg' }), 'p.jpg');
  const photo = await call('POST', '/photos', t, fd);

  const me = await call('POST', '/profile/submit', t);
  assert.equal(me.status, 'PENDING_MODERATION');
  const id = (await call('GET', '/me', t)).id as string;
  return { t, id, photoId: photo.id as string };
}

async function approveAll(modToken: string, type: string, subjectUserId: string) {
  const queue: any[] = await call('GET', `/moderation/queue?type=${type}`, modToken);
  const items = queue.filter((i) => i.subjectUserId === subjectUserId);
  for (const i of items) await call('POST', `/moderation/items/${i.id}/decision`, modToken, { decision: 'APPROVE' });
  return items.length;
}

async function main() {
  const [modM, modF, admin] = await Promise.all([login('mod.m@hitaba.dev'), login('mod.f@hitaba.dev'), login('admin@hitaba.dev')]);

  console.log('1. kayıt + sihirbaz + gönderim');
  const bro = await onboard('MALE', 'Hamza');
  const sis = await onboard('FEMALE', 'Xadija');
  await expectError(call('POST', '/feed/next', bro.t, {}), 'profile_not_approved');

  console.log('2. moderasyon — cinsiyete bölünmüş fotoğraf erişimi');
  const maleModQueue: any[] = await call('GET', '/moderation/queue?type=PHOTO', modM);
  assert.ok(!maleModQueue.some((i) => i.subjectUserId === sis.id), 'erkek moderatör kadın fotoğrafını görmemeli');
  const sisPhotoItem = (await call('GET', '/moderation/queue?type=PHOTO', modF)).find((i: any) => i.subjectUserId === sis.id);
  await expectError(call('GET', `/moderation/items/${sisPhotoItem.id}`, modM), 'gender_segregated');
  const ctx = await call('GET', `/moderation/items/${(await call('GET', '/moderation/queue?type=PROFILE', modM)).find((i: any) => i.subjectUserId === sis.id).id}`, modM);
  assert.equal(ctx.context.screening.hijab, 'HIJAB', 'moderatör tarama cevaplarını görmeli');
  assert.equal(await approveAll(modM, 'PROFILE', bro.id), 1);
  assert.equal(await approveAll(modF, 'PROFILE', sis.id), 1);
  assert.equal(await approveAll(modM, 'PHOTO', bro.id), 1);
  assert.equal(await approveAll(modF, 'PHOTO', sis.id), 1);

  console.log('3. feed + karşılıklı beğeni');
  const card = await call('POST', '/feed/next', bro.t, { ageMin: 18, ageMax: 60 });
  assert.ok(card.profile, 'feed boş olmamalı');
  assert.equal(card.profile.gender, 'FEMALE');
  assert.equal(card.profile.photoUrls.length, 0, 'erkek kadının fotoğrafını feed’de görmemeli');
  const r1 = await call('POST', `/feed/${sis.id}/like`, bro.t);
  assert.equal(r1.mutual, false);
  assert.equal(r1.likesLeftToday, 9);
  const r2 = await call('POST', `/feed/${bro.id}/like`, sis.t);
  assert.equal(r2.mutual, true);
  const matchId = r2.matchId as string;

  console.log('4. fotoğraf sırası: önce kadın görür');
  let sisMatch = await call('GET', `/matches/${matchId}`, sis.t);
  assert.equal(sisMatch.awaitingMyPhotoDecision, true);
  assert.equal(sisMatch.other.photoUrls.length, 1, 'kadın erkeğin fotoğrafını görmeli');
  let broMatch = await call('GET', `/matches/${matchId}`, bro.t);
  assert.equal(broMatch.other.photoUrls.length, 0, 'onaydan önce erkek görmemeli');
  await expectError(call('POST', '/chats', bro.t, { matchId }), 'invalid_stage');
  await call('POST', `/matches/${matchId}/photo-decision`, sis.t, { approve: true });
  broMatch = await call('GET', `/matches/${matchId}`, bro.t);
  assert.equal(broMatch.other.photoUrls.length, 1, 'onaydan sonra erkek görmeli');
  const imgRes = await call<Response>('GET', broMatch.other.photoUrls[0], undefined, undefined, true);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('content-type'), 'image/jpeg');

  console.log('5. connect + sohbet açma');
  await expectError(call('POST', '/chats', bro.t, { matchId }), 'insufficient_connects');
  await call('POST', '/connects/dev-credit', bro.t, { packageId: 'c3' });
  const chat = await call('POST', '/chats', bro.t, { matchId });
  assert.equal(chat.status, 'ACTIVE');
  assert.equal(chat.watchers.maleModerator, true);
  assert.equal(chat.watchers.femaleModerator, true);
  assert.equal((await call('GET', '/connects', bro.t)).balance, 2);
  assert.equal((await call('GET', `/matches/${matchId}`, sis.t)).other.busy, false);

  console.log('6. mesajlaşma, düzenleme, tepki');
  const m1 = await call('POST', `/chats/${chat.id}/messages`, bro.t, { text: 'Assalomu alaykum, oilangiz haqida aytib bera olasizmi?' });
  assert.equal(m1.state, 'DELIVERED');
  await call('PATCH', `/messages/${m1.id}`, bro.t, { text: 'Assalomu alaykum! Oilangiz haqida aytib bera olasizmi?' });
  await call('PUT', `/messages/${m1.id}/reaction`, sis.t, { reaction: '👍' });
  await expectError(call('PUT', `/messages/${m1.id}/reaction`, sis.t, { reaction: '😀' }), 'validation_failed');

  console.log('7. iletişim bilgisi engeli → sohbet durur → moderatör onayı → devam');
  const held = await call('POST', `/chats/${chat.id}/messages`, bro.t, { text: 'menga yozing +998 90 123 45 67' });
  assert.equal(held.state, 'HELD');
  assert.equal((await call('GET', `/chats/${chat.id}`, sis.t)).status, 'PAUSED');
  const sisView: any[] = await call('GET', `/chats/${chat.id}/messages`, sis.t);
  assert.ok(!sisView.some((m) => m.id === held.id), 'tutulan mesaj karşı tarafa gitmemeli');
  await expectError(call('POST', `/chats/${chat.id}/messages`, sis.t, { text: 'salom' }), 'chat_paused');
  const msgItem = (await call('GET', '/moderation/queue?type=MESSAGE', modF)).find((i: any) => i.targetId === held.id);
  await call('POST', `/moderation/items/${msgItem.id}/decision`, modF, { decision: 'REJECT' });
  assert.equal((await call('GET', `/chats/${chat.id}`, sis.t)).status, 'ACTIVE');

  console.log('8. mahrem iletişim paylaşımı (moderatör onaylı)');
  await call('POST', `/chats/${chat.id}/mahram-contact`, sis.t, { name: 'Abdulloh', relation: 'FATHER', contact: '+998 90 000 00 00' });
  const mcItem = (await call('GET', '/moderation/queue?type=MAHRAM_CONTACT', modM)).find((i: any) => i.subjectUserId === sis.id);
  await call('POST', `/moderation/items/${mcItem.id}/decision`, modM, { decision: 'APPROVE' });
  const after: any[] = await call('GET', `/chats/${chat.id}/messages`, bro.t);
  assert.ok(after.some((m) => m.kind === 'MAHRAM_CONTACT'));

  console.log('9. veli linki + şahitler + salt-okunur portal');
  const wali = await call('PUT', '/wali', sis.t, { waliName: 'Abdulloh', waliRelation: 'FATHER', witnesses: [{ name: 'Zaynab', relation: 'SISTER' }] });
  assert.ok(wali.url);
  const token = wali.url.split('/wali/')[1];
  const portal = await call('GET', `/wali-portal/${token}`);
  assert.equal(portal.chat.id, chat.id);
  assert.ok(!portal.chat.messages.some((m: any) => m.id === held.id), 'veli reddedilen mesajı görmemeli');
  await call('POST', '/wali/link', sis.t);
  const oldRes = await call<Response>('GET', `/wali-portal/${token}`, undefined, undefined, true);
  assert.equal(oldRes.status, 404, 'yeniden oluşturulan linkte eski token geçersiz olmalı');
  assert.equal((await call('GET', `/chats/${chat.id}`, bro.t)).watchers.witnesses.length, 1);

  console.log('10. kadın meşgul → başka erkek sohbet açamaz');
  const ali = await login('ali@hitaba.dev');
  await call('POST', `/feed/${sis.id}/like`, ali);
  const m2 = await call('POST', `/feed/${(await call('GET', '/me', ali)).id}/like`, sis.t);
  await call('POST', `/matches/${m2.matchId}/photo-decision`, sis.t, { approve: true });
  assert.equal((await call('GET', `/matches/${m2.matchId}`, ali)).canOpenChat, false);
  await expectError(call('POST', '/chats', ali, { matchId: m2.matchId }), 'sister_busy');

  console.log('11. şikâyet + ban → sohbet kapanır, karşı tarafa iade');
  await call('POST', '/reports', bro.t, { targetUserId: sis.id, chatId: chat.id, category: 'NOT_SERIOUS' });
  assert.ok((await call('GET', '/admin/reports', modM)).some((r: any) => r.targetUserId === sis.id));
  const modBan = await call<Response>('POST', `/admin/users/${sis.id}/ban`, modM, { reason: 'test' }, true);
  assert.equal(modBan.status, 403, 'ban yalnızca admin yetkisinde');
  await call('POST', `/admin/users/${sis.id}/ban`, admin, { reason: 'smoke test' });
  assert.equal((await call('GET', `/chats/${chat.id}`, bro.t)).closeReason, 'BAN');
  assert.equal((await call('GET', '/connects', bro.t)).balance, 3, 'açan tarafa connect iade edilmeli');
  const banned = await call<Response>('GET', '/me', sis.t, undefined, true);
  assert.equal(banned.status, 401);

  console.log('\n✓ Tüm duman testleri geçti');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});
