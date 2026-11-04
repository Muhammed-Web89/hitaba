/**
 * Telefonunu kaybeden personelin iki adımlı doğrulamasını kapatır ve tüm oturumlarını sonlandırır.
 *   ADMIN_EMAIL=... npm run reset-2fa
 * Sonra kişi yalnızca şifresiyle girer ve profil sayfasından yeniden kurar.
 */
import '../src/config/load-env';
import { createPrismaClient } from '../src/prisma/client';

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
if (!email) {
  console.error('ADMIN_EMAIL is required');
  process.exit(1);
}

async function main() {
  const prisma = createPrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role === 'USER') throw new Error(`no staff account: ${email}`);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null, tokenVersion: { increment: 1 } },
      }),
      prisma.staffSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({ data: { action: 'staff.2fa_reset', targetType: 'USER', targetId: user.id } }),
    ]);
    console.log(`2FA reset: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
