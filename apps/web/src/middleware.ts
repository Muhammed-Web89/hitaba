import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // /api → Nest API proxy'si (next.config rewrites); dil öneki eklenmez.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
