import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  createBook,
  updateBook,
  deleteBook,
  getBookById,
  listBooks,
  normalizeSections,
} from '../src/services/booksService.js';
import {
  createAdminToken,
  verifyAdminToken,
  loginAdmin,
} from '../src/middleware/adminAuth.js';
import {
  ensureUploadsDir,
  safeStoredPath,
  formatFromFilename,
} from '../src/middleware/bookUpload.js';

const TEST_ID = `test-book-${Date.now()}`;

describe('books admin auth', () => {
  it('rejects short/missing password config via loginAdmin when unset', async () => {
    const prev = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'short';
    assert.throws(() => loginAdmin('short'), (err) => err.statusCode === 503);
    process.env.ADMIN_PASSWORD = prev;
  });

  it('creates and verifies admin token', () => {
    if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 24) {
      process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-32chars!!';
    }
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
      process.env.ADMIN_PASSWORD = 'test-admin-password';
    }
    const token = createAdminToken(60_000);
    assert.ok(token.includes('.'));
    const payload = verifyAdminToken(token);
    assert.equal(payload.role, 'admin');
    assert.ok(payload.exp > Date.now());
  });

  it('rejects expired token', () => {
    if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 24) {
      process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-32chars!!';
    }
    const token = createAdminToken(-1000);
    assert.equal(verifyAdminToken(token), null);
  });

  it('loginAdmin accepts correct password', () => {
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 24) {
      process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-32chars!!';
    }
    const token = loginAdmin('test-admin-password');
    assert.ok(verifyAdminToken(token));
    assert.throws(() => loginAdmin('wrong-password'), (err) => err.statusCode === 401);
  });
});

describe('books upload helpers', () => {
  it('formatFromFilename', () => {
    assert.equal(formatFromFilename('a.PDF'), 'pdf');
    assert.equal(formatFromFilename('x.doc'), 'doc');
    assert.equal(formatFromFilename('y.docx'), 'docx');
    assert.equal(formatFromFilename('z.txt'), null);
  });

  it('safeStoredPath blocks traversal', () => {
    ensureUploadsDir();
    assert.equal(safeStoredPath('../etc/passwd'), null);
    assert.equal(safeStoredPath('abc/def.pdf'), null);
    const ok = safeStoredPath('abcdef0123456789.pdf');
    assert.ok(ok);
  });
});

describe('books service CRUD', () => {
  before(async () => {
    ensureUploadsDir();
    try {
      await deleteBook(TEST_ID);
    } catch {
      /* ok */
    }
  });

  after(async () => {
    try {
      await deleteBook(TEST_ID);
    } catch {
      /* ok */
    }
  });

  it('normalizeSections validates', () => {
    assert.deepEqual(normalizeSections([]), []);
    assert.throws(
      () => normalizeSections([{ title: '', paragraphs: ['p'] }]),
      (err) => err.statusCode === 400
    );
    const ok = normalizeSections([{ title: 'A', paragraphs: ['p1'] }]);
    assert.equal(ok.length, 1);
  });

  it('create/list/update/delete text book', async () => {
    const created = await createBook({
      id: TEST_ID,
      title: 'Test kitap',
      author: 'Test avtor',
      years: '2026',
      genre: 'klassik',
      description: 'Sınaw',
      note: 'note',
      sourceType: 'text',
      sections: [
        { title: 'Bólim 1', paragraphs: ['Birinshi paragraf.', 'Ekinshi.'] },
        { title: 'Bólim 2', paragraphs: ['Úshinshi.'] },
      ],
    });
    assert.equal(created.id, TEST_ID);
    assert.equal(created.sourceType, 'text');
    assert.equal(created.sections.length, 2);

    const listed = await listBooks();
    assert.ok(listed.some((b) => b.id === TEST_ID));

    const updated = await updateBook(TEST_ID, {
      title: 'Test kitap jańalandı',
      sections: [{ title: 'Tek', paragraphs: ['Jańa.'] }],
      sourceType: 'text',
    });
    assert.equal(updated.title, 'Test kitap jańalandı');
    assert.equal(updated.sections.length, 1);

    const one = await getBookById(TEST_ID);
    assert.equal(one.sections[0].title, 'Tek');

    await deleteBook(TEST_ID);
    assert.equal(await getBookById(TEST_ID), null);
  });

  it('create file book and cleanup on delete', async () => {
    const dir = ensureUploadsDir();
    const stored = `testfile${Date.now()}.pdf`;
    const full = path.join(dir, stored);
    fs.writeFileSync(full, '%PDF-1.4 test');

    const id = `${TEST_ID}-pdf`;
    try {
      await deleteBook(id);
    } catch {
      /* ok */
    }

    const created = await createBook(
      {
        id,
        title: 'PDF test',
        author: 'Avtor',
        genre: 'roman',
        description: 'pdf',
      },
      {
        originalname: 'sample.pdf',
        filename: stored,
        size: 14,
        mimetype: 'application/pdf',
      }
    );
    assert.equal(created.sourceType, 'pdf');
    assert.equal(created.hasFile, true);
    assert.ok(fs.existsSync(full));

    await deleteBook(id);
    assert.equal(fs.existsSync(full), false);
  });

  it('rejects invalid metadata', async () => {
    await assert.rejects(
      () =>
        createBook({
          title: '',
          author: 'x',
          sections: [{ title: 'A', paragraphs: ['p'] }],
        }),
      (err) => err.statusCode === 400
    );
  });
});
