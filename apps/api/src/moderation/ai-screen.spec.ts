import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeText } from './ai-screen.service';

test('filler text is not accepted as a profile description', () => {
  for (const s of [null, '', '....................', 'a b c d e f g h i j k', 'Mmmmmmmmmmmmmmmmmmmmm', 'Jdjdl djdksl dkdldldm dkdl', 'Lorem ipsum. Lorem ipsum. Lorem ipsum.', 'salom salom salom salom', '12345678901234567890']) {
    assert.equal(looksLikeText(s), false, String(s));
  }
});

test('real text in every app language is accepted, even when short', () => {
  for (const s of ['Quvnoq hazilkashman.', 'Oʻzbekistonda tugʻilganman, ota-onam bilan yashayman', 'Программист из Ташкента, семейный человек.', 'İstanbul’da öğretmenim, sakin biriyim.', 'I am a calm family man from London.', 'أبحث عن زوجة صالحة ملتزمة بالدين', 'Muslimah, beautiful']) {
    assert.equal(looksLikeText(s), true, s);
  }
});
