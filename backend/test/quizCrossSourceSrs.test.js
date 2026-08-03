/**
 * Quiz/adaptive/tutor → sibling SRS by dictTitleId.
 * Run: node --test --test-force-exit test/quizCrossSourceSrs.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  uniqueKey,
  siblingCreditPlan,
} from '../src/services/mistakeBankService.js';

describe('siblingCreditPlan', () => {
  it('quiz correct — excludeKey = quiz question key, title bar', () => {
    const plan = siblingCreditPlan({
      actorId: 7,
      source: 'quiz',
      questionId: 99,
      dictTitleId: 't1',
      correct: true,
      prompt: 'Soraw?',
    });
    assert.deepEqual(plan, {
      dictTitleId: 't1',
      correct: true,
      prompt: 'Soraw?',
      excludeKey: uniqueKey({
        actorId: 7,
        source: 'quiz',
        questionId: 99,
        dictTitleId: 't1',
      }),
    });
    assert.equal(plan.excludeKey, '7|quiz|99|');
  });

  it('adaptive wrong — excludeKey adaptive, correct false', () => {
    const plan = siblingCreditPlan({
      actorId: 3,
      source: 'adaptive',
      questionId: 12,
      dictTitleId: 'word-a',
      correct: false,
      prompt: 'X?',
    });
    assert.equal(plan.correct, false);
    assert.equal(plan.excludeKey, '3|adaptive|12|');
    assert.equal(plan.dictTitleId, 'word-a');
  });

  it('dictTitleId joq — null (sibling shaqırılmaydı)', () => {
    assert.equal(
      siblingCreditPlan({
        actorId: 1,
        source: 'quiz',
        questionId: 1,
        dictTitleId: null,
        correct: true,
      }),
      null
    );
    assert.equal(
      siblingCreditPlan({
        actorId: 1,
        source: 'quiz',
        questionId: 1,
        dictTitleId: '  ',
        correct: false,
      }),
      null
    );
  });

  it('tutor dict-only — excludeKey source||title (questionId siz)', () => {
    const plan = siblingCreditPlan({
      actorId: 5,
      source: 'reading',
      questionId: null,
      dictTitleId: 'read-1',
      correct: true,
    });
    assert.equal(plan.excludeKey, '5|reading||read-1');
    assert.notEqual(
      plan.excludeKey,
      uniqueKey({ actorId: 5, source: 'quiz', questionId: 1, dictTitleId: 'read-1' })
    );
  });
});

describe('excludeKey vs sibling double-penalty', () => {
  it('primary quiz key siblingdan shıǵarıw — bir qatar eki marta jılanbaydı', () => {
    const primary = uniqueKey({
      actorId: 1,
      source: 'quiz',
      questionId: 42,
      dictTitleId: 't1',
    });
    const plan = siblingCreditPlan({
      actorId: 1,
      source: 'quiz',
      questionId: 42,
      dictTitleId: 't1',
      correct: false,
    });
    assert.equal(plan.excludeKey, primary);
    // Crossword/dict sibling keys áyne primary emes
    assert.notEqual(
      primary,
      uniqueKey({ actorId: 1, source: 'crossword', dictTitleId: 't1' })
    );
    assert.notEqual(
      primary,
      uniqueKey({ actorId: 1, source: 'dict_game', dictTitleId: 't1' })
    );
  });
});
