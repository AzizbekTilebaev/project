import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import searchFold from '../src/utils/searchFold.js';

describe('searchFold', () => {
  it('lotin jaqsi -> kirill folded', () => {
    assert.equal(searchFold('jaqsi'), 'жакси');
    assert.equal(searchFold('jaqsı'), 'жакси');
  });

  it('kirill ЖАҚСЫ folded', () => {
    assert.equal(searchFold('ЖАҚСЫ'), 'жакси');
  });

  it('bo\'sh satr', () => {
    assert.equal(searchFold(''), '');
    assert.equal(searchFold(null), '');
  });
});
