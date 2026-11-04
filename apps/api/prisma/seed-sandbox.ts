/**
 * Deneme hesapları (isSandbox): gerçek gibi görünen 20 kadın + 2 erkek profili. Yalnızca birbirlerini görürler;
 * gerçek kullanıcıların akışına, beğenilerine ve sohbetlerine hiç girmezler (MatchingService / ProfilesService).
 *
 *   SANDBOX_PASSWORD='…' npx tsx prisma/seed-sandbox.ts --sandbox
 *
 * Tekrar çalıştırılırsa var olan hesaplara dokunmaz. Silmek için: --remove
 */
import '../src/config/load-env';
import { createPrismaClient } from '../src/prisma/client';
import type { ConsentKind, MaritalStatus, PolygamyAnswer, Relation } from '@prisma/client';
import { POLICY_VERSION } from '@hitaba/shared';
import { hashPassword } from '../src/common/crypto';

if (!process.argv.includes('--sandbox')) {
  console.error('Bu betik yalnızca --sandbox bayrağıyla çalışır (deneme hesapları oluşturur).');
  process.exit(1);
}
const PASSWORD = process.env.SANDBOX_PASSWORD ?? '';
if (!process.argv.includes('--remove') && PASSWORD.length < 10) {
  console.error('SANDBOX_PASSWORD en az 10 karakter olmalı.');
  process.exit(1);
}

const prisma = createPrismaClient();
const DOMAIN = '@hitaba.me';
const consents = {
  create: (['PRIVACY', 'TERMS', 'SENSITIVE_DATA', 'ADULT'] as ConsentKind[]).map((kind) => ({ kind, version: POLICY_VERSION })),
};

interface Person {
  email: string;
  name: string;
  birth: string;
  country: string;
  city: string;
  nationality: string;
  languages: string[];
  height: number;
  weight: number;
  marital: MaritalStatus;
  nikahCount?: number;
  children?: number;
  childrenWith?: number;
  polygamy?: PolygamyAnswer;
  relocate?: boolean;
  interests: string[];
  about: string;
  spouse: string;
  beliefs: string;
  witnesses?: Array<{ name: string; relation: Relation }>;
  tz?: string;
}

