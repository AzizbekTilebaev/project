/**
 * Run: node --test --test-force-exit src/lib/readingTapQueue.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeQueuedReadingTitleId } from './readingProgress.js';
import { splitTappableParts, isTappableLemma } from '../components/literature/tappableText.js';
import { readingPracticeHref } from './readingPractice.js';

describe('mergeQueuedReadingTitleId', () => {
  it('jańa id — aldına qosadı', () => {
    const next = mergeQueuedReadingTitleId(
      { ids: ['a', 'b'], missedIds: ['m1'], bookId: 'old' },
      'c',
      { bookId: 'book-1', sectionIndex: 2 }
    );
    assert.deepEqual(next.ids, ['c', 'a', 'b']);
    assert.deepEqual(next.missedIds, ['m1']);
    assert.equal(next.isNew, true);
    assert.equal(next.bookId, 'book-1');
    assert.equal(next.sectionIndex, 2);
  });

  it('dublikat — isNew false, missed saqlanadı', () => {
    const next = mergeQueuedReadingTitleId(
      { ids: ['x'], missedIds: ['y'] },
      'x',
      { bookId: 'b' }
    );
    assert.equal(next.isNew, false);
    assert.deepEqual(next.ids, ['x']);
    assert.deepEqual(next.missedIds, ['y']);
  });

  it('href — qosılǵan id menen', () => {
    const practice = mergeQueuedReadingTitleId(null, 't1');
    const href = readingPracticeHref({
      ids: practice.ids,
      missedIds: practice.missedIds,
    });
    assert.ok(href);
    assert.ok(href.includes('exit=reading'));
    assert.ok(href.includes('t1'));
  });
});

describe('tappableText', () => {
  it('sóz hám punctuatciya ajıratadı', () => {
    const parts = splitTappableParts('Mektepke ketti.');
    assert.ok(parts.includes('Mektepke'));
    assert.ok(parts.includes('ketti'));
    assert.ok(isTappableLemma('Mektepke'));
    assert.equal(isTappableLemma('.'), false);
    assert.equal(isTappableLemma('a'), false);
    assert.equal(isTappableLemma('ol'), false);
  });
});
