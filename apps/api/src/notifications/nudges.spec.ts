import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localHour } from '../common/time';
import { nudgeText } from './nudges';

test('nudge messages rotate daily and fall back to English', () => {
  assert.notEqual(nudgeText('MALE', 'uz', 0), nudgeText('MALE', 'uz', 1));
  assert.equal(nudgeText('FEMALE', 'ru', 0), nudgeText('FEMALE', 'ru', 4));
  assert.equal(nudgeText('STARTER', 'de', 0), nudgeText('STARTER', 'en', 0));
  for (const kind of ['MALE', 'FEMALE', 'STARTER'] as const) {
    for (const l of ['uz', 'ru', 'tr', 'en', 'ar']) assert.ok(nudgeText(kind, l, 0).length > 40, `${kind} ${l}`);
  }
});

test('local hour follows the user time zone', () => {
  const now = new Date('2026-11-11T13:30:00Z');
  assert.equal(localHour('Asia/Tashkent', now), 18);
  assert.equal(localHour('Europe/Istanbul', now), 16);
});
