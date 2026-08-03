/**
 * Shoirlar (literature_writers) admin boshqaruvi.
 * Uy bazasi: kk_poets. Kirill/lotin juftligi avtomat saqlanadı.
 */
import crypto from 'crypto';
import { pools, DB } from '../config/db.js';
import searchFold from '../utils/searchFold.js';
import { slugifyWriterName, toCyrillic, toLatin } from '../utils/qqScript.js';
import { deleteStoredWriterPhoto } from '../middleware/writerPhotoUpload.js';

const db = pools.poets;
const poetryDb = pools.poetrys;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const STATUSES = new Set(['published', 'draft']);

function hashText(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function clampLimit(raw, fallback = 24, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function clampPage(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function yearOrNull(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 700 || n > 2100) {
    throw httpError('Jıl 700–2100 aralıǵında bolıwı kerek');
  }
  return n;
}

function lifeSpanFrom(birthYear, deathYear) {
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (birthYear) return `${birthYear}–`;
  if (deathYear) return `–${deathYear}`;
  return '';
}

function prepareWriterInput(payload, { requireName = true } = {}) {
  const nameRaw = String(payload?.name || '').trim();
  if (requireName && nameRaw.length < 2) {
    throw httpError('Shoir atı keminde 2 belgiden ibarat bolıwı kerek');
  }
  const nameCyrillic = toCyrillic(nameRaw);
  const nameLatin = toLatin(nameRaw);
  const bioRaw = String(payload?.biography || '').trim();
  const placeRaw = String(payload?.birthplace || '').trim();
  const birthYear = yearOrNull(payload?.birthYear);
  const deathYear = yearOrNull(payload?.deathYear);
  if (birthYear && deathYear && deathYear < birthYear) {
    throw httpError('Ólim jılı tuwılǵan jıldan erte bolmawı kerek');
  }
  const status = String(payload?.status || 'published');
  if (!STATUSES.has(status)) throw httpError('status "published" yamasa "draft" bolıwı kerek');

  let slug = String(payload?.slug || '').trim().toLowerCase();
  if (!slug) slug = slugifyWriterName(nameLatin || nameCyrillic);
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    throw httpError('Slug tek hárip, san hám defisten ibarat bolıwı kerek');
  }

  return {
    slug,
    poetNameOriginal: nameCyrillic,
    poetNameLatin: nameLatin,
    biographyPlainOriginal: bioRaw ? toCyrillic(bioRaw) : null,
    biographyLatin: bioRaw ? toLatin(bioRaw) : null,
    birthplaceOriginal: placeRaw ? toCyrillic(placeRaw) : null,
    birthplaceLatin: placeRaw ? toLatin(placeRaw) : null,
    birthYear,
    deathYear,
    lifeSpan: lifeSpanFrom(birthYear, deathYear),
    status,
    contentHash: hashText(
      `${nameCyrillic}|${nameLatin}|${bioRaw}|${placeRaw}|${birthYear}|${deathYear}|${status}`
    ),
  };
}

function mapAdminWriter(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.poet_name_latin || row.poet_name_original,
    nameLatin: row.poet_name_latin,
    nameCyrillic: row.poet_name_original,
    biography: row.biography_latin || row.biography_plain_original || '',
    biographyLatin: row.biography_latin || '',
    biographyCyrillic: row.biography_plain_original || '',
    birthplace: row.birthplace_latin || row.birthplace_original || '',
    birthplaceLatin: row.birthplace_latin || '',
    birthplaceCyrillic: row.birthplace_original || '',
    birthYear: row.birth_year != null ? Number(row.birth_year) : null,
    deathYear: row.death_year != null ? Number(row.death_year) : null,
    lifeSpan: row.life_span || '',
    status: row.status,
    geocodeStatus: row.geocode_status || 'none',
    updatedAt: row.updated_at,
    creativeCount: row.creative_count != null ? Number(row.creative_count) : undefined,
    bookCount: row.book_count != null ? Number(row.book_count) : undefined,
  };
}

