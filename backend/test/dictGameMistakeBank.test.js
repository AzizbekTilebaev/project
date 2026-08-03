/**
 * Dict game → mistake_bank SRS fidelity.
 * Run: node --test --test-force-exit test/dictGameMistakeBank.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldCreditByDictTitle, uniqueKey } from '../src/services/mistakeBankService.js';

describe('shouldCreditByDictTitle', () => {
  it('focused lanes + open lanes — cross-source credit', () => {
    assert.equal(shouldCreditByDictTitle('mistakes'), true);
    assert.equal(shouldCreditByDictTitle('focused'), true);
    assert.equal(shouldCreditByDictTitle('reading'), true);
    assert.equal(shouldCreditByDictTitle('crossword'), true);
    assert.equal(shouldCreditByDictTitle('checkin'), true);
    assert.equal(shouldCreditByDictTitle('recent'), true);
    assert.equal(shouldCreditByDictTitle('favorites'), true);
    assert.equal(shouldCreditByDictTitle('all'), true);
    assert.equal(shouldCreditByDictTitle(''), true);
    assert.equal(shouldCreditByDictTitle(null), true);
    assert.equal(shouldCreditByDictTitle('MISTAKES'), true);
  });

  it('nomaʼlum source — credit joq (keleshek lane)', () => {
    assert.equal(shouldCreditByDictTitle('room'), false);
    assert.equal(shouldCreditByDictTitle('adaptive'), false);
  });
});

describe('immersion uniqueKey', () => {
  it('immersion ≠ dict_game key', () => {
    assert.notEqual(
      uniqueKey({ actorId: 1, source: 'immersion', dictTitleId: 't1' }),
      uniqueKey({ actorId: 1, source: 'dict_game', dictTitleId: 't1' })
    );
  });
});

describe('uniqueKey vs cross-source credit', () => {
  it('birdey title — túrli source = túrli key (sonlıqtan title boyınsha jıynaw kerek)', () => {
    assert.notEqual(
      uniqueKey({ actorId: 1, source: 'quiz', dictTitleId: 't1' }),
      uniqueKey({ actorId: 1, source: 'dict_game', dictTitleId: 't1' })
    );
    assert.notEqual(
      uniqueKey({ actorId: 1, source: 'crossword', dictTitleId: 't1' }),
      uniqueKey({ actorId: 1, source: 'reading', dictTitleId: 't1' })
    );
  });
});
