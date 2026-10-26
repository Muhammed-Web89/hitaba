/**
 * Geliştirme verisi. Üretimde çalışmaz.
 * Tüm hesapların şifresi: hitaba123
 */
import { PrismaClient, type Gender, type Relation } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import 'dotenv/config';
import { encrypt, hashPassword, randomToken } from '../src/common/crypto';

if (process.env.NODE_ENV === 'production') {
  console.error('seed is disabled in production');
  process.exit(1);
}

const prisma = new PrismaClient();
const PASSWORD = 'hitaba123';
const storageRoot = resolve(process.env.STORAGE_DIR ?? './storage');

const ABOUT_M =
  'Assalomu alaykum. Toshkentda dasturchi bo‘lib ishlayman, namozlarimni vaqtida o‘qishga harakat qilaman. Oilani dinimiz asosida qurishni, ota-onamni hurmat qilishni muhim deb bilaman.';
const ABOUT_F =
  'Assalomu alaykum. Oilamda tarbiya olganman, hozir o‘qituvchi bo‘lib ishlayman. Uy-ro‘zg‘or ishlarini yaxshi ko‘raman, Qur’on o‘rganishni davom ettiryapman va solih oila qurishni niyat qilganman.';
const SPOUSE = 'Dinli, mas’uliyatli, oilaga sodiq va ota-onasini hurmat qiladigan, halol rizq topadigan inson.';
const BELIEFS = 'Ahli sunna val jamoa aqidasidaman, salafi solihlar yo‘lini tutishga harakat qilaman. Ulamolarni hurmat qilaman.';

const people: Array<{
  email: string;
  gender: Gender;
  name: string;
  birth: string;
  city: string;
  country: string;
  nationality: string;
  height: number;
  weight: number;
  photo?: string;
  connects?: number;
}> = [
  { email: 'ali@hitaba.dev', gender: 'MALE', name: 'Ali', birth: '1996-03-14', city: 'Toshkent', country: 'UZ', nationality: 'O‘zbek', height: 178, weight: 75, photo: '#2F8F5B', connects: 3 },
  { email: 'umar@hitaba.dev', gender: 'MALE', name: 'Umar', birth: '1992-08-02', city: 'Samarqand', country: 'UZ', nationality: 'O‘zbek', height: 182, weight: 82, photo: '#3B6E91' },
  { email: 'yusuf@hitaba.dev', gender: 'MALE', name: 'Yusuf', birth: '1999-11-20', city: 'İstanbul', country: 'TR', nationality: 'Türk', height: 174, weight: 70 },
  { email: 'aisha@hitaba.dev', gender: 'FEMALE', name: 'Oysha', birth: '1999-05-09', city: 'Toshkent', country: 'UZ', nationality: 'O‘zbek', height: 163, weight: 54, photo: '#C79A4B' },
  { email: 'maryam@hitaba.dev', gender: 'FEMALE', name: 'Maryam', birth: '1997-01-27', city: 'Buxoro', country: 'UZ', nationality: 'O‘zbek', height: 160, weight: 52, photo: '#B6412E' },
  { email: 'fatima@hitaba.dev', gender: 'FEMALE', name: 'Fotima', birth: '2001-09-15', city: 'Namangan', country: 'UZ', nationality: 'O‘zbek', height: 158, weight: 50 },
];

async function placeholderPhoto(userId: string, color: string, label: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <rect width="100%" height="100%" fill="${color}"/>
    <circle cx="450" cy="470" r="190" fill="#ffffff" fill-opacity="0.25"/>
    <rect x="200" y="700" width="500" height="420" rx="220" fill="#ffffff" fill-opacity="0.25"/>
    <text x="450" y="1160" font-family="sans-serif" font-size="56" fill="#fff" text-anchor="middle">${label}</text>
  </svg>`;
  const key = `photos/${userId}/${randomToken(18)}.jpg`;
  const path = join(storageRoot, key);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer());
  return key;
}

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const staff = [
    { email: 'admin@hitaba.dev', gender: 'MALE' as const, role: 'ADMIN' as const, name: 'Admin' },
    { email: 'mod.m@hitaba.dev', gender: 'MALE' as const, role: 'MODERATOR' as const, name: 'Moderator (aka)' },
    { email: 'mod.f@hitaba.dev', gender: 'FEMALE' as const, role: 'MODERATOR' as const, name: 'Moderator (opa)' },
  ];
  for (const s of staff) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash,
        gender: s.gender,
        role: s.role,
        status: 'APPROVED',
        profile: { create: { displayName: s.name, moderationStatus: 'APPROVED' } },
      },
    });
  }

  for (const p of people) {
    if (await prisma.user.findUnique({ where: { email: p.email } })) continue;
    const isF = p.gender === 'FEMALE';
    const user = await prisma.user.create({
      data: {
        email: p.email,
        passwordHash,
        gender: p.gender,
        status: 'APPROVED',
        connectBalance: p.connects ?? 0,
        timezone: p.country === 'TR' ? 'Europe/Istanbul' : 'Asia/Tashkent',
        profile: {
          create: {
            displayName: p.name,
            birthDate: new Date(p.birth + 'T00:00:00Z'),
            country: p.country,
            city: p.city,
            nationality: p.nationality,
            languages: p.country === 'TR' ? ['tr', 'en'] : ['uz', 'ru'],
            willingToRelocate: !isF,
            heightCm: p.height,
            weightKg: p.weight,
            maritalStatus: 'NEVER_MARRIED',
            polygamyAnswer: isF ? 'NO' : null,
            aboutMe: isF ? ABOUT_F : ABOUT_M,
            aboutSpouse: SPOUSE,
            beliefsManhaj: BELIEFS,
            screeningEnc: encrypt(
              JSON.stringify({ prayer: 'ALWAYS', alcohol: false, drugs: false, relationsOutsideNikah: false, contagiousDisease: false, ...(isF && { hijab: 'HIJAB' }) }),
            ),
            acceptedRulesAt: new Date(),
            completedSteps: ['basics', 'location', 'body', 'family', 'about', 'spouse', 'beliefs', 'screening', 'rules'],
            showPhotoInFeed: !isF && Boolean(p.photo),
            moderationStatus: 'APPROVED',
            submittedAt: new Date(),
            approvedAt: new Date(),
          },
        },
      },
    });
    if (p.photo) {
      await prisma.photo.create({
        data: {
          userId: user.id,
          kind: 'MAIN',
          storageKey: await placeholderPhoto(user.id, p.photo, p.name),
          mime: 'image/jpeg',
          status: 'APPROVED',
          moderatedAt: new Date(),
        },
      });
    }
    if (isF) {
      const witnesses: Array<{ name: string; relation: Relation }> = [{ name: 'Zaynab', relation: 'SISTER' }];
      await prisma.witness.createMany({ data: witnesses.map((w) => ({ ...w, femaleId: user.id })) });
    }
  }

  console.log('\nSeed tamam. Tüm hesapların şifresi:', PASSWORD);
  console.table([...staff.map((s) => ({ email: s.email, role: s.role, gender: s.gender })), ...people.map((p) => ({ email: p.email, role: 'USER', gender: p.gender }))]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
