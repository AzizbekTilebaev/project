/**
 * Run: node --test --test-force-exit src/lib/readingPractice.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReadingFocusIds,
  buildCrosswordFocusIds,
  readingPracticeHref,
  immersionPracticeHref,
  crosswordPracticeHref,
  focusedPracticeHref,
  favoritesPracticeHref,
  favoritesEmptySoftHref,
  jumbaqPracticeHref,
  mergeFocusedPracticeResults,
} from './readingPractice.js';
import { sourceExitHref, sourceExitLabelKey } from './recentPractice.js';

describe('buildReadingFocusIds', () => {
  it('missed yetarli bolsa tek missed qaytaradı', () => {
    assert.deepEqual(
      buildReadingFocusIds({
        missedIds: ['a', 'b', 'c'],
        ids: ['a', 'b', 'c', 'd', 'e'],
      }),
      ['a', 'b', 'c']
    );
  });

  it('missed az bolsa sol bólim vocabı menen toldıradı', () => {
    assert.deepEqual(
      buildReadingFocusIds({
        missedIds: ['m1'],
        ids: ['m1', 'v2', 'v3'],
      }),
      ['m1', 'v2', 'v3']
    );
  });

  it('missed joq — tolıq vocab', () => {
    assert.deepEqual(buildReadingFocusIds({ ids: ['x', 'y'] }), ['x', 'y']);
  });

  it('bos — []', () => {
    assert.deepEqual(buildReadingFocusIds(null), []);
    assert.deepEqual(buildReadingFocusIds({}), []);
  });
});

describe('readingPracticeHref', () => {
  it('focused source + exit=reading', () => {
    const href = readingPracticeHref({
      missedIds: ['1', '2', '3'],
      ids: ['1', '2', '3', '4'],
    });
    assert.ok(href.startsWith('/dictionary/game?'));
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'reading');
    assert.equal(q.get('ids'), '1,2,3');
  });

  it('ids joq — null', () => {
    assert.equal(readingPracticeHref({ missedIds: [], ids: [] }), null);
  });
});

describe('immersion + crossword focused href', () => {
  it('immersion exit', () => {
    const href = immersionPracticeHref({ ids: ['a', 'b'] });
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'immersion');
    assert.equal(q.get('ids'), 'a,b');
    assert.equal(sourceExitHref('focused', { exit: 'immersion' }), '/tutor/practice?from=immersion');
    assert.equal(sourceExitLabelKey('focused', { exit: 'immersion' }), 'practiceImmersion');
  });

  it('crossword missed birinshi', () => {
    const href = crosswordPracticeHref({
      missedIds: ['m1', 'm2', 'm3'],
      ids: ['m1', 'm2', 'm3', 'ok'],
    });
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('exit'), 'crossword');
    assert.equal(q.get('ids'), 'm1,m2,m3');
    assert.deepEqual(
      buildCrosswordFocusIds({ missedIds: ['w'], ids: ['w', 'a', 'b'] }),
      ['w', 'a', 'b']
    );
    assert.equal(sourceExitHref('focused', { exit: 'crossword' }), '/tutor/practice?from=crossword');
  });

  it('focusedPracticeHref bos → null', () => {
    assert.equal(focusedPracticeHref([]), null);
  });
});

describe('jumbaqPracticeHref', () => {
  it('focused + exit=jumbaq', () => {
    const href = jumbaqPracticeHref({ ids: ['j1', 'j2'] });
    assert.ok(href);
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'jumbaq');
    assert.equal(q.get('ids'), 'j1,j2');
    assert.equal(sourceExitHref('focused', { exit: 'jumbaq' }), '/tutor/practice?from=jumbaq');
    assert.equal(sourceExitLabelKey('focused', { exit: 'jumbaq' }), 'practiceJumbaq');
  });

  it('ids joq — null', () => {
    assert.equal(jumbaqPracticeHref(null), null);
    assert.equal(jumbaqPracticeHref({ ids: [] }), null);
  });
});

describe('favoritesPracticeHref', () => {
  it('≥3 → source=favorites', () => {
    assert.equal(
      favoritesPracticeHref([{ id: '1' }, { id: '2' }, { id: '3' }]),
      '/dictionary/game?source=favorites'
    );
  });

  it('1–2 → focused soft', () => {
    const href = favoritesPracticeHref([{ id: 'a' }, { id: 'b' }]);
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'favorites');
    assert.equal(q.get('ids'), 'a,b');
  });

  it('completed soft — qayta kelmeydi', () => {
    assert.equal(
      favoritesPracticeHref([{ id: 'a' }, { id: 'b' }], {
        practice: { ids: [], missedIds: [], completedIds: ['a', 'b'] },
      }),
      null
    );
  });

  it('missed-first soft queue', () => {
    const href = favoritesPracticeHref([{ id: 'a' }, { id: 'b' }, { id: 'c' }].slice(0, 2), {
      practice: { ids: ['a', 'b'], missedIds: ['b'], completedIds: [] },
    });
    // only 2 favs so soft path
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('exit'), 'favorites');
    assert.equal(q.get('ids'), 'b');
  });

  it('bos → null', () => {
    assert.equal(favoritesPracticeHref([]), null);
  });
});

describe('favoritesEmptySoftHref', () => {
  it('recent → focused exit=favorites', () => {
    const href = favoritesEmptySoftHref([{ id: 'r1' }, { id: 'r2' }]);
    const q = new URLSearchParams(href.split('?')[1]);
    assert.equal(q.get('source'), 'focused');
    assert.equal(q.get('exit'), 'favorites');
    assert.equal(q.get('ids'), 'r1,r2');
  });

  it('completed recent — null', () => {
    assert.equal(
      favoritesEmptySoftHref([{ id: 'r1' }], {
        practice: { completedIds: ['r1'], ids: [], missedIds: [] },
      }),
      null
    );
  });
});

describe('favorites soft writeback merge', () => {
  it('durıs dequeue, qáte missed', () => {
    assert.deepEqual(
      mergeFocusedPracticeResults(
        { ids: ['a', 'b'], missedIds: ['b'] },
        [
          { id: 'a', correct: true },
          { id: 'b', correct: false },
        ]
      ),
      { ids: ['b'], missedIds: ['b'] }
    );
  });
});
