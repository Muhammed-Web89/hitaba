#!/usr/bin/env bash
# Hitaba'yı bu bilgisayardan geçici, herkese açık bir https adresiyle paylaşır (Cloudflare quick tunnel).
# Hesap gerekmez; adres her çalıştırmada değişir ve yalnızca bu betik açıkken çalışır.
# Kullanım: npm run share
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:shared >/dev/null
(cd apps/api && npm run build >/dev/null)
# Tarayıcı API'ye aynı adresin /api yolu üzerinden ulaşır (apps/web/next.config.ts rewrites).
export NEXT_DIST_DIR=.next-share
(cd apps/web && NEXT_PUBLIC_API_URL=/api npx next build >/dev/null)

trap 'kill 0' EXIT
npm run db >/dev/null 2>&1 &
sleep 3
(cd apps/api && node dist/main.js) &
(cd apps/web && npx next start -p 3737) &
sleep 5
# QUIC bazı ağlarda kopuyor; HTTP/2 daha kararlı.
npx --yes cloudflared@0.7.1 tunnel --no-autoupdate --protocol http2 --url http://localhost:3737