export async function listWritersAdmin({ q = '', status = '', geocode = '', page = 1, limit = 24 } = {}) {
  const safeLimit = clampLimit(limit);
  const safePage = clampPage(page);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  if (status) {
    if (!STATUSES.has(status)) throw httpError('status "published" yamasa "draft" bolıwı kerek');
    where.push('w.status = ?');
    params.push(status);
  }

  const geo = String(geocode || '').trim();
  if (geo) {
    const allowed = new Set(['none', 'pending', 'resolved', 'failed', 'manual']);
    if (!allowed.has(geo)) throw httpError('geocode none|pending|resolved|failed|manual');
    where.push('w.geocode_status = ?');
    params.push(geo);
  }

  const query = String(q || '').trim();
  if (query) {
    const fold = searchFold(query);
    const like = `%${query}%`;
    const foldLike = `%${fold}%`;
    where.push(
      `(w.poet_name_original LIKE ? OR w.poet_name_latin LIKE ? OR w.slug LIKE ? OR EXISTS (
         SELECT 1 FROM writer_aliases a WHERE a.writer_id = w.id AND (a.alias_original LIKE ? OR a.alias_latin LIKE ? OR a.alias_fold LIKE ?)
       ))`
    );
    params.push(like, like, like, like, like, foldLike);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM literature_writers w ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT w.id, w.slug, w.poet_name_original, w.poet_name_latin, w.life_span,
            w.birth_year, w.death_year, w.birthplace_original, w.birthplace_latin,
            w.biography_plain_original, w.biography_latin, w.status, w.geocode_status, w.updated_at,
            (SELECT COUNT(*) FROM ${DB.poetrys}.writer_creative_works c WHERE c.writer_id = w.id) AS creative_count,
            (SELECT COUNT(*) FROM book_writers bw WHERE bw.writer_id = w.id) AS book_count
     FROM literature_writers w
     ${whereSql}
     ORDER BY w.poet_name_latin ASC, w.id ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    items: rows.map(mapAdminWriter),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
  };
}

export async function getWriterAdmin(idOrSlug) {
  const key = String(idOrSlug || '').trim();
  if (!key) throw httpError('Shoir ID yamasa slug kerek');
  const isId = /^\d+$/.test(key);
  const [[row]] = await db.query(
    `SELECT w.*, 
            (SELECT COUNT(*) FROM ${DB.poetrys}.writer_creative_works c WHERE c.writer_id = w.id) AS creative_count,
            (SELECT COUNT(*) FROM book_writers bw WHERE bw.writer_id = w.id) AS book_count
     FROM literature_writers w
     WHERE ${isId ? 'w.id = ?' : 'w.slug = ?'}
     LIMIT 1`,
    [isId ? Number(key) : key]
  );
  if (!row) throw httpError('Shoir tabılmadı', 404);

  const [aliases] = await db.query(
    `SELECT id, alias_original AS aliasCyrillic, alias_latin AS aliasLatin
     FROM writer_aliases WHERE writer_id = ? ORDER BY id`,
    [row.id]
  );
  const [works] = await poetryDb.query(
    `SELECT id, slug, title_original AS titleCyrillic, title_latin AS titleLatin,
            work_type AS workType, year_label AS yearLabel, availability, sort_order AS sortOrder
     FROM writer_creative_works WHERE writer_id = ? ORDER BY sort_order, id`,
    [row.id]
  );

  const photos = await listWriterPhotos(row.id, { script: 'latin' });

  return {
    ...mapAdminWriter(row),
    aliases: aliases.map((a) => ({
      id: a.id,
      alias: a.aliasLatin || a.aliasCyrillic,
      aliasLatin: a.aliasLatin,
      aliasCyrillic: a.aliasCyrillic,
    })),
    creativeWorks: works,
    photos,
  };
}

async function ensureUniqueSlug(slug, excludeId = null) {
  let candidate = slug;
  for (let i = 0; i < 20; i++) {
    const [[hit]] = await db.query(
      `SELECT id FROM literature_writers WHERE slug = ? ${excludeId ? 'AND id <> ?' : ''} LIMIT 1`,
      excludeId ? [candidate, excludeId] : [candidate]
    );
    if (!hit) return candidate;
    candidate = `${slug}-${i + 2}`.slice(0, 120);
  }
  throw httpError('Slug band — basqasın saylań', 409);
}

