/**
 * Server reading-lesson SRS box math (local parity).
 * Run: node --test --test-force-exit test/readingLessonSrsServer.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  READING_LESSON_BOX_HOURS,
  dueHoursFromBox,
  nextBoxAfterLessonComplete,
  publicReadingLessonSrsRow,
} from '../src/services/readingService.js';

describe('READING_LESSON_BOX_HOURS', () => {
  it('mistake_bank / local mirror', () => {
    assert.deepEqual(READING_LESSON_BOX_HOURS, [0, 24, 72, 168, 336, 720]);
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

  it('álsiz — demote floor 1', () => {
    assert.equal(nextBoxAfterLessonComplete({ prevBox: 3, score: 1, total: 4 }), 2);
    assert.equal(nextBoxAfterLessonComplete({ prevBox: 1, score: 0, total: 4 }), 1);
  });
});

describe('dueHoursFromBox', () => {
  it('box 1 → 24h', () => {
    assert.equal(dueHoursFromBox(1), 24);
    assert.equal(dueHoursFromBox(2), 72);
  });
});

describe('publicReadingLessonSrsRow', () => {
  it('DB row → client ms', () => {
    const due = new Date('2026-07-25T12:00:00Z');
    const done = new Date('2026-07-24T12:00:00Z');
    const pub = publicReadingLessonSrsRow({
      book_id: 'b1',
      section_index: 2,
      box: 1,
      due_at: due,
      last_completed_at: done,
      last_score: 3,
      last_total: 4,
    });
    assert.equal(pub.bookId, 'b1');
    assert.equal(pub.sectionIndex, 2);
    assert.equal(pub.box, 1);
    assert.equal(pub.dueAt, due.getTime());
    assert.equal(pub.lastCompletedAt, done.getTime());
    assert.equal(pub.lastScore, 3);
    assert.equal(pub.lastTotal, 4);
  });
});
