import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  logisticProb,
  itemInfo,
  updateTheta,
  selectNextItem,
  estimateFromPValue,
  difficultyFromLevel,
} from '../src/services/irtService.js';

describe('irtService', () => {
  it('logisticProb is between c and 1', () => {
    const p = logisticProb(0, 1, 0, 0.2);
    assert.ok(p > 0.2 && p < 1);
  });

  it('harder items have lower probability at same theta', () => {
    const easy = logisticProb(0, 1, -1, 0.2);
    const hard = logisticProb(0, 1, 1, 0.2);
    assert.ok(easy > hard);
  });

  it('itemInfo peaks near difficulty', () => {
    const near = itemInfo(0, 1.2, 0, 0.2);
    const far = itemInfo(3, 1.2, 0, 0.2);
    assert.ok(near > far);
  });

  it('updateTheta rises after correct answers', () => {
    const { theta } = updateTheta(0, [
      { a: 1, b: 0, c: 0.2, correct: true },
      { a: 1, b: 0, c: 0.2, correct: true },
      { a: 1, b: 0.5, c: 0.2, correct: true },
    ]);
    assert.ok(theta > 0);
  });

  it('selectNextItem skips seen and prefers informative', () => {
    const items = [
      { id: '1', a: 1, b: -2, c: 0.2 },
      { id: '2', a: 1.5, b: 0, c: 0.2 },
      { id: '3', a: 1, b: 2, c: 0.2 },
    ];
    const next = selectNextItem(items, 0, new Set(['1']));
    assert.equal(String(next.id), '2');
  });

  it('estimateFromPValue and difficultyFromLevel', () => {
    assert.ok(estimateFromPValue(0.2) > estimateFromPValue(0.8));
    assert.equal(difficultyFromLevel('beginner'), -1);
    assert.equal(difficultyFromLevel('advanced'), 1);
  });
});