const women: Person[] = [
  {
    email: 'madina.yusupova',
    name: 'Madina',
    birth: '1999-04-12',
    country: 'UZ',
    city: 'Toshkent',
    nationality: 'UZBEK',
    languages: ['uz', 'ru', 'en'],
    height: 164,
    weight: 55,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['QURAN', 'READING', 'COOKING', 'LANGUAGES'],
    about:
      'Assalomu alaykum. Tibbiyot akademiyasini tamomlaganman, hozir bolalar shifoxonasida hamshira boʻlib ishlayman. Boʻsh vaqtimda kitob oʻqiyman va ingliz tilini oʻrganyapman. Oilamda uch farzandning kattasiman.',
    spouse: 'Namozini vaqtida oʻqiydigan, mehribon va masʼuliyatli, ota-onasini hurmat qiladigan inson. Oilaga jiddiy qaraydigan boʻlsin.',
    beliefs: 'Ahli sunna val-jamoa aqidasidaman, hanafiy mazhabiga amal qilaman. Dinni masjid imomlari va ishonchli ustozlardan oʻrganaman.',
    witnesses: [{ name: 'Dilnoza', relation: 'SISTER' }],
  },
  {
    email: 'sevara.rahimova',
    name: 'Sevara',
    birth: '2001-09-03',
    country: 'UZ',
    city: 'Samarqand',
    nationality: 'UZBEK',
    languages: ['uz', 'ru'],
    height: 160,
    weight: 51,
    marital: 'NEVER_MARRIED',
    polygamy: 'PREFER_NOT_TO_SAY',
    interests: ['CALLIGRAPHY', 'HOMEMAKING', 'GARDENING'],
    about: 'Universitetda filologiya fakultetida oʻqiyapman, oxirgi kursman. Uy ishlarini, ayniqsa pishiriq qilishni yaxshi koʻraman. Kamgapman, lekin samimiyman.',
    spouse: 'Halol mehnat qiladigan, sabrli va oilasiga vaqt ajratadigan yigit.',
    beliefs: 'Hanafiy mazhabidaman. Namoz, roʻza va hijobga amal qilaman, hozir tajvid oʻrganyapman.',
  },
  {
    email: 'gulnoza.karimova',
    name: 'Gulnoza',
    birth: '1994-01-27',
    country: 'UZ',
    city: 'Fargʻona',
    nationality: 'UZBEK',
    languages: ['uz', 'ru'],
    height: 158,
    weight: 57,
    marital: 'DIVORCED',
    nikahCount: 1,
    children: 1,
    childrenWith: 1,
    polygamy: 'YES',
    interests: ['QURAN', 'COOKING', 'CHARITY', 'CRAFTS'],
    about:
      'Assalomu alaykum va rohmatulloh. Bir marta nikohda boʻlganman, 5 yoshli oʻgʻlim bor, u men bilan yashaydi. Tikuvchilik bilan shugʻullanaman, uydan ishlayman. Hayotdan saboq olganman, endi oilani sabr va tushunish bilan qurmoqchiman.',
    spouse: 'Farzandimni oʻz bolasidek qabul qiladigan, yumshoq tabiatli, dindor inson. Yoshi 30–42 oraligʻida boʻlsa yaxshi.',
    beliefs: 'Ahli sunna aqidasidaman. Hanafiy mazhabiga ergashaman, masjidda ayollar darsiga qatnashaman.',
    witnesses: [
      { name: 'Muhabbat', relation: 'MOTHER' },
      { name: 'Shahlo', relation: 'SISTER' },
    ],
  },
  {
    email: 'aziza.tursunova',
    name: 'Aziza',
    birth: '1997-06-18',
    country: 'UZ',
    city: 'Andijon',
    nationality: 'UZBEK',
    languages: ['uz'],
    height: 162,
    weight: 53,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    relocate: true,
    interests: ['ISLAMIC_KNOWLEDGE', 'ARABIC', 'READING'],
    about: 'Maktabda boshlangʻich sinf oʻqituvchisiman. Bolalarni juda yaxshi koʻraman. Arab tilini oʻrganyapman, inshaAlloh Qurʼonni maʼnosi bilan tushunishni niyat qilganman.',
    spouse: 'Ilmga intiladigan, xushmuomala, oilani boshqara oladigan inson. Boshqa shaharga koʻchishga tayyorman.',
    beliefs: 'Ahli sunna val-jamoa. Moturidiy aqidasi va hanafiy fiqhi boʻyicha oʻqiyman.',
  },
  {
    email: 'kamola.nazarova',
    name: 'Kamola',
    birth: '2000-11-02',
    country: 'UZ',
    city: 'Buxoro',
    nationality: 'UZBEK',
    languages: ['uz', 'ru', 'tr'],
    height: 167,
    weight: 56,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['TRAVEL', 'NATURE', 'COOKING', 'LANGUAGES'],
    about: 'Turizm sohasida ishlayman, Buxoroga kelgan mehmonlarga gid boʻlaman. Turk tilini bilaman. Tabiatda sayr qilish va yangi taomlar tayyorlash sevimli mashgʻulotlarim.',
    spouse: 'Ochiq koʻngilli, rostgoʻy, namozxon. Ota-onamni ham hurmat qiladigan boʻlsin.',
    beliefs: 'Hanafiy mazhabiga amal qilaman. Dinni oilam va mahalla masjidi imomidan oʻrganganman.',
    witnesses: [{ name: 'Nodira', relation: 'AUNT' }],
  },
  {
    email: 'dilfuza.ergasheva',
    name: 'Dilfuza',
    birth: '1991-03-09',
    country: 'UZ',
    city: 'Namangan',
    nationality: 'UZBEK',
    languages: ['uz', 'ru'],
    height: 156,
    weight: 60,
    marital: 'WIDOWED',
    nikahCount: 1,
    children: 2,
    childrenWith: 2,
    polygamy: 'YES',
    interests: ['QURAN', 'HOMEMAKING', 'CHARITY'],
    about:
      'Turmush oʻrtogʻim uch yil oldin vafot etgan, Alloh rahmat qilsin. Ikki qizim bor, ular men bilan. Bogʻchada tarbiyachiman. Sabrli va mehnatkashman, oilamni tinch saqlashni bilaman.',
    spouse: 'Qizlarimga otalik qila oladigan, taqvodor va halol inson. Ikkinchi xotin boʻlishga ham rozi boʻlishim mumkin.',
    beliefs: 'Ahli sunna aqidasidaman, hanafiy mazhabiga amal qilaman.',
    witnesses: [{ name: 'Akbar', relation: 'BROTHER' }],
  },
  {
    email: 'nilufar.sobirova',
    name: 'Nilufar',
    birth: '1998-08-21',
    country: 'UZ',
    city: 'Navoiy',
    nationality: 'UZBEK',
    languages: ['uz', 'ru', 'en'],
    height: 165,
    weight: 54,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['TECHNOLOGY', 'READING', 'SPORTS'],
    about: 'Kon-metallurgiya kombinatida muhandis-texnolog boʻlib ishlayman. Ishimni sevaman, lekin oila men uchun birinchi oʻrinda. Ertalab yugurishni yaxshi koʻraman.',
    spouse: 'Bilimli, oʻz ustida ishlaydigan, ayolining ishini hurmat qiladigan inson.',
    beliefs: 'Hanafiy mazhabidaman. Namozlarimni oʻqiyman, dinni kitoblar va maʼruzalardan oʻrganaman.',
  },
  {
    email: 'shahnoza.qodirova',
    name: 'Shahnoza',
    birth: '2002-02-14',
    country: 'UZ',
    city: 'Qarshi',
    nationality: 'UZBEK',
    languages: ['uz'],
    height: 159,
    weight: 49,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['COOKING', 'CRAFTS', 'ANIMALS'],
    about: 'Kollejni tamomlaganman, hozir onamga uy ishlarida yordam beraman va qoʻl ishlari qilaman. Mushuklarni juda yaxshi koʻraman.',
    spouse: 'Yumshoq tabiatli, oilaparvar, ichkilik va sigaretdan uzoq yigit.',
    beliefs: 'Ahli sunna. Namoz va roʻzani tark etmayman.',
    witnesses: [{ name: 'Zulfiya', relation: 'MOTHER' }],
  },
  {
    email: 'mohinur.ahmedova',
    name: 'Mohinur',
    birth: '1996-12-05',
    country: 'UZ',
    city: 'Toshkent',
    nationality: 'UZBEK',
    languages: ['uz', 'ru', 'en', 'ar'],
    height: 168,
    weight: 58,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['ISLAMIC_KNOWLEDGE', 'ARABIC', 'WRITING', 'CHARITY'],
    about:
      'Xalqaro islom akademiyasini bitirganman, hozir xayriya jamgʻarmasida loyihalar bilan ishlayman. Maqolalar yozaman. Insonlarga foyda keltiradigan ishni qilishni yaxshi koʻraman.',
    spouse: 'Ilm ahli boʻlsa yaxshi, boʻlmasa ham ilmni qadrlaydigan, odobli va saxiy inson.',
    beliefs: 'Ahli sunna val-jamoa aqidasidaman, moturidiy, hanafiy. Ulamolarning ixtiloflariga hurmat bilan qarayman.',
    witnesses: [{ name: 'Robiya', relation: 'FRIEND' }],
  },
  {
    email: 'zarina.ismoilova',
    name: 'Zarina',
    birth: '1993-05-30',
    country: 'UZ',
    city: 'Urganch',
    nationality: 'UZBEK',
    languages: ['uz', 'ru'],
    height: 161,
    weight: 59,
    marital: 'DIVORCED',
    nikahCount: 1,
    polygamy: 'YES',
    relocate: true,
    interests: ['GARDENING', 'COOKING', 'NATURE'],
    about: 'Bir marta nikohda boʻlganman, farzandim yoʻq. Buxgalter boʻlib ishlayman. Uyimizning bogʻiga oʻzim qarayman, gul ekishni yaxshi koʻraman.',
    spouse: 'Kelishimli, rostgoʻy, oilasiga gʻamxoʻr inson. Ikkinchi xotin boʻlishga ham rozi boʻlaman, agar adolatli boʻlsa.',
    beliefs: 'Hanafiy mazhabiga amal qilaman.',
  },
  {
    email: 'aigerim.nurlanovna',
    name: 'Aigerim',
    birth: '1998-07-11',
    country: 'KZ',
    city: 'Almaty',
    nationality: 'KAZAKH',
    languages: ['kk', 'ru', 'en'],
    height: 166,
    weight: 55,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    relocate: true,
    interests: ['TRAVEL', 'HORSE_RIDING', 'LANGUAGES', 'READING'],
    tz: 'Asia/Almaty',
    about:
      'Ассаляму алейкум. Работаю переводчиком в логистической компании. Выросла в Алматы, но корни из Туркестана. Люблю горы, верховую езду и хорошие книги.',
    spouse: 'Ищу верующего, спокойного и ответственного мужчину, который ценит семью. Готова к переезду.',
    beliefs: 'Ахлю сунна валь-джамаа, следую ханафитскому мазхабу. Изучаю религию у имамов нашей мечети.',
    witnesses: [{ name: 'Айгуль', relation: 'SISTER' }],
  },
  {
    email: 'aliya.sharipova',
    name: 'Алия',
    birth: '1995-10-23',
    country: 'RU',
    city: 'Kazan',
    nationality: 'TATAR',
    languages: ['ru', 'en'],
    height: 163,
    weight: 54,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['READING', 'CALLIGRAPHY', 'QURAN'],
    tz: 'Europe/Moscow',
    about: 'Ассаляму алейкум. Я дизайнер интерьеров, живу в Казани. Занимаюсь арабской каллиграфией, учу Коран с преподавателем. По характеру спокойная, люблю уют.',
    spouse: 'Мужчина с крепким иманом, совершающий намаз, с чувством юмора и уважением к родителям.',
    beliefs: 'Ахлю сунна, ханафитский мазхаб.',
  },
  {
    email: 'zeynep.aydin',
    name: 'Zeynep',
    birth: '1999-03-17',
    country: 'TR',
    city: 'İstanbul',
    nationality: 'TURKISH',
    languages: ['tr', 'en', 'ar'],
    height: 165,
    weight: 56,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['ARABIC', 'ISLAMIC_KNOWLEDGE', 'TRAVEL'],
    tz: 'Europe/Istanbul',
    about:
      'Esselâmü aleyküm. İlahiyat fakültesinden mezun oldum, şu an bir Kur’an kursunda hocalık yapıyorum. Arapçam iyi. Ailemle çok yakınım, iki erkek kardeşim var.',
    spouse: 'Namazında, ahlakı güzel, ilme değer veren ve aile kurmaya hazır biri.',
    beliefs: 'Ehl-i sünnet akidesindeyim, Hanefî mezhebine tabiyim.',
    witnesses: [{ name: 'Fatma', relation: 'MOTHER' }],
  },
  {
    email: 'elif.kara',
    name: 'Elif',
    birth: '1996-09-08',
    country: 'TR',
    city: 'Konya',
    nationality: 'TURKISH',
    languages: ['tr', 'en'],
    height: 161,
    weight: 58,
    marital: 'DIVORCED',
    nikahCount: 1,
    children: 1,
    childrenWith: 1,
    polygamy: 'PREFER_NOT_TO_SAY',
    interests: ['COOKING', 'HOMEMAKING', 'CHARITY'],
    tz: 'Europe/Istanbul',
    about: 'Bir kızım var, 4 yaşında. Bir eczanede çalışıyorum. Sakin bir hayatı seviyorum; hafta sonları kızımla parka gidiyoruz.',
    spouse: 'Kızıma da sevgiyle yaklaşacak, merhametli ve sorumluluk sahibi biri.',
    beliefs: 'Ehl-i sünnet, Hanefî.',
  },
  {
    email: 'nasiba.olimova',
    name: 'Nasiba',
    birth: '1990-06-14',
    country: 'UZ',
    city: 'Jizzax',
    nationality: 'UZBEK',
    languages: ['uz', 'ru'],
    height: 157,
    weight: 62,
    marital: 'DIVORCED',
    nikahCount: 1,
    children: 3,
    childrenWith: 2,
    polygamy: 'YES',
    interests: ['QURAN', 'HOMEMAKING', 'GARDENING'],
    about: 'Uch farzandim bor, ikkitasi men bilan yashaydi. Oilaviy tadbirkorlik bilan shugʻullanaman — kichik non sexi. Hayotimni tartibga solganman, endi tinch oila qurishni istayman.',
    spouse: 'Kattalarni hurmat qiladigan, rahmdil, oʻz soʻzida turadigan inson. Ikkinchi xotin boʻlishga roziman.',
    beliefs: 'Ahli sunna aqidasi, hanafiy mazhabi.',
    witnesses: [{ name: 'Gavhar', relation: 'SISTER' }],
  },
  {
    email: 'malika.xolmatova',
    name: 'Malika',
    birth: '2003-01-19',
    country: 'UZ',
    city: 'Toshkent',
    nationality: 'UZBEK',
    languages: ['uz', 'ru', 'en'],
    height: 163,
    weight: 50,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['SWIMMING', 'READING', 'TECHNOLOGY'],
    about: 'Axborot texnologiyalari universitetida dasturlashni oʻqiyapman. Kelajakda uydan ishlashni rejalashtiryapman. Suzishga qatnashaman (ayollar guruhi).',
    spouse: 'Zamonaviy fikrlaydigan, lekin dinida mustahkam, oʻqishimni davom ettirishimga qarshi boʻlmaydigan yigit.',
    beliefs: 'Hanafiy mazhabidaman. Dinni oilam va onlayn darslar orqali oʻrganaman.',
  },
  {
    email: 'feruza.mamatova',
    name: 'Feruza',
    birth: '1995-04-04',
    country: 'KG',
    city: 'Osh',
    nationality: 'UZBEK',
    languages: ['uz', 'ky', 'ru'],
    height: 160,
    weight: 55,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    relocate: true,
    interests: ['COOKING', 'TRAVEL', 'CRAFTS'],
    tz: 'Asia/Bishkek',
    about: 'Oʻshda yashayman, oʻzbek oilasidanman. Tikuv sexida dizayner boʻlib ishlayman. Oʻzbekistonga koʻchib oʻtishga tayyorman.',
    spouse: 'Oilasini hurmat qiladigan, ishbilarmon va namozxon yigit.',
    beliefs: 'Ahli sunna val-jamoa, hanafiy.',
    witnesses: [{ name: 'Mavluda', relation: 'MOTHER' }],
  },
  {
    email: 'barno.saidova',
    name: 'Barno',
    birth: '1997-02-26',
    country: 'UZ',
    city: 'Termiz',
    nationality: 'UZBEK',
    languages: ['uz', 'tg', 'ru'],
    height: 158,
    weight: 52,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['QURAN', 'READING', 'NATURE'],
    about: 'Dorixonada farmatsevt boʻlib ishlayman. Ota-onam va ikki ukam bilan yashayman. Qurʼonni yodlashni boshlaganman, hozir uch pora yodladim.',
    spouse: 'Qurʼonga yaqin, xotirjam va oilasiga sodiq inson.',
    beliefs: 'Ahli sunna aqidasidaman, hanafiy mazhabiga amal qilaman. Hifz ustozim bor.',
  },
  {
    email: 'iroda.yoqubova',
    name: 'Iroda',
    birth: '1992-10-10',
    country: 'UZ',
    city: 'Nukus',
    nationality: 'KARAKALPAK',
    languages: ['uz', 'ru'],
    height: 169,
    weight: 61,
    marital: 'NEVER_MARRIED',
    polygamy: 'PREFER_NOT_TO_SAY',
    relocate: true,
    interests: ['BUSINESS', 'TRAVEL', 'CHARITY'],
    about: 'Kichik kiyim doʻkonim bor, oʻzim boshqaraman. Mustaqil va tartibliman. Shu yoshgacha oʻqish va ish bilan band boʻldim, endi oila qurish vaqti keldi deb bilaman.',
    spouse: 'Yetuk fikrli, tushunadigan va qoʻllab-quvvatlaydigan, dindor inson.',
    beliefs: 'Ahli sunna. Namoz va roʻzaga amal qilaman, hijob kiyaman.',
    witnesses: [{ name: 'Gulshan', relation: 'SISTER' }],
  },
  {
    email: 'hafiza.rustamova',
    name: 'Hafiza',
    birth: '2000-05-22',
    country: 'UZ',
    city: 'Margʻilon',
    nationality: 'UZBEK',
    languages: ['uz', 'ar'],
    height: 155,
    weight: 48,
    marital: 'NEVER_MARRIED',
    polygamy: 'NO',
    interests: ['QURAN', 'ARABIC', 'CALLIGRAPHY', 'HOMEMAKING'],
    about: 'Qurʼonni toʻliq yod olganman, alhamdulillah. Qizlarga tajvid darsi beraman. Atlas toʻqish oilamizning hunari, men ham bilaman.',
    spouse: 'Qurʼon ahli yoki Qurʼonni sevadigan, odobli va ilmli inson.',
    beliefs: 'Ahli sunna val-jamoa aqidasidaman, hanafiy mazhabidaman. Ustozlarimdan ijozat olganman.',
    witnesses: [{ name: 'Oydin', relation: 'MOTHER' }],
  },
];

