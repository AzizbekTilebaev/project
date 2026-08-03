/**
 * Run: node --test --test-force-exit src/lib/dueRemediation.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUE_TUTOR_HREF,
  DUE_MISTAKES_DICT_HREF,
  dueTutorHref,
  dueMistakesDictHref,
  dueRemediationPrimaryHref,
  dueRemediationSecondaryHref,
  dueRemediationDictHref,
} from './dueRemediation.js';

describe('dueTutorHref / dict', () => {
  it('bank bar — tutor + dict', () => {
    assert.equal(dueTutorHref(true), DUE_TUTOR_HREF);
    assert.equal(dueMistakesDictHref(true), DUE_MISTAKES_DICT_HREF);
  });

  it('bank joq — null', () => {
    assert.equal(dueTutorHref(false), null);
    assert.equal(dueMistakesDictHref(false), null);
  });
});

describe('dueRemediationPrimaryHref', () => {
  it('mistakes — tutor produce-first', () => {
    assert.equal(dueRemediationPrimaryHref({ hasMistakes: true }), DUE_TUTOR_HREF);
    assert.equal(dueRemediationPrimaryHref({ hasMistakes: false }), null);
  });
});

describe('dueRemediationSecondaryHref', () => {
  it('focusHref ekinshi', () => {
    assert.equal(
      dueRemediationSecondaryHref({
        focusHref: '/dictionary/game?source=focused&ids=1',
        hasMistakes: true,
      }),
      '/dictionary/game?source=focused&ids=1'
    );
  });

  it('focus joq — dict mistakes', () => {
    assert.equal(
      dueRemediationSecondaryHref({ hasMistakes: true }),
      DUE_MISTAKES_DICT_HREF
    );
  });
});

describe('dueRemediationDictHref', () => {
  it('mistakes → source=mistakes; áksinshe generic', () => {
    assert.equal(dueRemediationDictHref({ hasMistakes: true }), DUE_MISTAKES_DICT_HREF);
    assert.equal(dueRemediationDictHref({ hasMistakes: false }), '/dictionary/game');
  });
});
