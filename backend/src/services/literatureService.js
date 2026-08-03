import { pools, DB } from '../config/db.js';
import searchFold from '../utils/searchFold.js';
import { detectScript, toCyrillic, toLatin } from '../utils/qqScript.js';
import { ensurePieceStatusColumn } from './literatureAdminService.js';

// Uy bazasi: kk_poetrys (books, pieces, creative_works). Shoir jadvallari
// (literature_writers, writer_aliases, book_writers) kk_poets’da — to‘liq nom bilan.
const db = pools.poetrys;

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

const SCRIPTS = new Set(['original', 'latin', 'cyrillic']);

/**
 * Yagona kontrakt: 'cyrillic' | 'latin'.
 * 'original' → 'cyrillic' (eski URL/localStorage uyumluligi).
 */
export function normalizeScript(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'cyrillic';
  if (!SCRIPTS.has(s)) {
    throw httpError('script "cyrillic", "latin" yamasa "original" bolıwı kerek');
  }
  return s === 'latin' ? 'latin' : 'cyrillic';
}

function clampLimit(raw, fallback = 48, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

function clampPage(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/** Tuwılǵan jıldan ásir nomeri (1827 → 19). */
function centuryOf(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 700 || y > 2100) return null;
  return Math.floor((y - 1) / 100) + 1;
}

const ROMAN = { 8: 'VIII', 9: 'IX', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX', 21: 'XXI' };

function romanCentury(century) {
  if (century == null) return null;
  if (ROMAN[century]) return ROMAN[century];
  const map = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = century;
  let out = '';
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function mapWriter(row, { script = 'cyrillic', includeBio = false } = {}) {
  if (!row) return null;
  const namePair = pickScriptPair(
    null,
    row.poet_name_latin,
    row.poet_name_original,
    script
  );
  const bioPair = pickScriptPair(
    null,
    row.biography_latin,
    row.biography_plain_original || '',
    script
  );
  const placePair = pickScriptPair(
    null,
    row.birthplace_latin,
    row.birthplace_original,
    script
  );
  const birthYear = row.birth_year != null ? Number(row.birth_year) : null;
  const deathYear = row.death_year != null ? Number(row.death_year) : null;
  const birthMonth = row.birth_month != null ? Number(row.birth_month) : null;
  const birthDay = row.birth_day != null ? Number(row.birth_day) : null;
  const century = centuryOf(birthYear);
  const bookCount = row.book_count != null ? Number(row.book_count) : undefined;
  const out = {
    id: row.id,
    sourceId: row.source_id,
    slug: row.slug,
    name: namePair.display,
    nameOriginal: namePair.original,
    nameLatin: namePair.latin,
    nameCyrillic: namePair.cyrillic,
    poetNameOriginal: namePair.original,
    poetNameLatin: namePair.latin,
    poetNameCyrillic: namePair.cyrillic,
    lifeSpan: row.life_span || '',
    birthYear,
    deathYear,
    birthMonth,
    birthDay,
    birthDate: row.birth_date || null,
    birthPrecision: row.birth_precision || 'year',
    birthplace: placePair.display || null,
    birthplaceOriginal: placePair.original || null,
    birthplaceLatin: placePair.latin || null,
    birthplaceCyrillic: placePair.cyrillic || null,
    coordinates:
      row.birth_lat != null && row.birth_lng != null
        ? { lat: Number(row.birth_lat), lng: Number(row.birth_lng) }
        : null,
    geocodeStatus: row.geocode_status || 'none',
    age: birthYear && deathYear && deathYear > birthYear ? deathYear - birthYear : null,
    century,
    centuryRoman: romanCentury(century),
    ...(bookCount !== undefined ? { bookCount, hasBooks: bookCount > 0 } : {}),
    status: row.status,
  };
  if (includeBio) {
    out.biographyPlainOriginal = bioPair.original;
    out.biographyCyrillic = bioPair.cyrillic;
    out.biographyLatin = bioPair.latin;
    out.biography = bioPair.display;
    out.biographyParagraphs = String(out.biography || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    try {
      out.facts = row.facts_json
        ? typeof row.facts_json === 'string'
          ? JSON.parse(row.facts_json)
          : row.facts_json
        : null;
    } catch {
      out.facts = null;
    }
  }
  return out;
}

/**
 * Script pair: hech qashan qarama-qarshi alifboni xom fallback qilmaydı.
 * Yetishmasa — transliteratsiya; transliteratsiya ham bo'sh bolsa — bo'sh.
 */
function pickScriptPair(cyrillic, latin, stored, script) {
  let cyr = cyrillic || '';
  let lat = latin || '';
  const storedVal = stored || '';
  if (!cyr && storedVal) {
    const det = detectScript(storedVal);
    if (det === 'latin') {
      if (!lat) lat = storedVal;
    } else {
      // cyrillic / mixed / unknown — Cyrillic ustuniga saqlaymız
      cyr = storedVal;
    }
  }
  if (!lat && cyr) lat = toLatin(cyr);
  if (!cyr && lat) cyr = toCyrillic(lat);
  if (script === 'latin') return { display: lat, cyrillic: cyr, latin: lat, original: cyr };
  return { display: cyr, cyrillic: cyr, latin: lat, original: cyr };
}

function mapBookLite(row, { script = 'cyrillic' } = {}) {
  const titlePair = pickScriptPair(row.title_original, row.title_latin, row.title, script);
  const authorPair = pickScriptPair(row.author_original, row.author_latin, row.author, script);
  const descPair = pickScriptPair(
    row.description_original,
    row.description_latin,
    row.description,
    script
  );
  return {
    id: row.id,
    title: titlePair.display,
    titleOriginal: titlePair.original,
    titleCyrillic: titlePair.cyrillic,
    titleLatin: titlePair.latin,
    author: authorPair.display,
    authorOriginal: authorPair.original,
    authorCyrillic: authorPair.cyrillic,
    authorLatin: authorPair.latin,
    years: row.years || '',
    genre: row.genre,
    description: descPair.display,
    descriptionOriginal: descPair.original,
    descriptionCyrillic: descPair.cyrillic,
    descriptionLatin: descPair.latin,
    workKind: row.work_kind || 'book',
    importStatus: row.import_status || null,
    originalScript: row.original_script || null,
  };
}

export async function listWriters({
  q = '',
  letter = '',
  works = '',
  century = '',
  script = 'original',
  page = 1,
  limit = 48,
} = {}) {
  const safeScript = normalizeScript(script);
  const safeLimit = clampLimit(limit);
  const safePage = clampPage(page);
  const offset = (safePage - 1) * safeLimit;
  const where = [`status = 'published'`];
  const params = [];

  // works: 'with' → tek kitabı barlar, 'without' → kitabı joqlar
  const worksFilter = String(works || '').trim().toLowerCase();
  if (worksFilter && !['with', 'without'].includes(worksFilter)) {
    throw httpError('works "with" yamasa "without" bolıwı kerek');
  }
  if (worksFilter === 'with') {
    where.push(`id IN (SELECT writer_id FROM ${DB.poets}.book_writers)`);
  } else if (worksFilter === 'without') {
    where.push(`id NOT IN (SELECT writer_id FROM ${DB.poets}.book_writers)`);
  }

  // century: tuwılǵan ásir boyınsha (mısalı 19 → 1801-1900)
  const centuryRaw = String(century || '').trim();
  if (centuryRaw) {
    const n = Number(centuryRaw);
    if (!Number.isInteger(n) || n < 8 || n > 21) {
      throw httpError('century 8 hám 21 aralıǵındaǵı pútin san bolıwı kerek');
    }
    where.push('birth_year BETWEEN ? AND ?');
    params.push((n - 1) * 100 + 1, n * 100);
  }

  const query = String(q || '').trim();
  if (query) {
    // Eki jazıwdaǵı variantlar hám folded alias arqalı izlew (parametrlengen)
    const fold = searchFold(query);
    const variants = [...new Set([query, toLatin(query), toCyrillic(query)].filter(Boolean))];
    const nameClauses = [];
    for (const v of variants) {
      nameClauses.push('poet_name_original LIKE ?', 'poet_name_latin LIKE ?', 'slug LIKE ?');
      const like = `%${v}%`;
      params.push(like, like, like);
    }
    nameClauses.push(
      `id IN (SELECT writer_id FROM ${DB.poets}.writer_aliases
              WHERE alias_original LIKE ? OR alias_latin LIKE ? OR alias_fold LIKE ?)`
    );
    params.push(`%${query}%`, `%${query}%`, `%${fold}%`);
    where.push(`(${nameClauses.join(' OR ')})`);
  }

  const letterRaw = String(letter || '').trim().slice(0, 2);
  if (letterRaw) {
    if (safeScript === 'latin') {
      where.push(`poet_name_latin LIKE ?`);
      params.push(`${letterRaw}%`);
    } else {
      where.push(`poet_name_original LIKE ?`);
      params.push(`${letterRaw}%`);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderCol = safeScript === 'latin' ? 'poet_name_latin' : 'poet_name_original';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM ${DB.poets}.literature_writers ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT id, source_id, slug, poet_name_original, poet_name_latin, life_span,
            birth_year, death_year, status,
            (SELECT COUNT(*) FROM ${DB.poets}.book_writers bw WHERE bw.writer_id = literature_writers.id)
              AS book_count
     FROM ${DB.poets}.literature_writers
     ${whereSql}
     ORDER BY ${orderCol} ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    writers: rows.map((r) => mapWriter(r, { script: safeScript })),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    facets: await writersFacets(),
  };
}

// Facet sanları siyrek ózgeredi — qısqa kesh jetkilikli.
let facetsCache = null;
const FACETS_TTL_MS = 5 * 60 * 1000;

async function writersFacets() {
  if (facetsCache && Date.now() - facetsCache.at < FACETS_TTL_MS) return facetsCache.value;
  const [[counts]] = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(id IN (SELECT writer_id FROM ${DB.poets}.book_writers)) AS withBooks
     FROM ${DB.poets}.literature_writers WHERE status = 'published'`
  );
  const [centuryRows] = await db.query(
    `SELECT FLOOR((birth_year - 1) / 100) + 1 AS century, COUNT(*) AS count
     FROM ${DB.poets}.literature_writers
     WHERE status = 'published' AND birth_year IS NOT NULL
     GROUP BY century ORDER BY century ASC`
  );
  const value = {
    total: Number(counts.total) || 0,
    withBooks: Number(counts.withBooks) || 0,
    withoutBooks: (Number(counts.total) || 0) - (Number(counts.withBooks) || 0),
    centuries: centuryRows
      .filter((r) => r.century >= 8 && r.century <= 21)
      .map((r) => ({
        century: Number(r.century),
        roman: romanCentury(Number(r.century)),
        count: Number(r.count),
      })),
  };
  facetsCache = { at: Date.now(), value };
  return value;
}

export async function getWriterBySlug(slug, { script = 'original' } = {}) {
  const safeScript = normalizeScript(script);
  const key = String(slug || '').trim();
  if (!key || key.length > 128) throw httpError('Slug kerek');
  const [[row]] = await db.query(
    `SELECT id, source_id, slug, poet_name_original, poet_name_latin, life_span,
            birth_year, death_year, birth_month, birth_day, birth_date, birth_precision,
            birthplace_original, birthplace_latin, birth_lat, birth_lng, geocode_status,
            facts_json, biography_plain_original, biography_latin, status
     FROM ${DB.poets}.literature_writers
     WHERE slug = ? AND status = 'published'
     LIMIT 1`,
    [key]
  );
  if (!row) throw httpError('Jazıwshı tabılmadı', 404);

  const [books] = await db.query(
    `SELECT b.id, b.title, b.title_original, b.title_latin,
            b.author, b.author_original, b.author_latin,
            b.years, b.genre, b.description, b.description_original, b.description_latin,
            b.work_kind, b.import_status, b.original_script
     FROM ${DB.poets}.book_writers bw
     JOIN books b ON b.id = bw.book_id
     WHERE bw.writer_id = ?
     ORDER BY bw.sort_order ASC, b.title ASC`,
    [row.id]
  );

  const [creativeRows] = await db.query(
    `SELECT id, slug, title_original, title_latin, work_type, year_label,
            body_text, body_text_cyrillic, body_text_latin,
            linked_book_id, linked_section_index, availability, sort_order
     FROM writer_creative_works
     WHERE writer_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [row.id]
  );

  const creativeWorks = creativeRows.map((cw) => {
    const titleOriginal = cw.title_original || '';
    const titleLatin = cw.title_latin || (titleOriginal ? toLatin(titleOriginal) : '');
    // work_type / year_label bazada latın túrinde saqlanadı — kirill ushın transliteratsiya
    const workTypeLat = cw.work_type || 'other';
    const workTypeCyr = toCyrillic(workTypeLat === 'other' ? 'basqa' : workTypeLat);
    const yearLat = cw.year_label || '';
    const yearCyr = yearLat ? toCyrillic(yearLat) : '';
    const bodyCyr = cw.body_text_cyrillic || null;
    const bodyLat =
      cw.body_text_latin ||
      (cw.body_text && /[A-Za-záǵıńóúÁǴÍŃÓÚ]/.test(cw.body_text) ? cw.body_text : null) ||
      (bodyCyr ? toLatin(bodyCyr) : null);
    const bodyCyrResolved = bodyCyr || (cw.body_text && /[А-Яа-яӘә]/.test(cw.body_text) ? cw.body_text : null);
    return {
      id: cw.id,
      slug: cw.slug,
      title: safeScript === 'latin' ? titleLatin || titleOriginal : titleOriginal || titleLatin,
      titleOriginal,
      titleCyrillic: titleOriginal,
      titleLatin,
      workType: safeScript === 'latin' ? workTypeLat : workTypeCyr,
      workTypeLatin: workTypeLat,
      workTypeCyrillic: workTypeCyr,
      yearLabel: safeScript === 'latin' ? yearLat : yearCyr,
      yearLabelLatin: yearLat,
      yearLabelCyrillic: yearCyr,
      bodyText:
        safeScript === 'latin'
          ? bodyLat || bodyCyrResolved || cw.body_text || null
          : bodyCyrResolved || (bodyLat ? toCyrillic(bodyLat) : cw.body_text) || null,
      bodyTextCyrillic: bodyCyrResolved,
      bodyTextLatin: bodyLat,
      linkedBookId: cw.linked_book_id,
      linkedSectionIndex: cw.linked_section_index == null ? null : Number(cw.linked_section_index),
      availability: cw.availability || 'mentioned_only',
    };
  });

  return {
    writer: mapWriter(row, { script: safeScript, includeBio: true }),
    books: books.map((b) => mapBookLite(b, { script: safeScript })),
    creativeWorks,
    photos: await listPhotosForWriter(row.id, safeScript),
  };
}

async function listPhotosForWriter(writerId, script) {
  const [rows] = await db.query(
    `SELECT id, writer_id, year, caption_original, caption_latin, image_url, stored_name, sort_order
     FROM ${DB.poets}.writer_photos WHERE writer_id = ?
     ORDER BY (year IS NULL), year ASC, sort_order ASC, id ASC`,
    [writerId]
  );
  return rows.map((row) => {
    const captionCyr = row.caption_original || '';
    const captionLat = row.caption_latin || (captionCyr ? toLatin(captionCyr) : '');
    const captionCyrResolved = captionCyr || (captionLat ? toCyrillic(captionLat) : '');
    return {
      id: row.id,
      year: row.year != null ? Number(row.year) : null,
      caption: script === 'latin' ? captionLat || captionCyrResolved : captionCyrResolved || captionLat,
      captionLatin: captionLat,
      captionCyrillic: captionCyrResolved,
      imageUrl: row.image_url,
      sortOrder: row.sort_order ?? 0,
    };
  });
}

export async function listWorks({
  q = '',
  writer = null,
  writerId = null,
  bookId = null,
  script = 'original',
  page = 1,
  limit = 40,
} = {}) {
  const safeScript = normalizeScript(script);
  const safeLimit = clampLimit(limit, 40);
  const safePage = clampPage(page);
  const offset = (safePage - 1) * safeLimit;
  const where = ['1=1'];
  const params = [];

  // writer — slug yamasa san ID; writerId — tek san ID
  let writerNum = null;
  const writerRaw = String(writer ?? writerId ?? '').trim();
  if (writerRaw) {
    if (/^\d+$/.test(writerRaw)) {
      writerNum = Number(writerRaw);
    } else {
      const [[w]] = await db.query(
        `SELECT id FROM ${DB.poets}.literature_writers WHERE slug = ? AND status = 'published' LIMIT 1`,
        [writerRaw]
      );
      if (!w) throw httpError('Jazıwshı tabılmadı', 404);
      writerNum = w.id;
    }
  }
  if (writerNum != null) {
    where.push(
      `b.id IN (SELECT book_id FROM ${DB.poets}.book_writers WHERE writer_id = ?)`
    );
    params.push(writerNum);
  }
  if (bookId) {
    where.push('b.id = ?');
    params.push(String(bookId));
  }
  const query = String(q || '').trim();
  if (query) {
    const variants = [...new Set([query, toLatin(query), toCyrillic(query)].filter(Boolean))];
    const clauses = [];
    for (const v of variants) {
      const like = `%${v}%`;
      clauses.push(
        `(b.title LIKE ? OR b.title_original LIKE ? OR b.title_latin LIKE ?
          OR b.author LIKE ? OR b.author_original LIKE ? OR b.author_latin LIKE ?
          OR b.description LIKE ? OR b.description_original LIKE ? OR b.description_latin LIKE ?)`
      );
      params.push(like, like, like, like, like, like, like, like, like);
    }
    where.push(`(${clauses.join(' OR ')})`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM books b ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT b.id, b.title, b.title_original, b.title_latin,
            b.author, b.author_original, b.author_latin,
            b.years, b.genre, b.description, b.description_original, b.description_latin,
            b.work_kind, b.import_status, b.original_script
     FROM books b
     ${whereSql}
     ORDER BY b.title ASC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  // Barlıq kitaplardıń jazıwshıların bir soraw menen alamız (N+1 sorawdan qashamız)
  const writersByBook = new Map();
  if (rows.length) {
    const [writerRows] = await db.query(
      `SELECT bw.book_id, w.id, w.source_id, w.slug, w.poet_name_original,
              w.poet_name_latin, w.life_span, w.birth_year, w.death_year, w.status
       FROM ${DB.poets}.book_writers bw
       JOIN ${DB.poets}.literature_writers w ON w.id = bw.writer_id
       WHERE bw.book_id IN (?)
       ORDER BY bw.book_id, bw.sort_order ASC`,
      [rows.map((r) => r.id)]
    );
    for (const w of writerRows) {
      if (!writersByBook.has(w.book_id)) writersByBook.set(w.book_id, []);
      writersByBook.get(w.book_id).push(mapWriter(w, { script: safeScript }));
    }
  }
  const works = rows.map((row) => ({
    ...mapBookLite(row, { script: safeScript }),
    writers: writersByBook.get(row.id) || [],
  }));

  return {
    works,
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
  };
}

export async function getWorkPieces(bookId, { script = 'original' } = {}) {
  const safeScript = normalizeScript(script);
  const id = String(bookId || '').trim();
  if (!id || id.length > 64) throw httpError('Kitap ID kerek');

  const [[book]] = await db.query(
    `SELECT id, title, title_original, title_latin,
            author, author_original, author_latin,
            years, genre, description, description_original, description_latin,
            work_kind, import_status, original_script, source_type
     FROM books WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!book) throw httpError('Kitap tabılmadı', 404);

  const [writers] = await db.query(
    `SELECT w.id, w.source_id, w.slug, w.poet_name_original, w.poet_name_latin,
            w.life_span, w.birth_year, w.death_year, w.status
     FROM ${DB.poets}.book_writers bw
     JOIN ${DB.poets}.literature_writers w ON w.id = bw.writer_id
     WHERE bw.book_id = ?
     ORDER BY bw.sort_order ASC`,
    [id]
  );

  await ensurePieceStatusColumn();

  const [pieceRows] = await db.query(
    `SELECT id, book_id, writer_id, title_original, title_latin,
            paragraphs_json, paragraphs_cyrillic_json, paragraphs_latin_json,
            work_year, work_date_label_original, work_date_label_latin,
            work_place_original, work_place_latin, sort_order
     FROM literature_pieces
     WHERE book_id = ?
       AND status = 'published'
     ORDER BY sort_order ASC`,
    [id]
  );

  const parseParas = (raw) => {
    try {
      const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      return Array.isArray(v) ? v.map((x) => String(x ?? '')) : [];
    } catch {
      return [];
    }
  };

  const mapPiece = (p, i, fallbackTitle = null) => {
    const titlePair = pickScriptPair(
      null,
      p.title_latin,
      p.title_original || fallbackTitle || '',
      safeScript
    );
    const parasStored = parseParas(p.paragraphs_json);
    let parasCyr = parseParas(p.paragraphs_cyrillic_json);
    let parasLat = parseParas(p.paragraphs_latin_json);
    if (!parasCyr.length && parasStored.length) {
      // stored may be Cyrillic or Latin residue
      const sample = parasStored.join('\n').slice(0, 400);
      if (detectScript(sample) === 'latin') {
        parasLat = parasStored;
        parasCyr = parasStored.map((x) => toCyrillic(String(x)));
      } else {
        parasCyr = parasStored;
        parasLat = parasStored.map((x) => toLatin(String(x)));
      }
    }
    if (!parasLat.length && parasCyr.length) {
      parasLat = parasCyr.map((x) => toLatin(String(x)));
    }
    if (!parasCyr.length && parasLat.length) {
      parasCyr = parasLat.map((x) => toCyrillic(String(x)));
    }
    const isLatin = safeScript === 'latin';
    const datePair = pickScriptPair(
      null,
      p.work_date_label_latin,
      p.work_date_label_original,
      safeScript
    );
    const placePair = pickScriptPair(
      null,
      p.work_place_latin,
      p.work_place_original,
      safeScript
    );
    return {
      id: p.id,
      bookId: p.book_id || id,
      writerId: p.writer_id || null,
      title: titlePair.display,
      titleOriginal: titlePair.original,
      titleCyrillic: titlePair.cyrillic,
      titleLatin: titlePair.latin,
      paragraphs: isLatin ? parasLat : parasCyr,
      paragraphsOriginal: parasCyr,
      paragraphsCyrillic: parasCyr,
      paragraphsLatin: parasLat,
      workYear: p.work_year != null ? Number(p.work_year) : null,
      workDateLabel: datePair.display || null,
      workDateLabelCyrillic: datePair.cyrillic || null,
      workDateLabelLatin: datePair.latin || null,
      workPlace: placePair.display || null,
      workPlaceCyrillic: placePair.cyrillic || null,
      workPlaceLatin: placePair.latin || null,
      sectionIndex: i,
      sortOrder: p.sort_order ?? i,
    };
  };

  let pieces = pieceRows.map((p, i) => mapPiece(p, i));

  if (!pieces.length && book.source_type === 'text') {
    const [sections] = await db.query(
      `SELECT title, paragraphs_json AS paragraphsJson, sort_order AS sortOrder
       FROM book_sections WHERE book_id = ? ORDER BY sort_order ASC`,
      [id]
    );
    pieces = sections.map((s, i) =>
      mapPiece(
        {
          id: `${id}-s${i}`,
          book_id: id,
          writer_id: writers[0]?.id || null,
          title_original: s.title,
          title_latin: toLatin(s.title || ''),
          paragraphs_json: s.paragraphsJson,
          paragraphs_cyrillic_json: null,
          paragraphs_latin_json: null,
          work_year: null,
          work_date_label_original: null,
          work_date_label_latin: null,
          work_place_original: null,
          work_place_latin: null,
          sort_order: s.sortOrder,
        },
        i
      )
    );
  }

  return {
    work: mapBookLite(book, { script: safeScript }),
    writers: writers.map((w) => mapWriter(w, { script: safeScript })),
    pieces,
  };
}
