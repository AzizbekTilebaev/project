import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { pools } from '../src/config/db.js';
import {
  createSuggestion,
  voteSuggestion,
  listPendingSuggestions,
  moderateSuggestion,
} from '../src/services/communityService.js';
import { hashAnonymousId } from '../src/utils/actorHash.js';

const dictDb = pools.tusindirme;

describe('community suggestions', () => {
  let descriptionId = null;
  let titleId = null;

  before(async () => {
    const [[row]] = await dictDb.query(
      `SELECT d.id AS descriptionId, d.titles_id AS titleId
       FROM description d
       JOIN titles t ON t.id = d.titles_id AND t.status = 1
       LIMIT 1`
    );
    if (row) {
      descriptionId = row.descriptionId;
      titleId = row.titleId;
    }
  });

  it('create + duplicate vote blok + self-vote rad', async () => {
    if (!descriptionId) {
      console.log('skip: description yo‘q');
      return;
    }
    const keyA = hashAnonymousId(crypto.randomUUID());
    const keyB = hashAnonymousId(crypto.randomUUID());
    const word = `testsin_${crypto.randomBytes(3).toString('hex')}`;

    const created = await createSuggestion(keyA, {
      suggestionType: 'synonym',
      descriptionId,
      suggestedWord: word,
    });
    assert.ok(created.id);
    assert.equal(created.status, 'pending');

    await assert.rejects(
      () =>
        createSuggestion(keyA, {
          suggestionType: 'synonym',
          descriptionId,
          suggestedWord: word,
        }),
      (err) => err.statusCode === 409
    );

    await assert.rejects(
      () => voteSuggestion(keyA, created.id, 'up'),
      (err) => err.statusCode === 403
    );

    const voted = await voteSuggestion(keyB, created.id, 'up');
    assert.ok(voted.upvotes >= 1);

    const again = await voteSuggestion(keyB, created.id, 'up');
    assert.equal(again.unchanged, true);

    const pending = await listPendingSuggestions({ descriptionId, limit: 50 });
    assert.ok(pending.some((p) => p.id === created.id));

    const mod = await moderateSuggestion(created.id, { approve: false, note: 'test reject' });
    assert.equal(mod.status, 'rejected');
  });

  it('compound suggestion + approve placeholder', async () => {
    if (!titleId) {
      console.log('skip: title yo‘q');
      return;
    }
    const keyA = hashAnonymousId(crypto.randomUUID());
    const word = `comp_${crypto.randomBytes(3).toString('hex')}`;
    const created = await createSuggestion(keyA, {
      suggestionType: 'compound',
      mainTitleId: titleId,
      suggestedWord: word,
      sortOrder: 1,
    });
    const mod = await moderateSuggestion(created.id, { approve: true, note: 'test approve' });
    assert.equal(mod.status, 'approved');

    const [rows] = await dictDb.query(
      `SELECT cw.id FROM compound_words cw
       JOIN titles t ON t.id = cw.component_title_id
       WHERE cw.main_title_id = ? AND t.soz = ?`,
      [titleId, word]
    );
    assert.ok(rows.length >= 1);

    // Self-cleanup: test artefaktlari bazada qolmasin
    await dictDb.query(
      `DELETE cw FROM compound_words cw
       JOIN titles t ON t.id = cw.component_title_id
       WHERE t.soz = ?`,
      [word]
    );
    await dictDb.query(`DELETE FROM titles WHERE soz = ? AND status = 0`, [word]);
    await dictDb.query(`DELETE FROM community_suggestions WHERE id = ?`, [created.id]);
  });

  after(async () => {
    // Sinonim testidan qolgan pending/rejected yozuvlar
    await dictDb.query(
      `DELETE FROM community_suggestions WHERE suggested_word LIKE 'testsin\\_%'`
    );
  });
});
