import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Ortam dosyalarını yükler (ilk bulunan değer kazanır; gerçek ortam değişkenleri her zaman önce gelir):
 *   1. <repo>/.env.local — `neon deploy` / `neon checkout` / `neon env pull` tarafından yazılır:
 *      DATABASE_URL (havuzlu), DATABASE_URL_UNPOOLED (doğrudan), NEON_BRANCH
 *   2. apps/api/.env      — uygulamanın kendi ayarları (anahtarlar, depolama, e-posta…)
 * Üretimde dosya yoktur; değişkenler platform tarafından enjekte edilir.
 */
const repoRoot = resolve(__dirname, '../../../..');
const files = [resolve(repoRoot, '.env.local'), resolve(__dirname, '../../.env')].filter((f) => existsSync(f));
if (files.length) config({ path: files, quiet: true });
