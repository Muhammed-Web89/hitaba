import type { Prisma, User } from '@prisma/client';

type Side = Pick<User, 'isSandbox' | 'sandboxTester'>;

/**
 * Deneme hesapları gerçek kullanıcılardan ayrıdır. İstisna: yöneticinin "deneme profillerini görebilir"
 * yetkisi verdiği hesap (sandboxTester) iki tarafı da görür ve deneme hesapları onu görür.
 */
export function canMeet(viewer: Side, target: Side): boolean {
  return viewer.isSandbox === target.isSandbox || viewer.sandboxTester || (viewer.isSandbox && target.sandboxTester);
}

/** Aynı kuralın sorgu karşılığı (akış adayları). */
export function meetableWhere(viewer: Side): Prisma.UserWhereInput {
  if (viewer.sandboxTester) return {};
  return viewer.isSandbox ? { OR: [{ isSandbox: true }, { sandboxTester: true }] } : { isSandbox: false };
}
