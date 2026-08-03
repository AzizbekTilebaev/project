/**
 * Immersion same-session listen → produce grading.
 * Run: node --test --test-force-exit test/immersionProduce.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gradeImmersionProduce } from '../src/services/immersionService.js';

describe('gradeImmersionProduce', () => {
  it('exact / fold', () => {
    assert.deepEqual(gradeImmersionProduce({ lemma: 'Mektep', answer: 'MEKTEP' }), {
      correct: true,
      nearMiss: false,
    });
    assert.equal(gradeImmersionProduce({ lemma: 'mektep', answer: 'mektep' }).correct, true);
  });

  it('soft nearMiss (len≥4)', () => {
    const g = gradeImmersionProduce({ lemma: 'mektep', answer: 'mekteb' });
    assert.equal(g.correct, true);
    assert.equal(g.nearMiss, true);
  });

  it('qáte / bos', () => {
    assert.equal(gradeImmersionProduce({ lemma: 'kitap', answer: 'mektep' }).correct, false);
    assert.equal(gradeImmersionProduce({ lemma: 'kitap', answer: '' }).correct, false);
    assert.equal(gradeImmersionProduce({ lemma: '', answer: 'x' }).correct, false);
  });
});
