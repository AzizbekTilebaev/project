/**
 * Community suggestion activation helpers.
 * Run: node --test --test-force-exit test/communityActivate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestionStubDescription,
  isCommunityGhostStub,
  validateDescriptionBody,
  validateShortText,
} from '../src/services/communityService.js';

describe('suggestionStubDescription', () => {
  it('sense hint — clip + baylanıslı', () => {
    const s = suggestionStubDescription('mektep', 'Balalar bilim alatuǵın oqıw ornı.');
    assert.ok(s.includes('Balalar'));
    assert.ok(s.includes('baylanıslı'));
    assert.equal(s.includes('(usınıs:'), false);
  });

  it('hint joq — sóz placeholder', () => {
    const s = suggestionStubDescription('Kitap');
    assert.ok(s.includes('Kitap'));
    assert.ok(s.includes('jámiyet'));
  });

  it('uzun hint — kesiledi', () => {
    const long = 'a'.repeat(200);
    const s = suggestionStubDescription('x', long);
    assert.ok(s.length < 180);
    assert.ok(s.includes('…'));
  });
});

describe('isCommunityGhostStub', () => {
  it('eski (usınıs:…) stub', () => {
    assert.equal(isCommunityGhostStub('(usınıs: mektep)'), true);
  });

  it('jańa jámiyet stub', () => {
    assert.equal(isCommunityGhostStub(suggestionStubDescription('a')), true);
    assert.equal(isCommunityGhostStub(suggestionStubDescription('a', 'hint')), true);
  });

  it('ádettegi anıqlama — emes', () => {
    assert.equal(isCommunityGhostStub('Balalar bilim alatuǵın oqıw ornı.'), false);
    assert.equal(isCommunityGhostStub(''), false);
  });
});

describe('validateDescriptionBody', () => {
  it('bos — qáte', () => {
    assert.equal(validateDescriptionBody('   ').ok, false);
  });

  it('normal tekst', () => {
    const r = validateDescriptionBody('  Ámeliy máni.  ');
    assert.equal(r.ok, true);
    assert.equal(r.text, 'Ámeliy máni.');
  });

  it('tım uzın — qáte', () => {
    assert.equal(validateDescriptionBody('x'.repeat(4001)).ok, false);
  });
});

describe('validateShortText', () => {
  it('bos — qáte', () => {
    assert.equal(validateShortText('  ', { field: 'example' }).ok, false);
  });

  it('normal mısal', () => {
    const r = validateShortText('  Kitap oqıdı.  ', { field: 'example', max: 2000 });
    assert.equal(r.ok, true);
    assert.equal(r.text, 'Kitap oqıdı.');
  });

  it('phrase max 255', () => {
    assert.equal(validateShortText('a'.repeat(256), { field: 'phrase', max: 255 }).ok, false);
  });
});
