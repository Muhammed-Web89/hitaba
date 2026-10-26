import type { Me } from '@hitaba/shared';

/** Oturum açan kullanıcının durumuna göre gideceği ilk sayfa. */
export function homeFor(me: Me): string {
  if (me.role !== 'USER') return '/admin';
  if (me.status === 'ONBOARDING' || me.status === 'REJECTED') return '/onboarding';
  if (me.status === 'APPROVED') return '/app/feed';
  return '/app';
}
