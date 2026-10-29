import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productionProblems, type ProductionEnv } from './production-checks';

const good: ProductionEnv = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'aB3dE5gH7jK9mN1pQ3sT5vX7zA9cE1gI3kM5',
  JWT_REFRESH_SECRET: 'zY8xW6vU4tS2rQ0pO8nM6lK4jI2hG0fE8dC6',
  DEV_PAYMENTS: false,
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'hitaba-photos',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret-value',
  MAIL_DRIVER: 'resend',
  RESEND_API_KEY: 're_123',
  MAIL_FROM: 'Hitaba <no-reply@hitaba.app>',
  PUBLIC_WEB_URL: 'https://hitaba.app',
  WEB_ORIGIN: 'https://hitaba.app',
};

test('a complete production config passes', () => {
  assert.deepEqual(productionProblems(good), []);
});

test('development is never blocked', () => {
  assert.deepEqual(productionProblems({ ...good, NODE_ENV: 'development', STORAGE_DRIVER: 'local', DEV_PAYMENTS: true }), []);
});

test('production rejects dev shortcuts', () => {
  const p = productionProblems({
    ...good,
    JWT_ACCESS_SECRET: 'change-me',
    DEV_PAYMENTS: true,
    STORAGE_DRIVER: 'local',
    MAIL_DRIVER: 'log',
    WEB_ORIGIN: 'http://localhost:3737',
  });
  assert.ok(p.some((x) => x.includes('JWT_ACCESS_SECRET')));
  assert.ok(p.some((x) => x.includes('DEV_PAYMENTS')));
  assert.ok(p.some((x) => x.includes('STORAGE_DRIVER')));
  assert.ok(p.some((x) => x.includes('MAIL_DRIVER')));
  assert.ok(p.some((x) => x.includes('WEB_ORIGIN')));
});
