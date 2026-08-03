/**
 * Lightweight Node test for loadPageBundle (no React).
 * Run: node --test src/hooks/usePageData.test.js (from frontend with node that supports ESM)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadPageBundle } from './usePageData.js';

describe('loadPageBundle', () => {
  it('waits for required and keeps optional failures as null', async () => {
    const out = await loadPageBundle(
      {
        a: async () => 1,
        b: async () => 'ok',
      },
      {
        c: async () => {
          throw new Error('fail');
        },
      }
    );
    assert.equal(out.a, 1);
    assert.equal(out.b, 'ok');
    assert.equal(out.c, null);
  });

  it('rejects when a required fetcher fails', async () => {
    await assert.rejects(
      () =>
        loadPageBundle({
          a: async () => {
            throw new Error('boom');
          },
        }),
      /boom/
    );
  });
});
