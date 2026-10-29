import './load-env';
import { z } from 'zod';
import { productionProblems } from './production-checks';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:3737'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3737'),
  /** Express "trust proxy": loopback (yerel proxy), sayı (bilinen hop sayısı) ya da IP listesi. */
  TRUST_PROXY: z.string().default('loopback'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must be 32 bytes, base64'),

  // Depolama: geliştirmede yerel disk, üretimde özel (private) S3 uyumlu bucket (R2/S3).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().default('./storage'),
  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),

  // E-posta: geliştirmede konsola yazılır, üretimde Resend.
  MAIL_DRIVER: z.enum(['log', 'resend']).default('log'),
  MAIL_FROM: z.string().optional().default('Hitaba <no-reply@localhost>'),
  RESEND_API_KEY: z.string().optional().default(''),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(''),
  DEV_PAYMENTS: bool,
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const problems = productionProblems(parsed.data);
if (problems.length) {
  console.error('Refusing to start in production:\n - ' + problems.join('\n - '));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