export async function createWriterAdmin(payload) {
  const input = prepareWriterInput(payload);
  input.slug = await ensureUniqueSlug(input.slug);

  const [result] = await db.query(
    `INSERT INTO literature_writers
      (slug, poet_name_original, poet_name_latin, life_span, birth_year, death_year,
       birthplace_original, birthplace_latin, biography_plain_original, biography_latin,
       biography_original, source, content_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin-panel', ?, ?)`,
    [
      input.slug,
      input.poetNameOriginal,
      input.poetNameLatin,
      input.lifeSpan,
      input.birthYear,
      input.deathYear,
      input.birthplaceOriginal,
      input.birthplaceLatin,
      input.biographyPlainOriginal,
      input.biographyLatin,
      input.biographyPlainOriginal,
      input.contentHash,
      input.status,
    ]
  );

  // Asosiy atın alias sifatida ham saqlaymız (izlew ushın)
  await db.query(
    `INSERT IGNORE INTO writer_aliases (writer_id, alias_original, alias_latin, alias_fold)
     VALUES (?, ?, ?, ?)`,
    [
      result.insertId,
      input.poetNameOriginal,
      input.poetNameLatin,
      searchFold(`${input.poetNameOriginal}|${input.poetNameLatin}`),
    ]
  );

  return getWriterAdmin(result.insertId);
}

