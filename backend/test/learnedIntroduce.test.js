/**
 * Learn-on-success SRS introduce (pure).
 * Run: node --test --test-force-exit test/learnedIntroduce.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNED_INTRODUCE_BOX,
  immersionListenSeedArgs,
  learnedIntroducePlan,
  uniqueKey,
  siblingCreditPlan,
} from '../src/services/mistakeBankService.js';

describe('learnedIntroducePlan', () => {
  it('box=1 · 24h · wrong_count 0', () => {
    const plan = learnedIntroducePlan({ source: 'reading', prompt: 'Cloze?' });
    assert.equal(LEARNED_INTRODUCE_BOX, 1);
    assert.equal(plan.box, 1);
    assert.equal(plan.dueHours, 24);
    assert.equal(plan.wrongCount, 0);
    assert.equal(plan.correctStreak, 1);
    assert.equal(plan.resolved, 0);
    assert.equal(plan.source, 'reading');
    assert.equal(plan.prompt, 'Cloze?');
  });

  it('source normalize', () => {
    assert.equal(learnedIntroducePlan({ source: ' Dict_Game ' }).source, 'dict_game');
  });

  it('immersion source', () => {
    assert.equal(learnedIntroducePlan({ source: 'immersion' }).source, 'immersion');
    assert.equal(learnedIntroducePlan({ source: 'immersion' }).box, 1);
  });
});

describe('immersionListenSeedArgs', () => {
  it('titleId + prompt', () => {
    const args = immersionListenSeedArgs({ dictTitleId: 't1', prompt: 'Mektep' });
    assert.deepEqual(args, {
      dictTitleId: 't1',
      source: 'immersion',
      prompt: 'Mektep',
    });
    assert.equal(
      uniqueKey({
        actorId: 9,
        source: args.source,
        questionId: null,
        dictTitleId: args.dictTitleId,
      }),
      '9|immersion||t1'
    );
  });

  it('bos title — null', () => {
    assert.equal(immersionListenSeedArgs({ dictTitleId: '' }), null);
    assert.equal(immersionListenSeedArgs({}), null);
  });
});

describe('introduce uniqueKey fidelity', () => {
  it('dict-only reading key', () => {
    assert.equal(
      uniqueKey({
        actorId: 3,
        source: 'reading',
        questionId: null,
        dictTitleId: 't9',
      }),
      '3|reading||t9'
    );
  });

  it('quiz questionId key — sibling exclude same', () => {
    const args = {
      actorId: 1,
      source: 'quiz',
      questionId: 42,
      dictTitleId: 't1',
      correct: true,
    };
    const plan = siblingCreditPlan(args);
    assert.equal(plan.excludeKey, uniqueKey(args));
    assert.equal(plan.dictTitleId, 't1');
  });
});
