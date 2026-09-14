import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAnswer,
  evaluateAnswer,
  calculateXp,
  buildQuestions,
  updateDirectionStats,
} from '../js/learning.js';

const items = [
  { id: 'v1', french: 'la maison', german: 'das Haus', example: 'Voici la maison.', stats: {} },
  { id: 'v2', french: 'le livre', german: 'das Buch', example: 'Je lis un livre.', stats: {} },
  { id: 'v3', french: 'apprendre', german: 'lernen', example: "J'aime apprendre.", stats: {} },
  { id: 'v4', french: 'rapide', german: 'schnell', example: 'Il est rapide.', stats: {} },
];

test('normalizeAnswer ignores case, punctuation and repeated spaces', () => {
  assert.equal(normalizeAnswer('  Das   Haus! '), 'das haus');
});

test('evaluateAnswer distinguishes exact, accent hint and incorrect answers', () => {
  assert.deepEqual(evaluateAnswer('école', 'école'), { correct: true, close: false });
  assert.deepEqual(evaluateAnswer('ecole', 'école'), { correct: false, close: true });
  assert.deepEqual(evaluateAnswer('livre', 'école'), { correct: false, close: false });
});

test('calculateXp awards points once for a completed answer', () => {
  assert.equal(calculateXp({ correct: true, awarded: false, streak: 4 }), 12);
  assert.equal(calculateXp({ correct: false, awarded: false, streak: 4 }), 2);
  assert.equal(calculateXp({ correct: true, awarded: true, streak: 4 }), 0);
});

test('buildQuestions creates both translation directions', () => {
  const fr = buildQuestions(items, 'fr-de', 'write', 3);
  const de = buildQuestions(items, 'de-fr', 'write', 3);
  assert.equal(fr.length, 3);
  assert.equal(fr[0].prompt, items.find((item) => item.id === fr[0].itemId).french);
  assert.equal(de[0].prompt, items.find((item) => item.id === de[0].itemId).german);
});

test('multiple choice questions have unique options including the answer', () => {
  const [question] = buildQuestions(items, 'fr-de', 'choice', 1);
  assert.equal(new Set(question.options).size, question.options.length);
  assert.ok(question.options.includes(question.answer));
});

test('updateDirectionStats keeps direction results separate', () => {
  const updated = updateDirectionStats(items[0], 'fr-de', false, '2026-09-14T10:00:00.000Z');
  assert.equal(updated.stats['fr-de'].wrong, 1);
  assert.equal(updated.stats['fr-de'].correct, 0);
  assert.equal(updated.stats['de-fr'], undefined);
  assert.equal(updated.difficulty, 2);
});
