/**
 * Reading lesson ↔ mistake_bank SRS fidelity (pure).
 * Run: node --test --test-force-exit test/readingSrsFidelity.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readingMistakeBankTouchFromAnswer,
  resolveDictTitleIdFromQuestion,
  buildPracticePayload,
} from '../src/services/readingService.js';

describe('readingMistakeBankTouchFromAnswer', () => {
  it('dictTitleId bar — touch (correct hám wrong)', () => {
    assert.deepEqual(
      readingMistakeBankTouchFromAnswer({
        correct: true,
        dictTitleId: 't1',
        prompt: 'Cloze?',
      }),
      {
        dictTitleId: 't1',
        correct: true,
        prompt: 'Cloze?',
        fallbackSource: 'reading',
      }
    );
    assert.deepEqual(
      readingMistakeBankTouchFromAnswer({
        correct: false,
        dictTitleId: 42,
        prompt: null,
      }),
      {
        dictTitleId: '42',
        correct: false,
        prompt: null,
        fallbackSource: 'reading',
      }
    );
  });

  it('bridge joq — null (touch shaqırılmaydı)', () => {
    assert.equal(readingMistakeBankTouchFromAnswer({ correct: false }), null);
    assert.equal(
      readingMistakeBankTouchFromAnswer({ correct: true, dictTitleId: '' }),
      null
    );
    assert.equal(
      readingMistakeBankTouchFromAnswer({ correct: false, dictTitleId: '  ' }),
      null
    );
  });
});

describe('resolveDictTitleIdFromQuestion', () => {
  it('meta.dictTitleId birinshi', () => {
    assert.equal(
      resolveDictTitleIdFromQuestion(
        { vocabulary: [{ id: 'v1', word: 'mektep' }] },
        { meta: { dictTitleId: 'meta-1', answer: 'mektep' } }
      ),
      'meta-1'
    );
  });

  it('fold match vocab answer', () => {
    assert.equal(
      resolveDictTitleIdFromQuestion(
        { vocabulary: [{ id: 'v2', word: 'MEKTEP' }] },
        { meta: { answer: 'mektep' } }
      ),
      'v2'
    );
  });
});

describe('buildPracticePayload — client queue only', () => {
  it('missedIds + titleIds; complete re-upsert emes (sof)', () => {
    const lesson = {
      vocabulary: [
        { id: 'a', word: 'alma' },
        { id: 'b', word: 'kitap' },
      ],
    };
    const questions = [
      { correct: false, meta: { dictTitleId: 'a' } },
      { correct: true, meta: { dictTitleId: 'b' } },
    ];
    const practice = buildPracticePayload(lesson, questions);
    assert.deepEqual(practice.missedIds, ['a']);
    assert.ok(practice.titleIds.includes('a'));
    assert.ok(practice.titleIds.includes('b'));
    // Complete must not second-penalize: callers use this payload for
    // local focused practice only — no upsertMistake loop.
    // Per-answer correct → introduceLearnedCard (server); complete ≠ touch.
    assert.equal(practice.vocabCount, 2);
  });

  it('durıs juwap touch — introduce yolu (fallbackSource reading)', () => {
    const touch = readingMistakeBankTouchFromAnswer({
      correct: true,
      dictTitleId: 'learned-1',
      prompt: 'Anıqlama…',
    });
    assert.equal(touch.correct, true);
    assert.equal(touch.fallbackSource, 'reading');
    assert.equal(touch.dictTitleId, 'learned-1');
  });
});
