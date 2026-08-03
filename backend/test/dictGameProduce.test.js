/**
 * Dict-game typed produce + produce_reverse + habit uplift.
 * Run: node --test --test-force-exit test/dictGameProduce.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDictGameTypedKind,
  publicDictGameQuestion,
  shouldDictGameProduce,
  shouldDictGameProduceReverse,
  shouldForceDictGameProduce,
} from '../src/services/dictGameService.js';
import { buildTutorGlossAccepted } from '../src/services/tutorService.js';
import { gradeGlossProduceSubmission } from '../src/utils/produceGrade.js';

describe('shouldDictGameProduce', () => {
  it('deterministik + ~30% (oddiy)', () => {
    const a = shouldDictGameProduce({ titleId: 't1', roundId: 'r1' });
    const b = shouldDictGameProduce({ titleId: 't1', roundId: 'r1' });
    assert.equal(a, b);
    const flips = Array.from({ length: 40 }, (_, i) =>
      shouldDictGameProduce({ titleId: `id-${i}`, roundId: 'r' })
    );
    const n = flips.filter(Boolean).length;
    assert.ok(n >= 5 && n <= 20, `produce count ${n}`);
  });

  it('remediation source — ~50%', () => {
    const flips = Array.from({ length: 40 }, (_, i) =>
      shouldDictGameProduce({
        titleId: `id-${i}`,
        roundId: 'r',
        source: 'mistakes',
      })
    );
    const n = flips.filter(Boolean).length;
    assert.ok(n >= 12 && n <= 28, `remediation produce count ${n}`);
  });

  it('habit sources (checkin/favorites/recent) — ~50%', () => {
    for (const source of ['checkin', 'favorites', 'recent']) {
      const flips = Array.from({ length: 40 }, (_, i) =>
        shouldDictGameProduce({
          titleId: `id-${i}`,
          roundId: 'r',
          source,
        })
      );
      const n = flips.filter(Boolean).length;
      assert.ok(n >= 12 && n <= 28, `${source} produce count ${n}`);
    }
  });

  it('force=true — always produce', () => {
    assert.equal(
      shouldDictGameProduce({ titleId: 'wod-1', roundId: 'r', source: 'all', force: true }),
      true
    );
  });

  it('bos title — false', () => {
    assert.equal(shouldDictGameProduce({ titleId: '' }), false);
    assert.equal(shouldDictGameProduce({ titleId: '', force: true }), false);
  });
});

describe('shouldForceDictGameProduce', () => {
  it('checkin seed id — force', () => {
    assert.equal(
      shouldForceDictGameProduce({
        titleId: 'wod-1',
        source: 'checkin',
        seedIds: ['wod-1', 'pad-2'],
      }),
      true
    );
  });

  it('favorites seed id — force', () => {
    assert.equal(
      shouldForceDictGameProduce({
        titleId: 'fav-1',
        source: 'favorites',
        seedIds: ['fav-1', 'fav-2'],
      }),
      true
    );
  });

  it('recent seed id — force', () => {
    assert.equal(
      shouldForceDictGameProduce({
        titleId: 'rec-1',
        source: 'recent',
        seedIds: ['rec-1'],
      }),
      true
    );
  });

  it('pad / basqa source — false', () => {
    assert.equal(
      shouldForceDictGameProduce({
        titleId: 'pad-9',
        source: 'checkin',
        seedIds: ['wod-1'],
      }),
      false
    );
    assert.equal(
      shouldForceDictGameProduce({
        titleId: 'x',
        source: 'mistakes',
        seedIds: ['x'],
      }),
      false
    );
  });
});

describe('shouldDictGameProduceReverse', () => {
  it('deterministik + ~50%', () => {
    const a = shouldDictGameProduceReverse({ titleId: 't1', roundId: 'r1' });
    const b = shouldDictGameProduceReverse({ titleId: 't1', roundId: 'r1' });
    assert.equal(a, b);
    const flips = Array.from({ length: 40 }, (_, i) =>
      shouldDictGameProduceReverse({ titleId: `id-${i}`, roundId: 'r' })
    );
    const n = flips.filter(Boolean).length;
    assert.ok(n >= 12 && n <= 28, `reverse count ${n}`);
  });
});

describe('isDictGameTypedKind', () => {
  it('produce + produce_reverse', () => {
    assert.equal(isDictGameTypedKind('produce'), true);
    assert.equal(isDictGameTypedKind('produce_reverse'), true);
    assert.equal(isDictGameTypedKind('mcq'), false);
  });
});

describe('publicDictGameQuestion', () => {
  it('produce — accepted/soz jasırın', () => {
    const pub = publicDictGameQuestion({
      id: 't1',
      soz: 'mektep',
      category: 'noun',
      kind: 'produce',
      prompt: 'Oqıw ornı.',
      accepted: ['mektep'],
    });
    assert.deepEqual(pub, {
      id: 't1',
      category: 'noun',
      kind: 'produce',
      prompt: 'Oqıw ornı.',
    });
    assert.equal('soz' in pub, false);
    assert.equal('accepted' in pub, false);
  });

  it('produce_reverse — accepted/reveal jasırın', () => {
    const pub = publicDictGameQuestion({
      id: 't3',
      soz: 'mektep',
      category: 'noun',
      kind: 'produce_reverse',
      prompt: 'mektep',
      accepted: ['Oqıw ornı'],
      revealAnswer: 'Oqıw ornı',
    });
    assert.deepEqual(pub, {
      id: 't3',
      category: 'noun',
      kind: 'produce_reverse',
      prompt: 'mektep',
    });
    assert.equal('accepted' in pub, false);
    assert.equal('revealAnswer' in pub, false);
    assert.equal('soz' in pub, false);
  });

  it('mcq — options + soz', () => {
    const pub = publicDictGameQuestion({
      id: 't2',
      soz: 'kitap',
      category: null,
      kind: 'mcq',
      options: ['A', 'B'],
      correct: 0,
    });
    assert.equal(pub.kind, 'mcq');
    assert.equal(pub.soz, 'kitap');
    assert.deepEqual(pub.options, ['A', 'B']);
    assert.equal('correct' in pub, false);
  });
});

describe('gloss reverse grade (dict)', () => {
  it('qısqa anıqlama — soft nearMiss', () => {
    const def = 'Balalar bilim alatuǵın oqıw ornı.';
    const accepted = buildTutorGlossAccepted(def);
    assert.ok(accepted.length >= 1);
    assert.equal(gradeGlossProduceSubmission(accepted, def).correct, true);
    const soft = gradeGlossProduceSubmission(accepted, 'Balalar bilim alatuǵın oqıw orna.');
    assert.equal(soft.correct, true);
    assert.equal(soft.nearMiss, true);
  });
});
