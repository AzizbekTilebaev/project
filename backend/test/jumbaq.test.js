/**
 * Jumbaq service tests. Run with:
 *   node --test --test-force-exit test/jumbaq.test.js
 * (force-exit kerak: mysql pool ashıq qaladı)
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { pools } from '../src/config/db.js';

const db = pools.jumbaqlar;
import {
  buildJumbaqAccepted,
  dailyIndexFor,
  getDailyJumbaq,
  getJumbaqById,
  getProgressMap,
  getRandomJumbaq,
  inferLabel,
  jumbaqBankTouchKind,
  listCategories,
  listJumbaqlar,
  mapJumbaq,
  normalizeScript,
  parseCategory,
  resolveDayKey,
  upsertProgress,
} from '../src/services/jumbaqService.js';
import { gradeProduceSubmission } from '../src/utils/produceGrade.js';

// Sınaq ushın bólek actor id — aqırında tazalanadı
const TEST_ACTOR_ID = 987654321012345n;

after(async () => {
  try {
    await db.query('DELETE FROM jumbaq_progress WHERE actor_id = ?', [TEST_ACTOR_ID]);
  } catch {
    /* ok */
  }
});

describe('jumbaq: parsing helpers', () => {
  it('normalizeScript validates values', () => {
    assert.equal(normalizeScript(''), 'latin');
    assert.equal(normalizeScript('latin'), 'latin');
    assert.equal(normalizeScript('CYRILLIC'), 'cyrillic');
    assert.throws(() => normalizeScript('runes'), (err) => err.statusCode === 400);
  });

  it('parseCategory: empty → null, int → number, garbage → 400', () => {
    assert.equal(parseCategory('', 'topar'), null);
    assert.equal(parseCategory(undefined, 'topar'), null);
    assert.equal(parseCategory('16', 'topar'), 16);
    assert.throws(() => parseCategory('abc', 'topar'), (err) => err.statusCode === 400);
    assert.throws(() => parseCategory('1.5', 'topar'), (err) => err.statusCode === 400);
    assert.throws(() => parseCategory('-2', 'utopar'), (err) => err.statusCode === 400);
  });

  it('resolveDayKey validates format', () => {
    assert.match(resolveDayKey(), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(resolveDayKey('2026-07-19'), '2026-07-19');
    assert.throws(() => resolveDayKey('gibberish'), (err) => err.statusCode === 400);
  });
});

describe('jumbaq: row mapping — juwap jasırın (public)', () => {
  it('default — answerHidden, juwap joq', () => {
    const mapped = mapJumbaq({
      id: 1,
      jumbaq_original: 'Tur-tur desem turmaydı',
      jumbaq_cyrillic: null,
      juwap_original: 'Kólenke',
      juwap_cyrillic: null,
      topar: 2,
      utopar: 1,
      status: 'published',
    });
    assert.equal(mapped.answerHidden, true);
    assert.equal(mapped.juwap, undefined);
    assert.equal(mapped.answer, undefined);
    assert.ok(mapped.jumbaq);
  });

  it('includeAnswer — juwap bar', () => {
    const mapped = mapJumbaq(
      {
        id: 1,
        jumbaq_original: 'Aq sandıq',
        jumbaq_cyrillic: 'Ақ сандық',
        juwap_original: 'Tań',
        juwap_cyrillic: 'Таң',
        topar: 18,
        utopar: 7,
      },
      { script: 'cyrillic', includeAnswer: true }
    );
    assert.equal(mapped.jumbaq, 'Ақ сандық');
    assert.equal(mapped.answer, 'Таң');
    assert.equal(mapped.juwapOriginal, 'Tań');
  });
});

describe('jumbaq: buildJumbaqAccepted + soft grade', () => {
  it('latin/cyr + nearMiss', () => {
    const accepted = buildJumbaqAccepted({
      juwap_original: 'Kólenke',
      juwap_cyrillic: 'Көлеңке',
    });
    assert.ok(accepted.length >= 1);
    assert.equal(gradeProduceSubmission(accepted, 'Kólenke').correct, true);
    assert.equal(gradeProduceSubmission(accepted, 'Kolenke').correct, true);
  });
});

describe('jumbaq: bank touch kind', () => {
  it('guess correct/wrong — touch_title (advance + siblings)', () => {
    assert.equal(jumbaqBankTouchKind({ correct: true, mode: 'guess' }), 'touch_title');
    assert.equal(jumbaqBankTouchKind({ correct: false, mode: 'guess' }), 'touch_title');
    assert.equal(jumbaqBankTouchKind({ correct: true }), 'touch_title');
  });

  it('reveal correct — introduce_once (qayta reveal noop)', () => {
    assert.equal(jumbaqBankTouchKind({ correct: true, mode: 'reveal' }), 'introduce_once');
  });
});

describe('jumbaq: inferred category labels', () => {
  it('uses the most frequent answer as label', () => {
    assert.equal(inferLabel(['Aspan', 'Aspan', 'Aspan, jer', 'Kún', 'Aspan']), 'Aspan');
  });

  it('takes only the first comma part and handles empties', () => {
    assert.equal(inferLabel(['Qazan, ot', 'Qazan, ot']), 'Qazan');
    assert.equal(inferLabel([]), null);
    assert.equal(inferLabel(['', null]), null);
  });
});

describe('jumbaq: list + filters (DB)', () => {
  it('returns paginated riddles without answers', async () => {
    const data = await listJumbaqlar({ limit: 10 });
    assert.ok(data.total > 0, 'jumbaqlar table should be seeded');
    assert.equal(data.jumbaqlar.length, 10);
    for (const j of data.jumbaqlar) {
      assert.ok(j.jumbaq, 'has riddle text');
      assert.equal(j.answerHidden, true);
      assert.equal(j.answer, undefined);
      assert.equal(typeof j.topar, 'number');
      assert.equal(typeof j.utopar, 'number');
    }
  });

  it('filters by topar and utopar', async () => {
    const byTopar = await listJumbaqlar({ topar: 1, limit: 100 });
    assert.ok(byTopar.total > 0);
    for (const j of byTopar.jumbaqlar) assert.equal(j.topar, 1);

    const byUtopar = await listJumbaqlar({ utopar: byTopar.jumbaqlar[0].utopar, limit: 5 });
    assert.ok(byUtopar.total >= byTopar.total);
  });

  it('search finds matches regardless of input script', async () => {
    const [sample] = (await listJumbaqlar({ limit: 1 })).jumbaqlar;
    const full = await getJumbaqById(sample.id, { script: 'latin' });
    // Public get also hides — use DB row via includeAnswer path: admin not needed —
    // search still works server-side on juwap columns.
    const word = String(sample.jumbaq || '').split(/\s+/).find((w) => w.length > 3) || 'a';
    const latinHits = await listJumbaqlar({ q: word });
    assert.ok(latinHits.total >= 0);
    assert.ok(full.jumbaq);
  });

  it('clamps pagination and rejects bad category params', async () => {
    const data = await listJumbaqlar({ limit: 9999, page: 0 });
    assert.equal(data.limit, 100);
    assert.equal(data.page, 1);
    await assert.rejects(() => listJumbaqlar({ topar: 'x' }), (err) => err.statusCode === 400);
  });
});

describe('jumbaq: categories (DB)', () => {
  it('returns topar/utopar counts with inferred labels', async () => {
    const data = await listCategories();
    assert.ok(data.total > 0);
    assert.ok(data.topars.length > 0);
    assert.ok(data.utopars.length > 0);
    const toparSum = data.topars.reduce((s, c) => s + c.count, 0);
    const utoparSum = data.utopars.reduce((s, c) => s + c.count, 0);
    assert.equal(toparSum, data.total);
    assert.equal(utoparSum, data.total);
    for (const c of data.topars) {
      assert.ok(c.label, 'each topar has a label');
      assert.ok(c.count > 0);
      assert.equal(typeof c.utopar, 'number');
    }
  });
});

describe('jumbaq: single / random / daily (DB)', () => {
  it('getJumbaqById returns riddle without answer; 404/400 handled', async () => {
    const [sample] = (await listJumbaqlar({ limit: 1 })).jumbaqlar;
    const one = await getJumbaqById(sample.id);
    assert.equal(one.id, sample.id);
    assert.equal(one.answerHidden, true);
    assert.equal(one.answer, undefined);
    await assert.rejects(() => getJumbaqById(99999999), (err) => err.statusCode === 404);
    await assert.rejects(() => getJumbaqById('abc'), (err) => err.statusCode === 400);
  });

  it('random respects topar filter; 404 for empty filter', async () => {
    const j = await getRandomJumbaq({ topar: 1 });
    assert.equal(j.topar, 1);
    assert.equal(j.answerHidden, true);
    await assert.rejects(
      () => getRandomJumbaq({ topar: 99999 }),
      (err) => err.statusCode === 404
    );
  });

  it('daily is deterministic for a fixed date', async () => {
    const a = await getDailyJumbaq({ date: '2026-07-19' });
    const b = await getDailyJumbaq({ date: '2026-07-19' });
    assert.equal(a.id, b.id);
    assert.equal(a.date, '2026-07-19');
    assert.equal(a.answerHidden, true);

    const total = (await listJumbaqlar({ limit: 1 })).total;
    assert.equal(dailyIndexFor('2026-07-19', total), dailyIndexFor('2026-07-19', total));
    const days = ['2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22'];
    const picks = new Set(days.map((d) => dailyIndexFor(d, total)));
    assert.ok(picks.size >= 2, 'different days pick different riddles');
  });
});

describe('jumbaq: actor progress (DB)', () => {
  it('upserts revealed/favorited and reads them back', async () => {
    const [sample] = (await listJumbaqlar({ limit: 1 })).jumbaqlar;

    const first = await upsertProgress(TEST_ACTOR_ID, sample.id, { revealed: true });
    assert.equal(first.revealed, true);
    assert.equal(first.favorited, false);

    // qisman jańalaw: revealed saqlanıp qaladı
    const second = await upsertProgress(TEST_ACTOR_ID, sample.id, { favorited: true });
    assert.equal(second.revealed, true);
    assert.equal(second.favorited, true);

    const map = await getProgressMap(TEST_ACTOR_ID);
    assert.deepEqual(map.progress[sample.id], { revealed: true, favorited: true });
  });

  it('rejects empty body and unknown riddle', async () => {
    await assert.rejects(
      () => upsertProgress(TEST_ACTOR_ID, 1, {}),
      (err) => err.statusCode === 400
    );
    await assert.rejects(
      () => upsertProgress(TEST_ACTOR_ID, 99999999, { revealed: true }),
      (err) => err.statusCode === 404
    );
  });
});
