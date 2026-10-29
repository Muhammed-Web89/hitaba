// Prisma CLI'yi uygulamayla aynı ortam dosyalarıyla çalıştırır (bkz. src/config/load-env.ts):
// önce <repo>/.env.local (Neon), sonra apps/api/.env. Gerçek ortam değişkenleri her zaman önce gelir.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const f of [resolve(here, '../../../.env.local'), resolve(here, '../.env')]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
// Prisma şema motoru Neon'un channel_binding=require parametresini desteklemiyor (bağlantı "P1001"
// ile düşer). Yalnızca CLI (migration) bağlantısı için kaldırılır; TLS (sslmode=require) açık kalır.
// Uygulama çalışma zamanı node-postgres adaptörüyle kanal bağlamayı kullanır (src/prisma/client.ts).
for (const key of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
  if (!process.env[key]) continue;
  const url = new URL(process.env[key]);
  url.searchParams.delete('channel_binding');
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
  process.env[key] = url.toString();
}
const prisma = createRequire(import.meta.url).resolve('prisma/build/index.js');
const r = spawnSync(process.execPath, [prisma, ...process.argv.slice(2)], { stdio: 'inherit', cwd: resolve(here, '..') });
process.exit(r.status ?? 1);
