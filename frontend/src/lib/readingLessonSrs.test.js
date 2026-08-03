/**
 * Run: node --test --test-force-exit src/lib/readingLessonSrs.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  dueAtFromBox,
  lessonSrsKey,
  mergeLessonSrsComplete,
  mergeServerLessonSrsIntoLocal,
  nextBoxAfterLessonComplete,
  normalizeServerLessonSrsEntry,
  getReadingLessonSrsMeta,
  readingLessonHref,
  READING_LESSON_BOX_HOURS,
  READING_LESSON_SRS_KEY,
  readLessonSrsMap,
} from './readingLessonSrs.js';

const memory = new Map();

function installLocalStorage() {
  globalThis.localStorage = {
    getItem(k) {
      return memory.has(k) ? memory.get(k) : null;
    },
    setItem(k, v) {
      memory.set(k, String(v));
    },
    removeItem(k) {
      memory.delete(k);
    },
    clear() {
      memory.clear();
    },
  };
}

describe('lessonSrsKey + href', () => {
  it('key + href', () => {
    assert.equal(lessonSrsKey('b1', 2), 'b1:2');
    assert.equal(readingLessonHref({ bookId: 'b1', sectionIndex: 2 }), '/books/b1/learn?section=2');
    assert.equal(readingLessonHref({ bookId: '' }), null);
  });
});

describe('box intervals', () => {
  it('mistake_bank mirror', () => {
    assert.deepEqual(READING_LESSON_BOX_HOURS, [0, 24, 72, 168, 336, 720]);
  });

  it('dueAtFromBox — 24h / 72h', () => {
    const now = 1_000_000;
    assert.equal(dueAtFromBox(1, now), now + 24 * 3600 * 1000);
    assert.equal(dueAtFromBox(2, now), now + 72 * 3600 * 1000);
    assert.equal(dueAtFromBox(0, now), now);
  });
});

describe('nextBoxAfterLessonComplete', () => {
  it('birinshi — box 1', () => {
    assert.equal(nextBoxAfterLessonComplete({}), 1);
    assert.equal(nextBoxAfterLessonComplete({ prevBox: null }), 1);
  });

  it('kúshli — +1', () => {
    assert.equal(nextBoxAfterLessonComplete({ prevBox: 1, score: 4, total: 4 }), 2);
    assert.equal(nextBoxAfterLessonComplete({ prevBox: 5, score: 3, total: 4 }), 5);
  });

  it('álsiz — demote, floor 1', () => {
    assert.equal(nextBoxAfterLessonComplete({ prevBox: 3, score: 1, total: 4 }), 2);
    assert.equal(nextBoxAfterLessonComplete({ prevBox: 1, score: 0, total: 4 }), 1);
  });
});

describe('mergeLessonSrsComplete', () => {
  const now = 5_000_000;

  it('birinshi tamam — 24h due', () => {
    const next = mergeLessonSrsComplete(null, {
      bookId: 'book-a',
      sectionIndex: 1,
      score: 3,
      total: 4,
      now,
    });
    assert.equal(next.box, 1);
    assert.equal(next.dueAt, now + 24 * 3600 * 1000);
    assert.equal(next.bookId, 'book-a');
    assert.equal(next.sectionIndex, 1);
  });

  it('qayta kúshli — box ósedi', () => {
    const prev = mergeLessonSrsComplete(null, {
      bookId: 'b',
      sectionIndex: 0,
      score: 4,
      total: 4,
      now,
    });
    const next = mergeLessonSrsComplete(prev, {
      bookId: 'b',
      sectionIndex: 0,
      score: 4,
      total: 4,
      now: now + 1,
    });
    assert.equal(next.box, 2);
    assert.equal(next.dueAt, now + 1 + 72 * 3600 * 1000);
  });

  it('bos bookId — null', () => {
    assert.equal(mergeLessonSrsComplete(null, { bookId: '', sectionIndex: 0 }), null);
  });
});

describe('normalizeServerLessonSrsEntry', () => {
  it('server shape', () => {
    const n = normalizeServerLessonSrsEntry({
      bookId: 'b',
      sectionIndex: 1,
      box: 2,
      dueAt: 1000,
      lastCompletedAt: 500,
      lastScore: 4,
      lastTotal: 4,
    });
    assert.equal(n.box, 2);
    assert.equal(lessonSrsKey(n.bookId, n.sectionIndex), 'b:1');
    assert.equal(normalizeServerLessonSrsEntry(null), null);
  });
});

describe('mergeServerLessonSrsIntoLocal', () => {
  beforeEach(() => {
    memory.clear();
    installLocalStorage();
  });
  afterEach(() => memory.clear());

  it('server jańaraq — jeńedi; guest-only saqlanadı', () => {
    localStorage.setItem(
      READING_LESSON_SRS_KEY,
      JSON.stringify({
        'guest:0': {
          bookId: 'guest',
          sectionIndex: 0,
          box: 1,
          dueAt: 9,
          lastCompletedAt: 1,
          lastScore: 1,
          lastTotal: 1,
        },
        'b:1': {
          bookId: 'b',
          sectionIndex: 1,
          box: 1,
          dueAt: 10,
          lastCompletedAt: 100,
          lastScore: 2,
          lastTotal: 4,
        },
      })
    );
    mergeServerLessonSrsIntoLocal([
      {
        bookId: 'b',
        sectionIndex: 1,
        box: 3,
        dueAt: 99,
        lastCompletedAt: 200,
        lastScore: 4,
        lastTotal: 4,
      },
      {
        bookId: 'b',
        sectionIndex: 2,
        box: 1,
        dueAt: 50,
        lastCompletedAt: 50,
        lastScore: 3,
        lastTotal: 4,
      },
    ]);
    const map = readLessonSrsMap();
    assert.equal(map['guest:0']?.box, 1);
    assert.equal(map['b:1']?.box, 3);
    assert.equal(map['b:1']?.lastCompletedAt, 200);
    assert.equal(map['b:2']?.box, 1);
  });

  it('eski server — local qaladı', () => {
    localStorage.setItem(
      READING_LESSON_SRS_KEY,
      JSON.stringify({
        'b:0': {
          bookId: 'b',
          sectionIndex: 0,
          box: 4,
          dueAt: 1,
          lastCompletedAt: 500,
          lastScore: 4,
          lastTotal: 4,
        },
      })
    );
    mergeServerLessonSrsIntoLocal([
      {
        bookId: 'b',
        sectionIndex: 0,
        box: 1,
        dueAt: 2,
        lastCompletedAt: 100,
        lastScore: 1,
        lastTotal: 4,
      },
    ]);
    assert.equal(readLessonSrsMap()['b:0']?.box, 4);
  });

  it('merge → bookId-scoped due (BookDetail CTA)', () => {
    mergeServerLessonSrsIntoLocal([
      {
        bookId: 'book-a',
        sectionIndex: 0,
        box: 1,
        dueAt: 10,
        lastCompletedAt: 5,
        lastScore: 3,
        lastTotal: 4,
      },
      {
        bookId: 'book-b',
        sectionIndex: 1,
        box: 2,
        dueAt: 5,
        lastCompletedAt: 4,
        lastScore: 4,
        lastTotal: 4,
      },
    ]);
    const metaA = getReadingLessonSrsMeta({ bookId: 'book-a', now: 20 });
    assert.equal(metaA.dueCount, 1);
    assert.equal(metaA.nextDue?.bookId, 'book-a');
    assert.ok(metaA.href?.includes('book-a'));
    const metaB = getReadingLessonSrsMeta({ bookId: 'book-b', now: 20 });
    assert.equal(metaB.nextDue?.sectionIndex, 1);
  });
});
