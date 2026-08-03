/**
 * Run: node --test --test-force-exit src/lib/dailyGoalProgress.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_GOAL_KEY,
  markWoDPracticed,
  markWoDPracticedIfCorrect,
  isWoDPracticedToday,
  readDailyGoal,
} from './dailyGoalProgress.js';

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

beforeEach(() => {
  memory.clear();
  installLocalStorage();
});

afterEach(() => {
  memory.clear();
});

describe('markWoDPracticedIfCorrect', () => {
  it('durıs — belgilenedi', () => {
    const r = markWoDPracticedIfCorrect('wod-1', { 'wod-1': true });
    assert.equal(r.newlyMarked, true);
    assert.equal(r.practicedId, 'wod-1');
    assert.equal(isWoDPracticedToday('wod-1'), true);
  });

  it('qáte — belgilnmeydi', () => {
    const r = markWoDPracticedIfCorrect('wod-1', { 'wod-1': false });
    assert.equal(r.newlyMarked, false);
    assert.equal(r.practicedId, null);
    assert.equal(isWoDPracticedToday('wod-1'), false);
  });

  it('WoD juwapı joq (pad sózler ǵana) — belgilnmeydi', () => {
    const r = markWoDPracticedIfCorrect('wod-1', { other: true });
    assert.equal(r.newlyMarked, false);
    assert.equal(localStorage.getItem(DAILY_GOAL_KEY), null);
  });

  it('raund tamamı jetkiliksiz — markWoDPracticed tikkeley emes, IfCorrect kerek', () => {
    markWoDPracticed('wod-ok');
    assert.equal(isWoDPracticedToday('wod-ok'), true);
    // Qátesiz ekinshi kún simulyatsiyası emes — basqa id ózgertpeydi
    const blocked = markWoDPracticedIfCorrect('wod-other', { 'wod-other': true });
    assert.equal(blocked.newlyMarked, false);
    assert.equal(readDailyGoal().practicedId, 'wod-ok');
  });
});
