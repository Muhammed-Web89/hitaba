/** Ortamdan bağımsız: env.ts'yi yüklemeden test edilebilir. */
export interface ProductionEnv {
  NODE_ENV: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  DEV_PAYMENTS: boolean;
  STORAGE_DRIVER: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  MAIL_DRIVER: string;
  RESEND_API_KEY: string;
  MAIL_FROM: string;
  PUBLIC_WEB_URL: string;
  WEB_ORIGIN: string;
}

/** Demo/seed hesaplarının alan adı — üretim veritabanında bulunmamalı. */
export const DEMO_EMAIL_DOMAIN = '@hitaba.dev';

/**
 * Üretimde güvensiz yapılandırmayla açılmayı reddeder. Hepsi bir arada raporlanır.
 * Ayrı fonksiyon: birim testlerinde doğrudan çağrılır.
 */
export function productionProblems(e: ProductionEnv): string[] {
  if (e.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  const weak = (v: string) => v.length < 32 || /change-me|secret|password/i.test(v);
  if (weak(e.JWT_ACCESS_SECRET)) problems.push('JWT_ACCESS_SECRET must be ≥32 random chars');
  if (weak(e.JWT_REFRESH_SECRET)) problems.push('JWT_REFRESH_SECRET must be ≥32 random chars');
  if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) problems.push('JWT secrets must differ');
  if (e.DEV_PAYMENTS) problems.push('DEV_PAYMENTS must not be enabled');
  if (e.STORAGE_DRIVER !== 's3') problems.push('STORAGE_DRIVER must be s3 (photos need private object storage)');
  if (e.STORAGE_DRIVER === 's3' && (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY)) {
    problems.push('S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are required');
  }
  if (e.MAIL_DRIVER !== 'resend' || !e.RESEND_API_KEY) problems.push('MAIL_DRIVER=resend and RESEND_API_KEY are required');
  if (/localhost/.test(e.MAIL_FROM)) problems.push('MAIL_FROM must use a real sending domain');
  if (!e.PUBLIC_WEB_URL.startsWith('https://')) problems.push('PUBLIC_WEB_URL must be https');
  if (e.WEB_ORIGIN.split(',').some((o) => !o.startsWith('https://'))) problems.push('WEB_ORIGIN must be https only');
  return problems;
}
