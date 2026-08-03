/**
 * Run: node --test --test-force-exit src/lib/immersionPractice.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeImmersionPracticeResults,
  immersionPracticeHref,
  buildMissedFirstFocusIds,
} from './readingPractice.js';

describe('mergeImmersionPracticeResults', () => {
  it('durıs — ids hám missed den óshiradi', () => {
    assert.deepEqual(
      mergeImmersionPracticeResults(
        { ids: ['a', 'b', 'c'], missedIds: ['b'] },
        [
          { id: 'b', correct: true },
          { id: 'a', correct: true },
        ]
      ),
      { ids: ['c'], missedIds: [] }
    );
  });

  it('qáte — missedIds ge qosadı, ids saqlanadı', () => {
    assert.deepEqual(
      mergeImmersionPracticeResults({ ids: ['x', 'y'], missedIds: [] }, [
        { id: 'x', correct: false },
      ]),
      { ids: ['x', 'y'], missedIds: ['x'] }
    );
  });

  it('qosımsha qáte dublikatsız', () => {
    assert.deepEqual(
      mergeImmersionPracticeResults({ ids: ['x'], missedIds: ['x'] }, [
        { id: 'x', correct: false },
      ]),
      { ids: ['x'], missedIds: ['x'] }
    );
  });
});

describe('immersionPracticeHref missed-first', () => {
  it('missed birinshi', () => {
    const practice = {
      missedIds: ['m1', 'm2', 'm3'],
      ids: ['m1', 'm2', 'm3', 'listen'],
    };
    assert.deepEqual(buildMissedFirstFocusIds(practice), ['m1', 'm2', 'm3']);
    const href = immersionPracticeHref(practice);
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'immersion');
    assert.equal(q.get('ids'), 'm1,m2,m3');
  });
});
