import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeBirthplace } from '../scripts/literaturePlaceGeocode.js';

test('geocodeBirthplace resolves Taxatakópir / Тахтакөпир', () => {
  const hit = geocodeBirthplace('Тахтакөпир районында');
  assert.ok(hit);
  assert.equal(hit.status, 'resolved');
  assert.ok(Number.isFinite(hit.lat));
  assert.ok(Number.isFinite(hit.lng));
});

test('geocodeBirthplace resolves Nókis', () => {
  const hit = geocodeBirthplace('Нөкис қаласында');
  assert.ok(hit);
  assert.match(hit.labelLatin || '', /Nókis|Nukus/i);
});

test('geocodeBirthplace returns null for unknown', () => {
  assert.equal(geocodeBirthplace(''), null);
  assert.equal(geocodeBirthplace('xyz-unknown-place-999'), null);
});
