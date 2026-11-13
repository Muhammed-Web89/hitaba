import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanForContactInfo } from '../contact-detector';
import { ageFromBirthDate, profileSteps } from '../schemas';

const blocked = (s: string) => scanForContactInfo(s).blocked;

test('plain conversation passes', () => {
  for (const s of [
    'Assalomu alaykum, oilangiz haqida aytib bera olasizmi?',
    'Boyum 175, yoshim 28. Namozni vaqtida o‘qishga harakat qilaman.',
    'Ben 1995 doğumluyum ve 2 kardeşim var.',
    'Я работаю инженером уже пять лет.',
    'I have three brothers and one sister.',
    'Sık sık ailemi ziyaret ederim, işte sıkıştım biraz.',
    'Ва алейкум ассалям. В связи с работой переехал.',
    'Куръондан кайси сурани кетма кетлигини биласизми',
    'Ota-onam bilan yashayman, aloqador emas.',
    'أنا عريس المستقبل إن شاء الله، جنسيتي أوزبكية',
    'Hamma narsa Allohning izni bilan boʻladi.',
  ]) {
    assert.equal(blocked(s), false, s);
  }
});

test('phone numbers, including obfuscated', () => {
  for (const s of [
    '+998 90 123 45 67',
    '0532-123-45-67',
    'nomerim 9 0 1 2 3 4 5 6 7',
    'sifir bes uc iki bir iki uc dort bes',
    'восемь девять ноль один два три четыре',
    '٠٥٣٢١٢٣٤٥٦٧',
  ]) {
    assert.ok(scanForContactInfo(s).signals.includes('PHONE'), s);
  }
});

test('emails, urls, handles', () => {
  assert.ok(scanForContactInfo('ali.veli@gmail.com').signals.includes('EMAIL'));
  assert.ok(scanForContactInfo('ali (at) gmail (dot) com').signals.includes('EMAIL'));
  assert.ok(scanForContactInfo('t.me/alivali').signals.includes('URL'));
  assert.ok(scanForContactInfo('https://example.org/x').signals.includes('URL'));
  assert.ok(scanForContactInfo('menga yozing @ali_vali').signals.includes('HANDLE'));
  assert.ok(scanForContactInfo('insta: ali_vali95').signals.includes('MESSENGER'));
});

test('age calculation respects birthday', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  assert.equal(ageFromBirthDate('2000-06-15', now), 26);
  assert.equal(ageFromBirthDate('2000-06-16', now), 25);
});

test('basics step rejects minors', () => {
  const y = new Date().getUTCFullYear() - 17;
  const r = profileSteps.basics.safeParse({ displayName: 'Aisha', birthDate: `${y}-01-01` });
  assert.equal(r.success, false);
});

test('asking for or offering contact details is held', () => {
  for (const s of [
    'Ракамизни беринг',
    'Ман ёзаман езиб олинг шу номерда телеграм булади',
    'Таер туринг бошка алокадан ракамларни расмга олиб олинг',
    'raqamingizni yozib qoldiring',
    'nomeringiz bormi?',
    'kontaktingizni bering',
    'aloqangizni yuboring',
    'telefon raqamingizni bering',
    'telegram linkingizni tashlang',
    'Telegram üzerinden yazar mısın?',
    'numaranı verir misin',
    'дайте ваш телефон, созвонимся',
    'скиньте телеграм',
    'send me your number',
    'أعطني رقم هاتفك',
  ]) {
    assert.ok(scanForContactInfo(s).signals.includes('INTENT'), s);
  }
});

test('contact words alone do not hold the chat', () => {
  for (const s of [
    'Aloqa sohasida ishlayman',
    'Telefon ustasiman',
    'Telegramda Hitabani topdim',
    'Kontakt markazida ishlayman',
    'Я работаю в отделе связи, телефон у меня старый',
    'Hitabayı Telegram’da buldum',
  ]) {
    assert.ok(!scanForContactInfo(s).signals.includes('INTENT'), s);
  }
});

test('profanity and indecent words are held', () => {
  for (const s of ['ты сука', 'nima qilyapsan jalab', 'siktir git', 'send nudes', 'секс хочешь?', 'Ялангоч расм']) {
    assert.ok(scanForContactInfo(s).signals.includes('PROFANITY'), s);
  }
});