export async function updateWriterAdmin(id, payload) {
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) throw httpError('Shoir ID qáte');
  const existing = await getWriterAdmin(num);
  const input = prepareWriterInput({
    name: payload?.name ?? existing.nameLatin,
    biography: payload?.biography ?? existing.biographyLatin,
    birthplace: payload?.birthplace ?? existing.birthplaceLatin,
    birthYear: payload?.birthYear !== undefined ? payload.birthYear : existing.birthYear,
    deathYear: payload?.deathYear !== undefined ? payload.deathYear : existing.deathYear,
    status: payload?.status ?? existing.status,
    slug: payload?.slug ?? existing.slug,
  });
  input.slug = await ensureUniqueSlug(input.slug, num);

  await db.query(
    `UPDATE literature_writers
     SET slug = ?, poet_name_original = ?, poet_name_latin = ?, life_span = ?,
         birth_year = ?, death_year = ?, birthplace_original = ?, birthplace_latin = ?,
         biography_plain_original = ?, biography_latin = ?, biography_original = ?,
         content_hash = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      input.slug,
      input.poetNameOriginal,
      input.poetNameLatin,
      input.lifeSpan,
      input.birthYear,
      input.deathYear,
      input.birthplaceOriginal,
      input.birthplaceLatin,
      input.biographyPlainOriginal,
      input.biographyLatin,
      input.biographyPlainOriginal,
      input.contentHash,
      input.status,
      num,
    ]
  );

  return getWriterAdmin(num);
}

export async function deleteWriterAdmin(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num < 1) throw httpError('Shoir ID qáte');
  const existing = await getWriterAdmin(num);
  // Cross-DB: creative_works kk_poetrys’da — aldin óshiremiz
  await poetryDb.query('DELETE FROM writer_creative_works WHERE writer_id = ?', [num]);
  await db.query('DELETE FROM literature_writers WHERE id = ?', [num]);
  return {
    deleted: true,
    id: num,
    slug: existing.slug,
    removedCreative: existing.creativeCount || 0,
    removedBooks: existing.bookCount || 0,
  };
}

/** Shoirge qısqa dóretiwshilik jumısın qosadı (qosıq / dóretpe). */
export async function saveCreativeWorkAdmin(writerId, payload) {
  const wid = Number(writerId);
  if (!Number.isInteger(wid) || wid < 1) throw httpError('Shoir ID qáte');
  await getWriterAdmin(wid);

  const titleRaw = String(payload?.title || '').trim();
  if (titleRaw.length < 2) throw httpError('Jumıs atı kerek');
  const bodyRaw = String(payload?.body || '').trim();
  const titleCyr = toCyrillic(titleRaw);
  const titleLat = toLatin(titleRaw);
  const bodyCyr = bodyRaw ? toCyrillic(bodyRaw) : null;
  const bodyLat = bodyRaw ? toLatin(bodyRaw) : null;
  const workType = String(payload?.workType || 'qosıq').trim().slice(0, 40) || 'qosıq';
  const yearLabel = String(payload?.yearLabel || '').trim().slice(0, 80);
  const AVAIL = new Set(['in_library', 'mentioned_only', 'not_imported']);
  const availability = AVAIL.has(String(payload?.availability || ''))
    ? String(payload.availability)
    : null;
  let slug = String(payload?.slug || '').trim() || slugifyWriterName(titleLat);
  slug = slug.slice(0, 160);
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) throw httpError('Jumıs slugı nadurıs');

  const workId = payload?.id ? Number(payload.id) : null;
  if (workId) {
    await poetryDb.query(
      `UPDATE writer_creative_works
       SET slug = ?, title_original = ?, title_latin = ?, work_type = ?, year_label = ?,
           body_text = ?, body_text_cyrillic = ?, body_text_latin = ?,
           content_hash = ?${availability ? ', availability = ?' : ''}
       WHERE id = ? AND writer_id = ?`,
      [
        slug,
        titleCyr,
        titleLat,
        workType,
        yearLabel,
        bodyCyr,
        bodyCyr,
        bodyLat,
        hashText(`${titleCyr}|${bodyRaw}|${workType}|${yearLabel}`),
        ...(availability ? [availability] : []),
        workId,
        wid,
      ]
    );
    return {
      id: workId,
      writerId: wid,
      slug,
      titleLatin: titleLat,
      titleCyrillic: titleCyr,
      availability: availability || undefined,
    };
  }

  const [[{ maxSort }]] = await poetryDb.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM writer_creative_works WHERE writer_id = ?',
    [wid]
  );
  // Unique slug per writer
  let uniqueSlug = slug;
  for (let i = 0; i < 10; i++) {
    const [[hit]] = await poetryDb.query(
      'SELECT id FROM writer_creative_works WHERE writer_id = ? AND slug = ? LIMIT 1',
      [wid, uniqueSlug]
    );
    if (!hit) break;
    uniqueSlug = `${slug}-${i + 2}`.slice(0, 160);
  }

  const [result] = await poetryDb.query(
    `INSERT INTO writer_creative_works
      (writer_id, slug, title_original, title_latin, work_type, year_label,
       body_text, body_text_cyrillic, body_text_latin, availability, sort_order, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      wid,
      uniqueSlug,
      titleCyr,
      titleLat,
      workType,
      yearLabel,
      bodyCyr,
      bodyCyr,
      bodyLat,
      availability || 'not_imported',
      Number(maxSort) + 1,
      hashText(`${titleCyr}|${bodyRaw}|${workType}|${yearLabel}`),
    ]
  );
  return {
    id: result.insertId,
    writerId: wid,
    slug: uniqueSlug,
    titleLatin: titleLat,
    titleCyrillic: titleCyr,
  };
}

export async function deleteCreativeWorkAdmin(writerId, workId) {
  const [result] = await poetryDb.query(
    'DELETE FROM writer_creative_works WHERE id = ? AND writer_id = ?',
    [Number(workId), Number(writerId)]
  );
  if (!result.affectedRows) throw httpError('Jumıs tabılmadı', 404);
  return { deleted: true, id: Number(workId) };
}

// ---------------------------------------------------------------------------
// Vaqt mashinasi — shoir rasmları
// ---------------------------------------------------------------------------