const men: Person[] = [
  {
    email: 'jasur.abdullayev',
    name: 'Jasur',
    birth: '1994-07-15',
    country: 'UZ',
    city: 'Toshkent',
    nationality: 'UZBEK',
    languages: ['uz', 'ru', 'en'],
    height: 180,
    weight: 78,
    marital: 'NEVER_MARRIED',
    relocate: false,
    interests: ['TECHNOLOGY', 'SPORTS', 'QURAN'],
    about: 'Bankda tahlilchi boʻlib ishlayman. Har kuni bomdodni masjidda oʻqishga harakat qilaman. Futbol oʻynayman, kitob oʻqiyman.',
    spouse: 'Namozxon, hayoli, oilani birga quradigan, ota-onamni hurmat qiladigan qiz.',
    beliefs: 'Ahli sunna val-jamoa aqidasidaman, hanafiy mazhabiga amal qilaman.',
  },
  {
    email: 'ahmet.yildiz',
    name: 'Ahmet',
    birth: '1991-02-08',
    country: 'TR',
    city: 'Bursa',
    nationality: 'TURKISH',
    languages: ['tr', 'en', 'ar'],
    height: 176,
    weight: 80,
    marital: 'DIVORCED',
    nikahCount: 1,
    relocate: true,
    interests: ['BUSINESS', 'TRAVEL', 'ARCHERY'],
    tz: 'Europe/Istanbul',
    about: 'Tekstil işiyle uğraşıyorum, kendi atölyem var. Bir evlilik yaptım, çocuğum yok. Okçuluk sporuyla ilgileniyorum.',
    spouse: 'Dindar, güler yüzlü, aile kurmaya kararlı bir hanım. Özbekistan’dan da olabilir, taşınmaya açığım.',
    beliefs: 'Ehl-i sünnet, Hanefî.',
  },
];

