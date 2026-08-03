/**
 * Literature service tests. Run with:
 *   node --test --test-force-exit test/literatureApi.test.js
 * (force-exit kerak: mysql pool ashıq qaladı)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getWorkPieces,
  getWriterBySlug,
  listWorks,
  listWriters,
  normalizeScript,
} from '../src/services/literatureService.js';
import { detectScript } from '../src/utils/qqScript.js';

describe('literature: script param', () => {
  it('accepts original/latin/cyrillic, defaults to cyrillic', () => {
    assert.equal(normalizeScript(''), 'cyrillic');
    assert.equal(normalizeScript(undefined), 'cyrillic');
    assert.equal(normalizeScript('LATIN'), 'latin');
    assert.equal(normalizeScript('cyrillic'), 'cyrillic');
    assert.equal(normalizeScript('original'), 'cyrillic');
  });

  it('rejects unknown script with 400', () => {
    assert.throws(() => normalizeScript('klingon'), (err) => err.statusCode === 400);
  });
});

describe('literature: writers list', () => {
  it('returns paginated writers with names in both scripts', async () => {
    const data = await listWriters({ limit: 10 });
    assert.ok(data.total > 0, 'writers table should be seeded');
    assert.ok(data.writers.length > 0 && data.writers.length <= 10);
    assert.equal(data.page, 1);
    assert.equal(data.limit, 10);
    for (const w of data.writers) {
      assert.ok(w.slug, 'writer has slug');
      assert.ok(w.name, 'writer has display name');
      assert.ok(w.nameOriginal, 'writer has original name');
      assert.ok(w.nameLatin, 'writer has latin name');
      assert.equal(w.status, 'published');
    }
  });

  it('clamps limit and page to safe bounds', async () => {
    const data = await listWriters({ limit: 99999, page: 0 });
    assert.equal(data.limit, 100);
    assert.equal(data.page, 1);
    const bad = await listWriters({ limit: 'abc', page: 'zzz' });
    assert.equal(bad.limit, 48);
    assert.equal(bad.page, 1);
  });

  it('paginates without overlap', async () => {
    const page1 = await listWriters({ limit: 5, page: 1 });
    const page2 = await listWriters({ limit: 5, page: 2 });
    const ids1 = new Set(page1.writers.map((w) => w.id));
    for (const w of page2.writers) {
      assert.equal(ids1.has(w.id), false, 'page 2 must not repeat page 1');
    }
  });

  it('finds writers by latin and original name (cross-script search)', async () => {
    const [sample] = (await listWriters({ limit: 1 })).writers;
    assert.ok(sample, 'need at least one writer');

    const byLatin = await listWriters({ q: sample.nameLatin });
    assert.ok(
      byLatin.writers.some((w) => w.id === sample.id),
      'search by latin name should find the writer'
    );

    const byOriginal = await listWriters({ q: sample.nameOriginal });
    assert.ok(
      byOriginal.writers.some((w) => w.id === sample.id),
      'search by original name should find the writer'
    );
  });

  it('filters by first letter', async () => {
    const [sample] = (await listWriters({ limit: 1 })).writers;
    const letter = sample.nameOriginal.charAt(0);
    const data = await listWriters({ letter });
    assert.ok(data.writers.length > 0);
    for (const w of data.writers) {
      assert.equal(w.nameOriginal.charAt(0).toLowerCase(), letter.toLowerCase());
    }
  });
});

describe('literature: writer detail', () => {
  it('returns biography paragraphs and linked books by slug', async () => {
    const [sample] = (await listWriters({ limit: 1 })).writers;
    const data = await getWriterBySlug(sample.slug);
    assert.equal(data.writer.slug, sample.slug);
    assert.ok(Array.isArray(data.writer.biographyParagraphs));
    assert.ok(Array.isArray(data.books));
    assert.equal(typeof data.writer.biographyPlainOriginal, 'string');
    assert.equal(typeof data.writer.biographyLatin, 'string');
  });

  it('respects script=latin for name/biography', async () => {
    const [sample] = (await listWriters({ limit: 1 })).writers;
    const data = await getWriterBySlug(sample.slug, { script: 'latin' });
    assert.equal(data.writer.name, data.writer.nameLatin);
  });

  it('404 for unknown slug, 400 for empty', async () => {
    await assert.rejects(
      () => getWriterBySlug('no-such-writer-xyz'),
      (err) => err.statusCode === 404
    );
    await assert.rejects(() => getWriterBySlug(''), (err) => err.statusCode === 400);
  });
});

describe('literature: works catalog', () => {
  it('lists works with linked writers', async () => {
    const data = await listWorks({ limit: 10 });
    assert.ok(data.total > 0, 'books should exist');
    assert.ok(data.works.length > 0);
    for (const work of data.works) {
      assert.ok(work.id);
      assert.ok(work.title);
      assert.ok(Array.isArray(work.writers));
    }
  });

  it('filters by bookId', async () => {
    const [work] = (await listWorks({ limit: 1 })).works;
    const data = await listWorks({ bookId: work.id });
    assert.equal(data.works.length, 1);
    assert.equal(data.works[0].id, work.id);
  });

  it('filters by writer slug and by numeric writer id', async () => {
    // kitabı bar jazıwshını tabamız
    const all = await listWorks({ limit: 40 });
    const linked = all.works.find((w) => w.writers.length > 0);
    if (!linked) return; // book_writers bos bolsa skip
    const writer = linked.writers[0];

    const bySlug = await listWorks({ writer: writer.slug });
    assert.ok(bySlug.works.length > 0);
    for (const w of bySlug.works) {
      assert.ok(w.writers.some((x) => x.id === writer.id));
    }

    const byId = await listWorks({ writerId: writer.id });
    assert.equal(byId.total, bySlug.total);
  });

  it('404 for unknown writer slug', async () => {
    await assert.rejects(
      () => listWorks({ writer: 'no-such-writer-xyz' }),
      (err) => err.statusCode === 404
    );
  });
});

describe('literature: work pieces', () => {
  it('returns work, writers and sorted pieces', async () => {
    // pieces bar kitaptı izlep tabamız
    const all = await listWorks({ limit: 40 });
    let found = null;
    for (const work of all.works) {
      // books.test.js parallel jaratqan waqtınsha kitaplardı ótkerip jiberemiz
      if (String(work.id).startsWith('test-book-')) continue;
      const data = await getWorkPieces(work.id);
      if (data.pieces.length) {
        found = data;
        break;
      }
    }
    if (!found) return; // hesh kitapta piece joq bolsa skip
    assert.ok(found.work.id);
    for (let i = 1; i < found.pieces.length; i++) {
      assert.ok(
        found.pieces[i].sortOrder >= found.pieces[i - 1].sortOrder,
        'pieces sorted by sortOrder'
      );
    }
    for (const p of found.pieces) {
      assert.ok(p.titleOriginal || p.titleLatin, 'piece has title');
      assert.ok(Array.isArray(p.paragraphs));
      assert.ok(Array.isArray(p.paragraphsLatin));
    }
  });

  it('returns piece text and metadata in the requested script', async () => {
    const all = await listWorks({ limit: 40 });
    let bookId = null;
    for (const work of all.works) {
      // books.test.js parallel jaratqan waqtınsha kitaplardı ótkerip jiberemiz
      if (String(work.id).startsWith('test-book-')) continue;
      const data = await getWorkPieces(work.id, { script: 'cyrillic' });
      if (data.pieces.some((piece) => piece.paragraphs.length)) {
        bookId = work.id;
        break;
      }
    }
    if (!bookId) return;

    const cyr = await getWorkPieces(bookId, { script: 'cyrillic' });
    const lat = await getWorkPieces(bookId, { script: 'latin' });
    assert.equal(cyr.pieces.length, lat.pieces.length);

    for (let i = 0; i < cyr.pieces.length; i += 1) {
      const cyrPiece = cyr.pieces[i];
      const latPiece = lat.pieces[i];
      const cyrText = [cyrPiece.title, ...cyrPiece.paragraphs].join('\n');
      const latText = [latPiece.title, ...latPiece.paragraphs].join('\n');
      assert.notEqual(detectScript(cyrText), 'latin', 'cyrillic response leaked Latin content');
      assert.notEqual(detectScript(latText), 'cyrillic', 'Latin response leaked Cyrillic content');
      if (cyrPiece.workDateLabel) {
        assert.notEqual(detectScript(cyrPiece.workDateLabel), 'latin');
      }
      if (latPiece.workDateLabel) {
        assert.notEqual(detectScript(latPiece.workDateLabel), 'cyrillic');
      }
    }
  });

  it('404 for unknown book id, 400 for empty', async () => {
    await assert.rejects(
      () => getWorkPieces('no-such-book-xyz'),
      (err) => err.statusCode === 404
    );
    await assert.rejects(() => getWorkPieces(''), (err) => err.statusCode === 400);
  });
});
