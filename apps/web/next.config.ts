import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Telegram web istemcisi Mini App'i iframe içinde açar.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" },
];

/** Tarayıcı API'ye aynı origin üzerinden `/api` ile de ulaşabilir (tek adresli yayın, tünel). */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // socket.io yolu sonda "/" ister; Next bunu yönlendirmemeli.
  skipTrailingSlashRedirect: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: '/api/socket.io/', destination: `${API_INTERNAL_URL}/socket.io/` },
      { source: '/api/:path*', destination: `${API_INTERNAL_URL}/:path*` },
    ];
  },
};

export default withNextIntl(config);
