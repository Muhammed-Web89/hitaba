import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:3737'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3737'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must be 32 bytes, base64'),
  STORAGE_DIR: z.string().default('./storage'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(''),
  DEV_PAYMENTS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  // Üretimde ödeme simülasyonu asla açılmaz.
  DEV_PAYMENTS: parsed.data.DEV_PAYMENTS && parsed.data.NODE_ENV !== 'production',
};
export type Env = typeof env;
