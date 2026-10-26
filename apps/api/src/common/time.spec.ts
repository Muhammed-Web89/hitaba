import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageRange, startOfLocalDay } from './time';

test('local midnight in Tashkent (UTC+5)', () => {
  const now = new Date('2026-10-26T03:30:00Z'); // 08:30 Tashkent
  assert.equal(startOfLocalDay('Asia/Tashkent', now).toISOString(), '2026-10-25T19:00:00.000Z');
});

test('local midnight just after midnight UTC in Istanbul (UTC+3)', () => {
  const now = new Date('2026-10-26T22:10:00Z'); // 01:10 next day Istanbul
  assert.equal(startOfLocalDay('Europe/Istanbul', now).toISOString(), '2026-10-26T21:00:00.000Z');
});

test('invalid zone falls back to UTC', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  assert.equal(startOfLocalDay('Not/AZone', now).toISOString(), '2026-10-26T00:00:00.000Z');
});

test('age range buckets', () => {
  assert.equal(ageRange(18), '18–20');
  assert.equal(ageRange(28), '27–29');
});
