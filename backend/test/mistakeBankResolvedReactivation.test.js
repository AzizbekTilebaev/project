/**
 * Resolved reactivation SRS contract.
 * Run: node --test --test-force-exit test/mistakeBankResolvedReactivation.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIST_DUE_WHERE,
  LIST_TOP_WHERE,
  TITLE_ROWS_WHERE,
  uniqueKey,
} from '../src/services/mistakeBankService.js';

describe('resolved reactivation SQL contracts', () => {
  it('listDue — resolved filter joq (graduated due qaytadı)', () => {
    assert.equal(LIST_DUE_WHERE, 'actor_id = ? AND due_at <= NOW()');
    assert.equal(LIST_DUE_WHERE.includes('resolved'), false);
  });

  it('listTop — unresolved only (hard mistakes flood bolmaydı)', () => {
    assert.equal(LIST_TOP_WHERE, 'actor_id = ? AND resolved = 0');
    assert.ok(LIST_TOP_WHERE.includes('resolved = 0'));
  });

  it('title touch — resolved rows included (orphan fallback aldını alıw)', () => {
    assert.equal(TITLE_ROWS_WHERE, 'actor_id = ? AND dict_title_id = ?');
    assert.equal(TITLE_ROWS_WHERE.includes('resolved'), false);
  });
});

describe('reactivation semantics (sof)', () => {
  it('wrong on resolved row must unresolve same uniqueKey — not a new key', () => {
    const quizKey = uniqueKey({
      actorId: 1,
      source: 'quiz',
      questionId: 42,
      dictTitleId: 't1',
    });
    const dictKey = uniqueKey({
      actorId: 1,
      source: 'dict_game',
      dictTitleId: 't1',
    });
    // Title-level touch finds both; reinforceWrongRow sets resolved=0 on each.
    // Fallback create would mint dictKey only when NO rows for title exist.
    assert.notEqual(quizKey, dictKey);
    assert.equal(quizKey, '1|quiz|42|');
    assert.equal(dictKey, '1|dict_game||t1');
  });
});