function mapPhoto(row, script = 'latin') {
  const captionCyr = row.caption_original || '';
  const captionLat = row.caption_latin || (captionCyr ? toLatin(captionCyr) : '');
  const captionCyrResolved = captionCyr || (captionLat ? toCyrillic(captionLat) : '');
  return {
    id: row.id,
    writerId: row.writer_id,
    year: row.year != null ? Number(row.year) : null,
    caption: script === 'latin' ? captionLat || captionCyrResolved : captionCyrResolved || captionLat,
    captionLatin: captionLat,
    captionCyrillic: captionCyrResolved,
    imageUrl: row.image_url,
    storedName: row.stored_name || null,
    sortOrder: row.sort_order ?? 0,
  };
}

export async function listWriterPhotos(writerId, { script = 'latin' } = {}) {
  const wid = Number(writerId);
  const [rows] = await db.query(
    `SELECT id, writer_id, year, caption_original, caption_latin, image_url, stored_name, sort_order
     FROM writer_photos WHERE writer_id = ?
     ORDER BY (year IS NULL), year ASC, sort_order ASC, id ASC`,
    [wid]
  );
  return rows.map((r) => mapPhoto(r, script));
}

export async function addWriterPhoto(writerId, payload, file = null) {
  const wid = Number(writerId);
  if (!Number.isInteger(wid) || wid < 1) throw httpError('Shoir ID qáte');
  await getWriterAdmin(wid);

  let imageUrl = String(payload?.imageUrl || '').trim();
  let storedName = null;
  if (file?.filename) {
    storedName = file.filename;
    imageUrl = `/uploads/writers/${encodeURIComponent(storedName)}`;
  }
  if (!imageUrl) throw httpError('Rasm faylı yamasa imageUrl kerek');
  if (imageUrl.length > 500) throw httpError('Rasm URL uzın');

  const captionRaw = String(payload?.caption || '').trim();
  const captionCyr = captionRaw ? toCyrillic(captionRaw) : null;
  const captionLat = captionRaw ? toLatin(captionRaw) : null;
  let year = null;
  if (payload?.year !== '' && payload?.year != null) {
    year = Number.parseInt(payload.year, 10);
    if (!Number.isInteger(year) || year < 700 || year > 2100) {
      throw httpError('Jıl 700–2100 aralıǵında bolıwı kerek');
    }
  }

  const [[{ maxSort }]] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM writer_photos WHERE writer_id = ?',
    [wid]
  );

  const [result] = await db.query(
    `INSERT INTO writer_photos
      (writer_id, year, caption_original, caption_latin, image_url, stored_name, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [wid, year, captionCyr, captionLat, imageUrl, storedName, Number(maxSort) + 1]
  );
  const [[row]] = await db.query('SELECT * FROM writer_photos WHERE id = ?', [result.insertId]);
  return mapPhoto(row, 'latin');
}

export async function updateWriterPhoto(writerId, photoId, payload) {
  const wid = Number(writerId);
  const pid = Number(photoId);
  const [[existing]] = await db.query(
    'SELECT * FROM writer_photos WHERE id = ? AND writer_id = ? LIMIT 1',
    [pid, wid]
  );
  if (!existing) throw httpError('Rasm tabılmadı', 404);

  let year = existing.year;
  if (payload?.year !== undefined) {
    if (payload.year === '' || payload.year == null) year = null;
    else {
      year = Number.parseInt(payload.year, 10);
      if (!Number.isInteger(year) || year < 700 || year > 2100) {
        throw httpError('Jıl 700–2100 aralıǵında bolıwı kerek');
      }
    }
  }

  let captionCyr = existing.caption_original;
  let captionLat = existing.caption_latin;
  if (payload?.caption !== undefined) {
    const captionRaw = String(payload.caption || '').trim();
    captionCyr = captionRaw ? toCyrillic(captionRaw) : null;
    captionLat = captionRaw ? toLatin(captionRaw) : null;
  }

  await db.query(
    `UPDATE writer_photos
     SET year = ?, caption_original = ?, caption_latin = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND writer_id = ?`,
    [year, captionCyr, captionLat, pid, wid]
  );
  const [[row]] = await db.query('SELECT * FROM writer_photos WHERE id = ?', [pid]);
  return mapPhoto(row, 'latin');
}

export async function deleteWriterPhoto(writerId, photoId) {
  const [[existing]] = await db.query(
    'SELECT id, stored_name FROM writer_photos WHERE id = ? AND writer_id = ? LIMIT 1',
    [Number(photoId), Number(writerId)]
  );
  if (!existing) throw httpError('Rasm tabılmadı', 404);
  await db.query('DELETE FROM writer_photos WHERE id = ?', [existing.id]);
  if (existing.stored_name) deleteStoredWriterPhoto(existing.stored_name);
  return { deleted: true, id: existing.id, storedName: existing.stored_name };
}

// ----- literature_pieces (kitap oqıw bólimleri) -----

const PIECE_STATUSES = new Set(['published', 'draft', 'skipped']);
let pieceStatusReady = false;

export async function ensurePieceStatusColumn() {
  if (pieceStatusReady) return;
  try {
    await poetryDb.query(
      `ALTER TABLE literature_pieces
       ADD COLUMN status ENUM('published','draft','skipped') NOT NULL DEFAULT 'published'`
    );
  } catch (err) {
    if (err?.code !== 'ER_DUP_FIELDNAME' && err?.errno !== 1060) {
      const msg = String(err?.message || '');
      if (!/Duplicate column/i.test(msg)) throw err;
    }
  }
  pieceStatusReady = true;
}

function parseParagraphsInput(raw) {
  if (raw == null) return [];
  let list = raw;
  if (typeof raw === 'string') {
    list = raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(list)) throw httpError('paragraphs massiv yamasa tekst bolıwı kerek');
  return list.map((p) => String(p ?? '').trim()).filter(Boolean);
}

function mapAdminPiece(row) {
  if (!row) return null;
  const parse = (raw) => {
    try {
      const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      return Array.isArray(v) ? v.map((x) => String(x ?? '')) : [];
    } catch {
      return [];
    }
  };
  const parasCyr = parse(row.paragraphs_cyrillic_json);
  const parasLat = parse(row.paragraphs_latin_json);
  const parasStored = parse(row.paragraphs_json);
  return {
    id: row.id,
    bookId: row.book_id,
    writerId: row.writer_id != null ? Number(row.writer_id) : null,
    title: row.title_latin || row.title_original,
    titleLatin: row.title_latin || '',
    titleCyrillic: row.title_original || '',
    paragraphs: parasLat.length ? parasLat : parasStored,
    paragraphsLatin: parasLat.length ? parasLat : parasStored.map((x) => toLatin(x)),
    paragraphsCyrillic: parasCyr.length ? parasCyr : parasStored.map((x) => toCyrillic(x)),
    workYear: row.work_year != null ? Number(row.work_year) : null,
    workDateLabel: row.work_date_label_latin || row.work_date_label_original || '',
    workPlace: row.work_place_latin || row.work_place_original || '',
    sortOrder: Number(row.sort_order) || 0,
    status: row.status || 'published',
    isHidden: (row.status || 'published') === 'skipped',
    bookTitle: row.book_title || null,
    writerName: row.writer_name_latin || row.writer_name_original || null,
  };
}

export async function listPiecesAdmin({
  q = '',
  bookId = '',
  writerId = '',
  status = '',
  page = 1,
  limit = 40,
} = {}) {
  await ensurePieceStatusColumn();
  const safeLimit = clampLimit(limit, 40, 100);
  const safePage = clampPage(page);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  if (bookId) {
    where.push('p.book_id = ?');
    params.push(String(bookId).trim().slice(0, 64));
  }
  if (writerId !== '' && writerId != null) {
    const wid = Number(writerId);
    if (Number.isFinite(wid) && wid > 0) {
      where.push('p.writer_id = ?');
      params.push(wid);
    }
  }
  if (status) {
    if (!PIECE_STATUSES.has(status)) throw httpError('status published|draft|skipped');
    where.push('p.status = ?');
    params.push(status);
  }
  const query = String(q || '').trim();
  if (query) {
    const like = `%${query}%`;
    where.push(
      `(p.id LIKE ? OR p.title_original LIKE ? OR p.title_latin LIKE ? OR p.book_id LIKE ?)`
    );
    params.push(like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await poetryDb.query(
    `SELECT COUNT(*) AS total FROM literature_pieces p ${whereSql}`,
    params
  );
  const [rows] = await poetryDb.query(
    `SELECT p.*,
            b.title AS book_title,
            w.poet_name_latin AS writer_name_latin,
            w.poet_name_original AS writer_name_original
     FROM literature_pieces p
     LEFT JOIN books b ON b.id = p.book_id
     LEFT JOIN \`${DB.poets}\`.literature_writers w ON w.id = p.writer_id
     ${whereSql}
     ORDER BY p.book_id ASC, p.sort_order ASC, p.id ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    items: rows.map(mapAdminPiece),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
  };
}

export async function getPieceAdmin(id) {
  await ensurePieceStatusColumn();
  const key = String(id || '').trim();
  if (!key) throw httpError('Piece id kerek');
  const [[row]] = await poetryDb.query(
    `SELECT p.*,
            b.title AS book_title,
            w.poet_name_latin AS writer_name_latin,
            w.poet_name_original AS writer_name_original
     FROM literature_pieces p
     LEFT JOIN books b ON b.id = p.book_id
     LEFT JOIN \`${DB.poets}\`.literature_writers w ON w.id = p.writer_id
     WHERE p.id = ? LIMIT 1`,
    [key]
  );
  if (!row) throw httpError('Bólek tabılmadı', 404);
  return mapAdminPiece(row);
}

