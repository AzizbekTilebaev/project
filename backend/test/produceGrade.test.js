/**
 * Soft near-miss produce grading.
 * Run: node --test --test-force-exit test/produceGrade.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maxEditDistance } from '../src/utils/editDistance.js';
import {
  gradeGlossProduceSubmission,
  gradeProduceSubmission,
  glossSoftMaxDistance,
  produceSoftMaxDistance,
} from '../src/utils/produceGrade.js';
import { gradeTutorProduceAnswer } from '../src/services/tutorService.js';
import { gradeReadingSubmission } from '../src/services/readingLessonEngine.js';

describe('produceSoftMaxDistance', () => {
  it('qısqa (<4) — exact only', () => {
    assert.equal(produceSoftMaxDistance(1), 0);
    assert.equal(produceSoftMaxDistance(3), 0);
  });

  it('uzın — ≤2 hám maxEditDistance', () => {
    assert.equal(produceSoftMaxDistance(4), Math.min(maxEditDistance(4), 2));
    assert.equal(produceSoftMaxDistance(8), Math.min(maxEditDistance(8), 2));
    assert.ok(produceSoftMaxDistance(12) <= 2);
  });
});

describe('gradeProduceSubmission', () => {
  it('exact fold', () => {
    const g = gradeProduceSubmission(['mektep'], 'MEKTEP');
    assert.deepEqual(g, { correct: true, nearMiss: false });
  });

  it('1-harf typo — nearMiss (len≥4)', () => {
    const g = gradeProduceSubmission(['mektep'], 'mekteb');
    assert.equal(g.correct, true);
    assert.equal(g.nearMiss, true);
  });

  it('qısqa sóz — typo qabıl etilmeydi', () => {
    const g = gradeProduceSubmission(['ash'], 'ahs');
    assert.deepEqual(g, { correct: false, nearMiss: false });
  });

  it('uzak / bos — qáte', () => {
    assert.equal(gradeProduceSubmission(['kitap'], 'mektep').correct, false);
    assert.equal(gradeProduceSubmission(['kitap'], '').correct, false);
  });
});

describe('glossSoftMaxDistance + gradeGloss', () => {
  it('uzun gloss — keńirek soft', () => {
    assert.equal(glossSoftMaxDistance(7), 0);
    assert.ok(glossSoftMaxDistance(12) <= 2);
    assert.ok(glossSoftMaxDistance(40) <= 4);
    assert.ok(glossSoftMaxDistance(40) >= glossSoftMaxDistance(12));
  });

  it('gradeGlossProduceSubmission nearMiss', () => {
    const def = 'Balalar bilim alatuǵın oqıw ornı.';
    const g = gradeGlossProduceSubmission([def], 'Balalar bilim alatuǵın oqıw orna.');
    assert.equal(g.correct, true);
    assert.equal(g.nearMiss, true);
  });
});

describe('wrappers', () => {
  it('gradeTutorProduceAnswer — nearMiss de correct', () => {
    assert.equal(gradeTutorProduceAnswer(['mektep'], 'mekteb'), true);
    assert.equal(gradeTutorProduceAnswer(['mektep'], 'xxxx'), false);
  });

  it('gradeReadingSubmission cloze nearMiss', () => {
    const q = {
      type: 'cloze',
      meta: { accepted: ['mektep', 'mektep'] },
    };
    const soft = gradeReadingSubmission(q, 'mekteb');
    assert.equal(soft.correct, true);
    assert.equal(soft.nearMiss, true);
    const exact = gradeReadingSubmission(q, 'mektep');
    assert.equal(exact.nearMiss, false);
  });
});
