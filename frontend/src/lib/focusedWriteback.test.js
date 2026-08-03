/**
 * Run: node --test --test-force-exit src/lib/focusedWriteback.test.js
 *
 * apply* wrappers localStorage + resumeEvents (Vite) — sof merge shu jerde
 * tekshiriladi; DictionaryGame exit=reading|crossword|jumbaq|immersion shu merge ni chaqıradı.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeFocusedPracticeResults,
  mergeImmersionPracticeResults,
  jumbaqPracticeHref,
  readingPracticeHref,
  crosswordPracticeHref,
  favoritesPracticeHref,
  quizPracticeHref,
} from './readingPractice.js';

describe('mergeFocusedPracticeResults (shared writeback)', () => {
  it('durıs — ids hám missed den óshiradi', () => {
    assert.deepEqual(
      mergeFocusedPracticeResults(
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
      mergeFocusedPracticeResults({ ids: ['x', 'y'], missedIds: [] }, [
        { id: 'x', correct: false },
      ]),
      { ids: ['x', 'y'], missedIds: ['x'] }
    );
  });

  it('immersion alias bir xil', () => {
    const practice = { ids: ['p'], missedIds: [] };
    const results = [{ id: 'p', correct: false }];
    assert.deepEqual(
      mergeImmersionPracticeResults(practice, results),
      mergeFocusedPracticeResults(practice, results)
    );
  });

  it('bos natıyjeler — ózgermeydi', () => {
    assert.deepEqual(
      mergeFocusedPracticeResults({ ids: ['a'], missedIds: ['b'] }, []),
      { ids: ['a'], missedIds: ['b'] }
    );
  });
});

describe('exit-faithful focused hrefs', () => {
  it('reading / crossword / jumbaq missed-first', () => {
    const practice = {
      missedIds: ['m1', 'm2', 'm3'],
      ids: ['m1', 'm2', 'm3', 'ok'],
    };
    for (const [href, exit] of [
      [readingPracticeHref(practice), 'reading'],
      [crosswordPracticeHref(practice), 'crossword'],
      [jumbaqPracticeHref(practice), 'jumbaq'],
    ]) {
      const q = new URLSearchParams(href.split('?')[1]);
      assert.equal(q.get('source'), 'focused');
      assert.equal(q.get('exit'), exit);
      assert.equal(q.get('ids'), 'm1,m2,m3');
    }
  });

  it('jumbaq tek ids — focused', () => {
    const href = jumbaqPracticeHref({ ids: ['j1', 'j2'] });
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('exit'), 'jumbaq');
    assert.equal(q.get('ids'), 'j1,j2');
  });

  it('quiz session — exit=quiz missed-first pad', () => {
    const href = quizPracticeHref({ missedIds: ['q1'], ids: ['q1', 'q2'] });
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'quiz');
    assert.equal(q.get('ids'), 'q1,q2');
  });

  it('favorites exit soft + completed', () => {
    assert.equal(
      favoritesPracticeHref([{ id: 'a' }], {
        practice: { ids: [], missedIds: [], completedIds: ['a'] },
      }),
      null
    );
    const href = favoritesPracticeHref([{ id: 'a' }, { id: 'b' }], {
      practice: { ids: ['a', 'b'], missedIds: ['a'], completedIds: [] },
    });
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('exit'), 'favorites');
    assert.equal(q.get('ids'), 'a');
  });

  it('favorites soft wins when ≥3', () => {
    const full = favoritesPracticeHref(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      { practice: { ids: [], missedIds: [], completedIds: [] } }
    );
    assert.equal(full, '/dictionary/game?source=favorites');

    const soft = favoritesPracticeHref(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      { practice: { ids: ['a', 'b', 'c'], missedIds: ['b'], completedIds: [] } }
    );
    const q = new URLSearchParams(soft.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'favorites');
    assert.equal(q.get('ids'), 'b');
  });
});
