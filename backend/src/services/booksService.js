import crypto from 'crypto';
import fs from 'fs';
import { pools, DB } from '../config/db.js';
import {
  deleteStoredFile,
  formatFromFilename,
  safeStoredPath,
} from '../middleware/bookUpload.js';
import { toLatin } from '../utils/qqScript.js';

const db = pools.poetrys;

const GENRES = new Set(['dastan', 'klassik', 'zamanagoy', 'roman', 'ertek', 'other']);
const SOURCE_TYPES = new Set(['text', 'pdf', 'doc', 'docx']);
const WRITER_ROLES = new Set(['author', 'editor', 'translator', 'other']);

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function shortId() {
  return crypto.randomBytes(6).toString('hex');
}

function fileMissingOnDisk(storedName) {
  if (!storedName) return false;
  const full = safeStoredPath(storedName);
  if (!full) return true;
  try {
    return !fs.existsSync(full);
  } catch {
    return true;
  }
}

function normalizeSections(raw) {
  if (raw == null) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw Object.assign(new Error('Bólimler JSON emes'), { statusCode: 400 });
    }
  }
  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error('Bólimler massiv bolıwı kerek'), { statusCode: 400 });
  }
  return parsed.map((section, index) => {
    const title = String(section?.title || '').trim();
    if (!title) {
      throw Object.assign(new Error(`Bólim ${index + 1}: atı bos`), { statusCode: 400 });
    }
    let paragraphs = section?.paragraphs;
    if (typeof paragraphs === 'string') {
      paragraphs = paragraphs
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
      throw Object.assign(new Error(`Bólim «${title}»: paragraf kerek`), { statusCode: 400 });
    }
    paragraphs = paragraphs.map((p) => String(p || '').trim()).filter(Boolean);
    if (!paragraphs.length) {
      throw Object.assign(new Error(`Bólim «${title}»: paragraf kerek`), { statusCode: 400 });
    }
    return { title, paragraphs };
  });
}

