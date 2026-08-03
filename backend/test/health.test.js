import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pools } from '../src/config/db.js';

const dictDb = pools.tusindirme;
const quizDb = pools.quiz;

describe('DB health', () => {
  it('dictionary pool responds', async () => {
    const [rows] = await dictDb.query('SELECT 1 AS ok');
    assert.equal(rows[0].ok, 1);
  });

  it('quiz pool responds', async () => {
    const [rows] = await quizDb.query('SELECT 1 AS ok');
    assert.equal(rows[0].ok, 1);
  });
});
