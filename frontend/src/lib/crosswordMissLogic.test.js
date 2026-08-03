/**
 * Sof helpers — localStorage joq.
 * Run: node --test --test-force-exit src/lib/crosswordMissLogic.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCrosswordFocusIds } from './readingPractice.js';

describe('crossword missed focus', () => {
  it('3+ missed — tek qáteler', () => {
    assert.deepEqual(
      buildCrosswordFocusIds({
        missedIds: ['1', '2', '3'],
        ids: ['1', '2', '3', '9'],
      }),
      ['1', '2', '3']
    );
  });

  it('1 missed — sheshilgenler menen toldıradı', () => {
    assert.deepEqual(
      buildCrosswordFocusIds({
        missedIds: ['bad'],
        ids: ['good1', 'good2'],
      }),
      ['bad', 'good1', 'good2']
    );
  });
});