function mapBook(row, sections = [], extra = {}) {
  if (!row) return null;
  const titleOriginal = row.title_original || row.title;
  const titleLatin = row.title_latin || toLatin(titleOriginal);
  const authorOriginal = row.author_original || row.author;
  const authorLatin = row.author_latin || toLatin(authorOriginal);
  const descriptionOriginal = row.description_original || row.description || '';
  const descriptionLatin =
    row.description_latin || (descriptionOriginal ? toLatin(descriptionOriginal) : '');
  const writerCount =
    extra.writerCount != null
      ? Number(extra.writerCount)
      : row.writer_count != null
        ? Number(row.writer_count)
        : null;
  const missingFile =
    extra.missingFile != null
      ? Boolean(extra.missingFile)
      : fileMissingOnDisk(row.stored_name);
  const noWriter = writerCount != null ? writerCount === 0 : Boolean(extra.noWriter);
  const importStatus = row.import_status || 'seed';
  const isHidden = importStatus === 'skipped';
  return {
    id: row.id,
    title: titleOriginal,
    titleOriginal,
    titleLatin,
    author: authorOriginal,
    authorOriginal,
    authorLatin,
    years: row.years || '',
    genre: row.genre,
    description: descriptionOriginal,
    descriptionOriginal,
    descriptionLatin,
    note: row.note || '',
    sourceType: row.source_type,
    originalName: row.original_name || null,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    mimeType: row.mime_type || null,
    hasFile: Boolean(row.stored_name),
    importStatus,
    isHidden,
    writerCount: writerCount != null ? writerCount : undefined,
    writers: extra.writers,
    missingFile,
    noWriter,
    isOrphan: Boolean(missingFile || noWriter),
    sections,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadBookWriters(bookId) {
  const [rows] = await db.query(
    `SELECT bw.writer_id AS writerId,
            bw.role,
            bw.sort_order AS sortOrder,
            w.slug,
            w.poet_name_original AS nameCyrillic,
            w.poet_name_latin AS nameLatin
     FROM \`${DB.poets}\`.book_writers bw
     JOIN \`${DB.poets}\`.literature_writers w ON w.id = bw.writer_id
     WHERE bw.book_id = ?
     ORDER BY bw.sort_order ASC, w.poet_name_latin ASC`,
    [bookId]
  );
  return rows.map((r) => ({
    writerId: Number(r.writerId),
    role: r.role || 'author',
    sortOrder: Number(r.sortOrder) || 0,
    slug: r.slug,
    name: r.nameLatin || r.nameCyrillic,
    nameLatin: r.nameLatin || '',
    nameCyrillic: r.nameCyrillic || '',
  }));
}

async function loadSections(bookId) {
  const [rows] = await db.query(
    `SELECT title, paragraphs_json AS paragraphsJson, sort_order AS sortOrder
     FROM book_sections
     WHERE book_id = ?
     ORDER BY sort_order ASC`,
    [bookId]
  );
  return rows.map((r) => {
    let paragraphs = [];
    try {
      paragraphs = JSON.parse(r.paragraphsJson || '[]');
    } catch {
      paragraphs = [];
    }
    return { title: r.title, paragraphs: Array.isArray(paragraphs) ? paragraphs : [] };
  });
}

function validateMeta(input, { partial = false } = {}) {
  const out = {};
  if (!partial || input.title !== undefined) {
    out.title = String(input.title || '').trim();
    if (!out.title) {
      throw Object.assign(new Error('Kitap atı kerek'), { statusCode: 400 });
    }
    if (out.title.length > 200) {
      throw Object.assign(new Error('Kitap atı júdá uzın'), { statusCode: 400 });
    }
  }
  if (!partial || input.author !== undefined) {
    out.author = String(input.author || '').trim();
    if (!out.author) {
      throw Object.assign(new Error('Avtor kerek'), { statusCode: 400 });
    }
    if (out.author.length > 200) {
      throw Object.assign(new Error('Avtor atı júdá uzın'), { statusCode: 400 });
    }
  }
  if (!partial || input.years !== undefined) {
    out.years = String(input.years || '').trim().slice(0, 100);
  }
  if (!partial || input.genre !== undefined) {
    out.genre = String(input.genre || 'other').trim().toLowerCase();
    if (!GENRES.has(out.genre)) out.genre = 'other';
  }
  if (!partial || input.description !== undefined) {
    out.description = String(input.description || '').trim().slice(0, 5000);
  }
  if (!partial || input.note !== undefined) {
    out.note = String(input.note || '').trim().slice(0, 500);
  }
  return out;
}

async function replaceSections(conn, bookId, sections) {
  await conn.query('DELETE FROM book_sections WHERE book_id = ?', [bookId]);
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    await conn.query(
      `INSERT INTO book_sections (id, book_id, title, paragraphs_json, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [`${bookId}-s${i}`, bookId, s.title, JSON.stringify(s.paragraphs), i]
    );
  }
}

export async function listBooks({
  q = '',
  orphansOnly = false,
  includeHidden = false,
  importStatus = '',
} = {}) {
  const needle = String(q || '').trim().slice(0, 80);
  const params = [];
  const where = [];
  const statusFilter = String(importStatus || '').trim();
  const STATUS_OK = new Set(['seed', 'imported', 'draft', 'skipped']);
  if (statusFilter && STATUS_OK.has(statusFilter)) {
    where.push('b.import_status = ?');
    params.push(statusFilter);
  } else if (!includeHidden) {
    where.push(`(b.import_status IS NULL OR b.import_status <> 'skipped')`);
  }
  if (needle) {
    where.push(
      `(b.id = ? OR b.title LIKE ? OR b.title_original LIKE ? OR b.title_latin LIKE ?
        OR b.author LIKE ? OR b.author_original LIKE ? OR b.author_latin LIKE ?)`
    );
    const like = `%${needle}%`;
    params.push(needle, like, like, like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT b.id, b.title, b.title_original, b.title_latin,
            b.author, b.author_original, b.author_latin,
            b.years, b.genre, b.description, b.description_original, b.description_latin, b.note,
            b.source_type, b.original_name, b.stored_name, b.file_size, b.mime_type,
            b.import_status, b.created_at, b.updated_at,
            (SELECT COUNT(*) FROM \`${DB.poets}\`.book_writers bw WHERE bw.book_id = b.id) AS writer_count
     FROM books b
     ${whereSql}
     ORDER BY b.created_at DESC
     LIMIT 300`,
    params
  );
  let books = rows.map((r) =>
    mapBook(r, [], {
      writerCount: r.writer_count,
      missingFile: fileMissingOnDisk(r.stored_name),
    })
  );
  if (orphansOnly) {
    books = books.filter((b) => b.isOrphan);
  }
  return books;
}

export async function getBookById(id, { includeHidden = false } = {}) {
  const [rows] = await db.query(
    `SELECT id, title, title_original, title_latin,
            author, author_original, author_latin,
            years, genre, description, description_original, description_latin, note,
            source_type, original_name, stored_name, file_size, mime_type,
            import_status, created_at, updated_at
     FROM books WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  if (!includeHidden && rows[0].import_status === 'skipped') return null;
  const sections = rows[0].source_type === 'text' ? await loadSections(id) : [];
  let writers = [];
  let writerCount = 0;
  try {
    writers = await loadBookWriters(id);
    writerCount = writers.length;
  } catch {
    writers = [];
    writerCount = 0;
  }
  return mapBook(rows[0], sections, {
    writers,
    writerCount,
    missingFile: fileMissingOnDisk(rows[0].stored_name),
  });
}

export async function getBookFileMeta(id) {
  const [rows] = await db.query(
    `SELECT id, title, source_type, original_name, stored_name, file_size, mime_type
     FROM books WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Create book from text (JSON sections) or uploaded file.
 * @param {object} input
 * @param {object|null} file multer file
 */
export async function createBook(input, file = null) {
  const meta = validateMeta(input);

  let sourceType;
  let sections = [];
  let originalName = null;
  let storedName = null;
  let fileSize = null;
  let mimeType = null;

  if (file) {
    sourceType = formatFromFilename(file.originalname);
    if (!sourceType || sourceType === 'text') {
      deleteStoredFile(file.filename);
      throw Object.assign(new Error('Fayl túri qabıl etilmeydi'), { statusCode: 400 });
    }
    originalName = String(file.originalname || '').slice(0, 255);
    storedName = file.filename;
    fileSize = file.size;
    mimeType = file.mimetype || null;
  } else {
    sourceType = 'text';
    sections = normalizeSections(input.sections);
    if (!sections.length) {
      throw Object.assign(new Error('Tekst kitap ushın keminde 1 bólim kerek'), {
        statusCode: 400,
      });
    }
  }

  const id = String(input.id || shortId()).trim().slice(0, 64) || shortId();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO books
        (id, title, author, years, genre, description, note,
         source_type, original_name, stored_name, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        meta.title,
        meta.author,
        meta.years,
        meta.genre,
        meta.description,
        meta.note,
        sourceType,
        originalName,
        storedName,
        fileSize,
        mimeType,
      ]
    );
    if (sourceType === 'text') {
      await replaceSections(conn, id, sections);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (storedName) deleteStoredFile(storedName);
    if (err.code === 'ER_DUP_ENTRY') {
      throw Object.assign(new Error('Bul ID menen kitap bar'), { statusCode: 409 });
    }
    throw err;
  } finally {
    conn.release();
  }
  return getBookById(id);
}

export async function updateBook(id, input, file = null) {
  const full = await getBookById(id);
  if (!full) {
    if (file) deleteStoredFile(file.filename);
    throw Object.assign(new Error('Kitap tabılmadı'), { statusCode: 404 });
  }

  const nextMeta = validateMeta({
    title: input.title !== undefined ? input.title : full.title,
    author: input.author !== undefined ? input.author : full.author,
    years: input.years !== undefined ? input.years : full.years,
    genre: input.genre !== undefined ? input.genre : full.genre,
    description: input.description !== undefined ? input.description : full.description,
    note: input.note !== undefined ? input.note : full.note,
  });

  const fileMeta = await getBookFileMeta(id);
  let sourceType = fileMeta.source_type;
  let sections = null;
  let originalName = fileMeta.original_name;
  let storedName = fileMeta.stored_name;
  let fileSize = fileMeta.file_size;
  let mimeType = fileMeta.mime_type;
  let oldStoredToDelete = null;

  if (file) {
    const fmt = formatFromFilename(file.originalname);
    if (!fmt) {
      deleteStoredFile(file.filename);
      throw Object.assign(new Error('Fayl túri qabıl etilmeydi'), { statusCode: 400 });
    }
    oldStoredToDelete = storedName;
    sourceType = fmt;
    originalName = String(file.originalname || '').slice(0, 255);
    storedName = file.filename;
    fileSize = file.size;
    mimeType = file.mimetype || null;
    sections = [];
  } else if (input.sourceType === 'text' || input.sections !== undefined) {
    sourceType = 'text';
    sections = normalizeSections(
      input.sections !== undefined ? input.sections : full.sections
    );
    if (!sections.length) {
      throw Object.assign(new Error('Tekst kitap ushın keminde 1 bólim kerek'), {
        statusCode: 400,
      });
    }
    if (fileMeta.stored_name) oldStoredToDelete = fileMeta.stored_name;
    originalName = null;
    storedName = null;
    fileSize = null;
    mimeType = null;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE books SET
         title = ?, author = ?, years = ?, genre = ?, description = ?, note = ?,
         source_type = ?, original_name = ?, stored_name = ?, file_size = ?, mime_type = ?
       WHERE id = ?`,
      [
        nextMeta.title,
        nextMeta.author,
        nextMeta.years,
        nextMeta.genre,
        nextMeta.description,
        nextMeta.note,
        sourceType,
        originalName,
        storedName,
        fileSize,
        mimeType,
        id,
      ]
    );
    if (sections !== null) {
      await replaceSections(conn, id, sections);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (file) deleteStoredFile(file.filename);
    throw err;
  } finally {
    conn.release();
  }

  if (oldStoredToDelete && oldStoredToDelete !== storedName) {
    deleteStoredFile(oldStoredToDelete);
  }
  return getBookById(id);
}

export async function hideBook(id) {
  const meta = await getBookFileMeta(id);
  if (!meta) throw httpError('Kitap tabılmadı', 404);
  await db.query(`UPDATE books SET import_status = 'skipped' WHERE id = ?`, [id]);
  return getBookById(id, { includeHidden: true });
}

export async function restoreBook(id) {
  const [rows] = await db.query(`SELECT id FROM books WHERE id = ? LIMIT 1`, [id]);
  if (!rows[0]) throw httpError('Kitap tabılmadı', 404);
  await db.query(`UPDATE books SET import_status = 'imported' WHERE id = ?`, [id]);
  return getBookById(id, { includeHidden: true });
}

export async function linkBookWriter(bookId, writerId, { role = 'author' } = {}) {
  const book = await getBookById(bookId, { includeHidden: true });
  if (!book) throw httpError('Kitap tabılmadı', 404);
  const wid = Number(writerId);
  if (!Number.isFinite(wid) || wid < 1) throw httpError('writerId kerek', 400);
  const roleSafe = WRITER_ROLES.has(String(role)) ? String(role) : 'author';

  const [[writer]] = await db.query(
    `SELECT id FROM \`${DB.poets}\`.literature_writers WHERE id = ? LIMIT 1`,
    [wid]
  );
  if (!writer) throw httpError('Shoir tabılmadı', 404);

  const [[{ mx }]] = await db.query(
    `SELECT COALESCE(MAX(sort_order), -1) AS mx FROM \`${DB.poets}\`.book_writers WHERE book_id = ?`,
    [bookId]
  );
  await db.query(
    `INSERT INTO \`${DB.poets}\`.book_writers (book_id, writer_id, role, sort_order)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [bookId, wid, roleSafe, Number(mx) + 1]
  );
  return getBookById(bookId, { includeHidden: true });
}

export async function unlinkBookWriter(bookId, writerId) {
  const book = await getBookById(bookId, { includeHidden: true });
  if (!book) throw httpError('Kitap tabılmadı', 404);
  const wid = Number(writerId);
  if (!Number.isFinite(wid) || wid < 1) throw httpError('writerId kerek', 400);
  const [result] = await db.query(
    `DELETE FROM \`${DB.poets}\`.book_writers WHERE book_id = ? AND writer_id = ?`,
    [bookId, wid]
  );
  if (!result.affectedRows) throw httpError('Baylanıs tabılmadı', 404);
  return getBookById(bookId, { includeHidden: true });
}

export async function deleteBook(id) {
  const meta = await getBookFileMeta(id);
  if (!meta) {
    throw httpError('Kitap tabılmadı', 404);
  }
  await db.query('DELETE FROM books WHERE id = ?', [id]);
  if (meta.stored_name) deleteStoredFile(meta.stored_name);
  return { id };
}

export { GENRES, SOURCE_TYPES, WRITER_ROLES, normalizeSections };