export async function savePieceAdmin(payload = {}) {
  await ensurePieceStatusColumn();
  const bookId = String(payload.bookId || payload.book_id || '').trim().slice(0, 64);
  if (!bookId) throw httpError('bookId kerek');

  const [[book]] = await poetryDb.query(`SELECT id FROM books WHERE id = ? LIMIT 1`, [bookId]);
  if (!book) throw httpError('Kitap tabılmadı', 404);

  let writerId;
  if (payload.writerId !== undefined) {
    if (payload.writerId === null || payload.writerId === '') {
      writerId = null;
    } else {
      writerId = Number(payload.writerId);
      if (!Number.isFinite(writerId) || writerId < 1) throw httpError('writerId qáte');
      const [[w]] = await poetryDb.query(
        `SELECT id FROM \`${DB.poets}\`.literature_writers WHERE id = ? LIMIT 1`,
        [writerId]
      );
      if (!w) throw httpError('Shoir tabılmadı', 404);
    }
  }

  const titleRaw = String(payload.title || '').trim();
  if (titleRaw.length < 1) throw httpError('Atı kerek');
  const titleCyr = toCyrillic(titleRaw).slice(0, 250);
  const titleLat = toLatin(titleRaw).slice(0, 250);

  const paragraphs = parseParagraphsInput(payload.paragraphs);
  if (!paragraphs.length) throw httpError('Keminde 1 paragraf kerek');
  const parasCyr = paragraphs.map((p) => toCyrillic(p));
  const parasLat = paragraphs.map((p) => toLatin(p));

  let workYear = null;
  if (payload.workYear != null && payload.workYear !== '') {
    workYear = Number.parseInt(payload.workYear, 10);
    if (!Number.isInteger(workYear) || workYear < 700 || workYear > 2100) {
      throw httpError('workYear 700–2100');
    }
  }

  const dateRaw = String(payload.workDateLabel || '').trim().slice(0, 120);
  const placeRaw = String(payload.workPlace || '').trim().slice(0, 255);
  const dateCyr = dateRaw ? toCyrillic(dateRaw) : null;
  const dateLat = dateRaw ? toLatin(dateRaw) : null;
  const placeCyr = placeRaw ? toCyrillic(placeRaw) : null;
  const placeLat = placeRaw ? toLatin(placeRaw) : null;

  let status = String(payload.status || 'published').trim();
  if (!PIECE_STATUSES.has(status)) status = 'published';

  let sortOrder =
    payload.sortOrder != null && payload.sortOrder !== ''
      ? Number(payload.sortOrder)
      : null;
  if (sortOrder != null && !Number.isFinite(sortOrder)) throw httpError('sortOrder qáte');

  const existingId = payload.id ? String(payload.id).trim().slice(0, 80) : '';
  const contentHash = hashText(`${titleCyr}|${JSON.stringify(parasCyr)}|${workYear || ''}`);

  if (existingId) {
    const [[existing]] = await poetryDb.query(
      `SELECT id, writer_id, sort_order FROM literature_pieces WHERE id = ? LIMIT 1`,
      [existingId]
    );
    if (!existing) throw httpError('Bólek tabılmadı', 404);
    if (writerId === undefined) writerId = existing.writer_id;
    if (sortOrder == null) sortOrder = Number(existing.sort_order) || 0;

    await poetryDb.query(
      `UPDATE literature_pieces SET
         book_id = ?, writer_id = ?, title_original = ?, title_latin = ?,
         paragraphs_json = ?, paragraphs_cyrillic_json = ?, paragraphs_latin_json = ?,
         work_year = ?, work_date_label_original = ?, work_date_label_latin = ?,
         work_place_original = ?, work_place_latin = ?,
         sort_order = ?, content_hash = ?, status = ?
       WHERE id = ?`,
      [
        bookId,
        writerId,
        titleCyr,
        titleLat,
        JSON.stringify(parasCyr),
        JSON.stringify(parasCyr),
        JSON.stringify(parasLat),
        workYear,
        dateCyr,
        dateLat,
        placeCyr,
        placeLat,
        sortOrder,
        contentHash,
        status,
        existingId,
      ]
    );
    return getPieceAdmin(existingId);
  }

  if (writerId === undefined) writerId = null;

  if (sortOrder == null) {
    const [[{ mx }]] = await poetryDb.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS mx FROM literature_pieces WHERE book_id = ?`,
      [bookId]
    );
    sortOrder = Number(mx) + 1;
  }

  let id = String(payload.newId || '').trim().slice(0, 80);
  if (!id) {
    id = `${bookId}-p${sortOrder}-${crypto.randomBytes(3).toString('hex')}`.slice(0, 80);
  }

  await poetryDb.query(
    `INSERT INTO literature_pieces
      (id, book_id, writer_id, title_original, title_latin,
       paragraphs_json, paragraphs_cyrillic_json, paragraphs_latin_json,
       work_year, work_date_label_original, work_date_label_latin,
       work_place_original, work_place_latin,
       sort_order, content_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      bookId,
      writerId,
      titleCyr,
      titleLat,
      JSON.stringify(parasCyr),
      JSON.stringify(parasCyr),
      JSON.stringify(parasLat),
      workYear,
      dateCyr,
      dateLat,
      placeCyr,
      placeLat,
      sortOrder,
      contentHash,
      status,
    ]
  );
  return getPieceAdmin(id);
}

