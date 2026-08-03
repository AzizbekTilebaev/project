/**
 * Tutor → mistake_bank source fidelity.
 * Run: node --test --test-force-exit test/tutorMistakeBank.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mistakeBankTouchFromTutorItem } from '../src/services/tutorService.js';
import { uniqueKey } from '../src/services/mistakeBankService.js';

describe('mistakeBankTouchFromTutorItem', () => {
  it('quiz toǵrı juwap — asıl source=quiz menen recordCorrect', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'quiz',
        questionId: 99,
        dictTitleId: 't1',
        source: 'quiz',
        meta: { source: 'quiz' },
      },
      { correct: true }
    );
    assert.equal(touch.op, 'correct');
    assert.deepEqual(touch.args, {
      questionId: 99,
      dictTitleId: 't1',
      source: 'quiz',
    });
    assert.equal(
      uniqueKey({ actorId: 7, ...touch.args }),
      uniqueKey({ actorId: 7, questionId: 99, source: 'quiz', dictTitleId: 't1' })
    );
  });

  it('quiz qáte juwap — adaptive emes, asıl source saqlanadı', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'quiz',
        questionId: 12,
        source: 'quiz',
        prompt: 'Soraw?',
        meta: { source: 'quiz' },
      },
      { correct: false }
    );
    assert.equal(touch.op, 'upsert');
    assert.equal(touch.args.source, 'quiz');
    assert.notEqual(touch.args.source, 'adaptive');
    assert.equal(touch.args.prompt, 'Soraw?');
  });

  it('eski sessiya: meta.source fallback (item.source joq)', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'quiz',
        questionId: 5,
        meta: { source: 'adaptive' },
      },
      { correct: true }
    );
    assert.equal(touch.args.source, 'adaptive');
  });

  it('reading prompt — source=reading + dictTitleId', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'prompt',
        dictTitleId: 'read-1',
        source: 'reading',
      },
      { correct: true }
    );
    assert.equal(touch.op, 'correct');
    assert.deepEqual(touch.args, {
      questionId: null,
      dictTitleId: 'read-1',
      source: 'reading',
    });
    assert.equal(
      uniqueKey({ actorId: 1, ...touch.args }),
      '1|reading||read-1'
    );
  });

  it('dict_game default when source joq', () => {
    const touch = mistakeBankTouchFromTutorItem(
      { kind: 'prompt', dictTitleId: 'd1' },
      { correct: true }
    );
    assert.equal(touch.args.source, 'dict_game');
  });
});
