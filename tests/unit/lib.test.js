import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlocked, validateQuestions, score, rankBoard, verdict, clean } from '../../functions/_lib.js';
import { PACKS } from '../../public/bank.js';

test('filter blocks slurs and spaced or leet variants, allows harmless words', () => {
  for (const bad of ['fuck', 'F u c k', 'sh1t', 'b.i.t.c.h', 'Fuuuck', 'kill yourself']) assert.equal(isBlocked(bad), true, bad);
  for (const ok of ['Pizza', 'Sussex', 'Pakistan trip', 'cockroach', 'Scunthorpe', 'this hit', 'My stupid fear', 'Indie music']) assert.equal(isBlocked(ok), false, ok);
  assert.equal(isBlocked('Loser', true), true);
  assert.equal(isBlocked('Loser'), false);
});

test('question validation', () => {
  const q = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ q: `Question ${i}?`, a: ['A', 'B', 'C', 'D'], c: i % 4, ...extra }));
  assert.equal(validateQuestions(q(10)).questions.length, 10);
  assert.match(validateQuestions(q(4)).error, /at least 5/);
  assert.match(validateQuestions(q(16)).error, /At most 15/);
  assert.match(validateQuestions(q(5, { c: null })).error, /Pick your answer/);
  assert.match(validateQuestions(q(5, { a: ['x', 'X'] })).error, /same answer twice/);
  assert.match(validateQuestions(q(5, { q: 'Is my friend a bitch?' })).error, /don't allow/);
  assert.equal(clean('  a‮  b\n', 10), 'a b');
});

test('scoring, ranking with ties, verdicts', () => {
  const qs = [{ c: 0 }, { c: 1 }, { c: 2 }];
  assert.equal(score(qs, [0, 1, 0]), 2);
  const ranked = rankBoard([
    { id: 'a', score: 5, done_at: 3 },
    { id: 'b', score: 7, done_at: 9 },
    { id: 'c', score: 5, done_at: 1 },
    { id: 'd', score: 2, done_at: 1 },
  ]);
  assert.deepEqual(ranked.map((r) => `${r.id}${r.rank}`), ['b1', 'c2', 'a2', 'd4']);
  assert.match(verdict(10, 10), /Soulmate/);
  assert.match(verdict(0, 10), /stranger/);
});

test('question bank: 5 packs x 30, every question passes server validation and the filter', () => {
  assert.equal(PACKS.length, 5);
  for (const p of PACKS) {
    assert.equal(p.questions.length, 30, p.id);
    for (let i = 0; i < 30; i += 10) {
      const v = validateQuestions(p.questions.slice(i, i + 10).map((x) => ({ ...x, c: 0 })));
      assert.ok(v.questions, `${p.id}: ${v.error}`);
    }
  }
});