const ALL_STEPS = ['basics', 'location', 'body', 'family', 'about', 'spouse', 'beliefs', 'screening', 'rules'];

async function main() {
  const emails = [...women, ...men].map((p) => p.email + DOMAIN);

  if (process.argv.includes('--remove')) {
    const { count } = await prisma.user.deleteMany({ where: { email: { in: emails }, isSandbox: true } });
    console.log(`${count} deneme hesabı silindi.`);
    return;
  }

  const passwordHash = await hashPassword(PASSWORD);
  let created = 0;
  for (const [list, gender] of [
    [women, 'FEMALE'],
    [men, 'MALE'],
  ] as const) {
    for (const [i, p] of list.entries()) {
      const email = p.email + DOMAIN;
      if (await prisma.user.findUnique({ where: { email } })) continue;
      const isF = gender === 'FEMALE';
      // Onay zamanları dağınık olsun (akış sırası doğal görünsün).
      const approvedAt = new Date(Date.now() - (i * 7 + 3) * 3600_000);
      const user = await prisma.user.create({
        data: {
          email,
          emailVerifiedAt: approvedAt,
          passwordHash,
          gender,
          isSandbox: true,
          status: 'APPROVED',
          consents,
          connectBalance: isF ? 0 : 5,
          locale: p.country === 'TR' ? 'tr' : p.country === 'UZ' ? 'uz' : 'ru',
          timezone: p.tz ?? 'Asia/Tashkent',
          profile: {
            create: {
              displayName: p.name,
              birthDate: new Date(p.birth + 'T00:00:00Z'),
              country: p.country,
              city: p.city,
              nationality: p.nationality,
              languages: p.languages,
              willingToRelocate: p.relocate ?? false,
              heightCm: p.height,
              weightKg: p.weight,
              maritalStatus: p.marital,
              nikahCount: p.nikahCount ?? 0,
              childrenCount: p.children ?? 0,
              childrenLivingWith: p.childrenWith ?? 0,
              polygamyAnswer: isF ? (p.polygamy ?? 'NO') : null,
              aboutMe: p.about,
              aboutSpouse: p.spouse,
              beliefsManhaj: p.beliefs,
              interests: p.interests,
              acceptedRulesAt: approvedAt,
              completedSteps: ALL_STEPS,
              moderationStatus: 'APPROVED',
              submittedAt: approvedAt,
              approvedAt,
            },
          },
        },
      });
      if (p.witnesses?.length) await prisma.witness.createMany({ data: p.witnesses.map((w) => ({ ...w, femaleId: user.id })) });
      created++;
    }
  }
  console.log(`${created} deneme hesabı oluşturuldu (toplam ${emails.length}).`);
  console.table([...women, ...men].map((p) => ({ email: p.email + DOMAIN, ad: p.name, sehir: p.city })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
