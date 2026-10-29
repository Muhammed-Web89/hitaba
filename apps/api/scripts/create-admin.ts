/**
 * Üretimde ilk yönetici/moderatör hesabını oluşturur (demo seed yerine).
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_GENDER=MALE|FEMALE [ADMIN_ROLE=ADMIN|MODERATOR] npm run create-admin
 * Şifre en az 14 karakter olmalı; komut bittiğinde ortam değişkenini kabuk geçmişinden temizleyin.
 */
import 'dotenv/config';
import { PrismaClient, type Gender, type Role } from '@prisma/client';
import { hashPassword } from '../src/common/crypto';
import { DEMO_EMAIL_DOMAIN } from '../src/config/production-checks';

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
const gender = process.env.ADMIN_GENDER as Gender;
const role = (process.env.ADMIN_ROLE ?? 'ADMIN') as Role;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('ADMIN_EMAIL is required');
if (email.endsWith(DEMO_EMAIL_DOMAIN)) fail(`${DEMO_EMAIL_DOMAIN} is reserved for demo data`);
if (password.length < 14) fail('ADMIN_PASSWORD must be at least 14 characters');
if (gender !== 'MALE' && gender !== 'FEMALE') fail('ADMIN_GENDER must be MALE or FEMALE (moderation is gender-segregated)');
if (role !== 'ADMIN' && role !== 'MODERATOR') fail('ADMIN_ROLE must be ADMIN or MODERATOR');

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await hashPassword(password);
  try {
    const u = await prisma.user.upsert({
      where: { email },
      // Var olan hesapta şifre yenilenir ve tüm oturumları kapatılır.
      update: { role, passwordHash, tokenVersion: { increment: 1 } },
      create: {
        email,
        emailVerifiedAt: new Date(),
        passwordHash,
        gender,
        role,
        status: 'APPROVED',
        profile: { create: { displayName: role === 'ADMIN' ? 'Admin' : 'Moderator', moderationStatus: 'APPROVED' } },
      },
    });
    console.log(`${u.role} ready: ${u.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
