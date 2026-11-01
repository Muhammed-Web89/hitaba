import type { Me } from '@hitaba/shared/client';

/** Oturum açan kullanıcının durumuna göre gideceği ilk sayfa. */
export function homeFor(me: Me): string {
  if (me.role !== 'USER') return '/admin';
  if (me.status === 'ONBOARDING' || me.status === 'REJECTED') return '/onboarding';
  // İncelemedeki kullanıcı da profillere göz atabilir (salt okunur).
  if (me.status === 'APPROVED' || me.status === 'PENDING_MODERATION') return '/app/feed';
  return '/app';
}
