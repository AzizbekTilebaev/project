/**
 * Frontend soft produce / immersion local grade.
 * Run: node --test --test-force-exit src/lib/produceGrade.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import searchFold from './searchFold.js';
import {
  buildProduceAccepted,
  gradeImmersionProduceLocal,
  gradeProduceSubmission,
  produceSoftMaxDistance,
} from './produceGrade.js';

describe('searchFold parity', () => {
  it('latin / cyr → bir fold', () => {
    const a = searchFold('Mektep');
    const b = searchFold('МЕКТЕП');
    assert.ok(a);
    assert.equal(a, b);
  });
});

describe('gradeProduceSubmission', () => {
  it('exact fold', () => {
    assert.deepEqual(gradeProduceSubmission(['mektep'], 'MEKTEP'), {
      correct: true,
      nearMiss: false,
    });
  });

  it('soft nearMiss (len≥4)', () => {
    const g = gradeProduceSubmission(['mektep'], 'mekteb');
    assert.equal(g.correct, true);
    assert.equal(g.nearMiss, true);
  });

  it('qısqa — typo qabıl etilmeydi', () => {
    assert.equal(produceSoftMaxDistance(3), 0);
    assert.deepEqual(gradeProduceSubmission(['ash'], 'ahs'), {
      correct: false,
      nearMiss: false,
    });
  });
});

describe('gradeImmersionProduceLocal', () => {
  it('lemma + fold accept', () => {
    const accepted = buildProduceAccepted('Mektep');
    assert.ok(accepted.length >= 1);
    assert.equal(
      gradeImmersionProduceLocal({ lemma: 'Mektep', answer: 'mektep' }).correct,
      true
    );
    assert.equal(
      gradeImmersionProduceLocal({ lemma: 'Mektep', answer: 'МЕКТЕП' }).correct,
      true
    );
  });

  it('soft nearMiss', () => {
    const g = gradeImmersionProduceLocal({ lemma: 'mektep', answer: 'mekteb' });
    assert.equal(g.correct, true);
    assert.equal(g.nearMiss, true);
  });

  it('qáte / bos', () => {
    assert.equal(
      gradeImmersionProduceLocal({ lemma: 'kitap', answer: 'mektep' }).correct,
      false
    );
    assert.equal(gradeImmersionProduceLocal({ lemma: 'kitap', answer: '' }).correct, false);
    assert.equal(gradeImmersionProduceLocal({ lemma: '', answer: 'x' }).correct, false);
  });
});
