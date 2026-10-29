import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { PoolConfig } from 'pg';

/**
 * Prisma'yı node-postgres sürücü adaptörüyle kurar (uzun ömürlü sunucu için Neon önerisi).
 * Prisma'nın yerleşik motoru Neon'un `channel_binding=require` parametresini desteklemiyor ve
 * macOS'ta sıkı sertifika doğrulaması yapamıyor; node-postgres ise:
 *  - sslmode=require'ı sertifika + host doğrulamalı TLS olarak uygular,
 *  - channel_binding=require ile SCRAM-SHA-256-PLUS kullanır (MITM'e karşı).
 * Bağlantı DATABASE_URL'den (Neon'da havuzlu "-pooler" adresi) gelir.
 */
export function poolConfig(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  const isLocal = ['127.0.0.1', 'localhost'].includes(url.hostname);
  const channelBinding = url.searchParams.get('channel_binding') === 'require';
  // Prisma motoruna özgü parametreler node-postgres'e gitmez.
  for (const p of ['pgbouncer', 'connection_limit', 'channel_binding', 'sslaccept', 'pool_timeout']) url.searchParams.delete(p);
  // pg 8 'require'ı zaten verify-full gibi uygular ama pg 9'da zayıflayacak; davranışı sabitle.
  if (['require', 'prefer', 'verify-ca'].includes(url.searchParams.get('sslmode') ?? '')) url.searchParams.set('sslmode', 'verify-full');
  return {
    connectionString: url.toString(),
    // Yerel PGlite tek oturumlu; Neon havuzlayıcısı arkasında 10 bağlantı tek API instance'ı için yeterli.
    max: isLocal ? 1 : Number(process.env.DATABASE_POOL_MAX ?? 10),
    enableChannelBinding: channelBinding,
    // Uyku modundaki Neon compute'unun uyanması birkaç saniye sürebilir.
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  };
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL ?? ''): PrismaClient {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  return new PrismaClient({ adapter: new PrismaPg(poolConfig(databaseUrl)) });
}
