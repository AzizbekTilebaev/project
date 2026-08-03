/**
 * Crossword script-aware soft grading.
 * Run: node --test --test-force-exit test/crosswordGrade.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCrosswordAccepted,
} from '../src/services/crosswordService.js';
import { gradeProduceSubmission } from '../src/utils/produceGrade.js';
import { toCyrillic } from '../src/utils/qqScript.js';

describe('buildCrosswordAccepted', () => {
  it('latin/cyr fold — birdey qabıl', () => {
    const accepted = buildCrosswordAccepted('Mektep');
    assert.ok(accepted.length >= 1);
    assert.equal(gradeProduceSubmission(accepted, 'MEKTEP').correct, true);
    assert.equal(gradeProduceSubmission(accepted, 'mektep').correct, true);
    const cyr = toCyrillic('Mektep');
    assert.ok(cyr);
    assert.equal(gradeProduceSubmission(accepted, cyr).correct, true);
  });

  it('diakritika / soft nearMiss (len≥4)', () => {
    const accepted = buildCrosswordAccepted('Mektep');
    assert.equal(gradeProduceSubmission(accepted, 'Mekteb').correct, true);
    assert.equal(gradeProduceSubmission(accepted, 'Mekteb').nearMiss, true);
  });

  it('uzak juwap — qáte', () => {
    const accepted = buildCrosswordAccepted('Kitap');
    assert.equal(gradeProduceSubmission(accepted, 'mektep').correct, false);
  });

  it('bos — bos accepted', () => {
    assert.deepEqual(buildCrosswordAccepted(''), []);
    assert.deepEqual(buildCrosswordAccepted('   '), []);
  });
});