export async function hidePieceAdmin(id) {
  await ensurePieceStatusColumn();
  const key = String(id || '').trim();
  const [[row]] = await poetryDb.query(
    `SELECT id FROM literature_pieces WHERE id = ? LIMIT 1`,
    [key]
  );
  if (!row) throw httpError('Bólek tabılmadı', 404);
  await poetryDb.query(`UPDATE literature_pieces SET status = 'skipped' WHERE id = ?`, [key]);
  return getPieceAdmin(key);
}

export async function restorePieceAdmin(id) {
  await ensurePieceStatusColumn();
  const key = String(id || '').trim();
  const [[row]] = await poetryDb.query(
    `SELECT id FROM literature_pieces WHERE id = ? LIMIT 1`,
    [key]
  );
  if (!row) throw httpError('Bólek tabılmadı', 404);
  await poetryDb.query(`UPDATE literature_pieces SET status = 'published' WHERE id = ?`, [key]);
  return getPieceAdmin(key);
}

export async function deletePieceAdmin(id) {
  await ensurePieceStatusColumn();
  const key = String(id || '').trim();
  const [result] = await poetryDb.query(`DELETE FROM literature_pieces WHERE id = ?`, [key]);
  if (!result.affectedRows) throw httpError('Bólek tabılmadı', 404);
  return { deleted: true, id: key };
}
