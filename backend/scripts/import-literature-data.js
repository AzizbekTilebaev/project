/**
 * Import writers, jumbaqlar and curated books from fordata/ into quiz_db.
 *
 * Usage:
 *   node scripts/import-literature-data.js             # dry-run (default)
 *   node scripts/import-literature-data.js --apply     # write to DB
 *   node scripts/import-literature-data.js --apply --reseed  # wipe literature rows first
 *
 * Originals are preserved as-is; derived (transliterated) values are secondary.
 * Audit JSON is written under backend/tmp/ (runtime artifact, not committed).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { QUIZ_DB_CONFIG } from '../src/config/quiz.db.js';
import searchFold from '../src/utils/searchFold.js';
import {
  detectScript,
  ensureScriptPair,
  normalizeSource,
  parseBioTimeline,
  parseBirthFacts,
  parseLifeSpan,
  parsePoemTrailingMeta,
  slugifyWriterName,
  stripHtmlToPlain,
  toCyrillic,
  toLatin,
} from '../src/utils/qqScript.js';
import { geocodeBirthplace } from './literaturePlaceGeocode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FORDATA_BOOKS = path.join(ROOT, 'fordata', 'books');
const FORDATA_JUMBAQ = path.join(ROOT, 'fordata', 'jumbaqlar', 'jumbaq-1.json');
const WRITERS_JSON = path.join(FORDATA_BOOKS, 'writers-qq-cyrillic.json');
const WRITERS_LATIN_JSON = path.join(ROOT, 'fordata', 'shayirlar latin', 'questions.json');
const MANIFEST_PATH = path.join(__dirname, 'import-literature-manifest.json');
const TMP_DIR = path.join(__dirname, '../tmp');

const APPLY = process.argv.includes('--apply');
const RESEED = process.argv.includes('--reseed');
const DRY_RUN = !APPLY;

// Parser logikası ózgergende sanın kóteriń — barlıq kitaplar qayta parse etiledi.
const PARSER_VERSION = 10;

/** Latin slug → known Cyrillic / alias bridges (klassikler). */
const LATIN_WRITER_ALIASES = {
  'ibrayim-yusupov': ['Юсупов Ибрайым', 'Ibrayım Yusupov', 'Ibrayim Yusupov'],
  'tolepbergen-qayipbergenov': [
    'Қайыпбергенов Төлепберген',
    'Tólepbergen Qayıpbergenov',
    'Tólepbergen Qaipbergenov',
  ],
  'kunxoja-ibrayim-uli': ['Күнхожа Ибрайым улы', 'Kúnxoja Ibrayım ulı', 'kunxoja-ibrayim-uly'],
  'jiyen-jiraw-amaliq-uli': [
    'Жийен Жыраў Аманлық улы',
    'Жийен Жыраў Тағай улы',
    'Jiyen Jıraw Amanlıq ulı',
    'Jiyen Jıraw Taǵay ulı',
    'jiyen-jiraw-tagay-uly',
  ],
  'berdaq-gargabay-uli': [
    'Бердақ Ғарғабай улы',
    'Berdaq Ǵarǵabay ulı',
    'berdaq-gargabay-uly',
  ],
  'ajiniyaz-qosibay-uli': [
    'Әжинияз Қосыбай улы',
    'Ájiniyaz Qosıbay ulı',
    'ajiniyaz-qosibay-uly',
    'Зийўар',
  ],
  'tilewbergen-jumamuratov': ['Жумамуратов Тилеўберген', 'Tilewbergen Jumamuratov'],
  'shawdirbay-seytov': ['Сейтов Шаўдырбай', 'Shawdırbay Seytov'],
  'tolepbergen-matmuratov': ['Мәтмуратов Төлепберген', 'Tólepbergen Mátmuratov'],
  'sagiydulla-abbazov': ['Аббазов Сағыйдулла', 'Saǵıydulla Abbazov'],
  'abbaz-dabilov': ['Дабылов Аббаз', 'Abbaz Dabılov'],
  'najim-dawqaraev': ['Дәўкараев Нәжим', 'Nájim Dáwqaraev'],
  'otegen-ayjanov': ['Айжанов Өтеген', 'Ótegen Ayjanov'],
  'dawlen-aytmuratov': ['Айтмуратов Дәўлен', 'Dáwlen Aytmuratov'],
  'adenbay-tajimuratov': ['Тәжимуратов Әденбай', 'Ádenbay Tájimuratov'],
};

function hashText(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function ensureUniqueSlug(base, used) {
  let slug = base || 'writer';
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  used.add(slug);
  return slug;
}

/**
 * Match key for author names: searchFold + drop "й" inside tokens
 * (qaipbergenov ~ qayıpbergenov) + sorted tokens
 * (Ibrayım Yusupov ~ Юсупов Ибрайым).
 */
function matchKey(name) {
  const fold = searchFold(String(name || ''));
  if (!fold) return '';
  return fold
    .split(/\s+/)
    .map((t) => t.replace(/й/g, ''))
    .filter(Boolean)
    .sort()
    .join(' ');
}

function authorCandidates(author) {
  const raw = String(author || '').trim();
  if (!raw) return [];
  const out = [raw];
  const noParens = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (noParens && noParens !== raw) out.push(noParens);
  const inParens = raw.match(/\(([^)]+)\)/);
  if (inParens) out.push(inParens[1].trim());
  return out;
}

// ---------------------------------------------------------------------------
// Parsers. All of them preserve original line breaks inside stanzas/paragraphs.
// ---------------------------------------------------------------------------

/** Үшпелек.json ships with raw newlines inside JSON strings — repair first. */
function parseLooseJson(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of String(text || '')) {
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') continue;
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return JSON.parse(out);
}

function tidyParagraph(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]{0,60}/, (m) => (m.length > 8 ? '' : m)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunksToParagraphs(chunk) {
  return tidyParagraph(chunk);
}

function applyStripPatterns(body, meta) {
  let out = body;
  for (const pat of meta.stripPatterns || []) {
    out = out
      .split('\n')
      .filter((line) => !String(line).includes(pat))
      .join('\n');
  }
  for (const re of meta.stripLineRegex || []) {
    const rx = new RegExp(re);
    out = out
      .split('\n')
      .filter((line) => !rx.test(line))
      .join('\n');
  }
  return out;
}

function splitBlankChunks(body) {
  return body
    .split(/\n\s*\n/)
    .map(chunksToParagraphs)
    .filter(Boolean);
}

function parseUshpelekJson(raw, meta) {
  const data = typeof raw === 'string' ? parseLooseJson(normalizeSource(raw)) : raw;
  const poems = Array.isArray(data.poets) ? data.poets : [];
  const sections = poems.map((poem, i) => {
    const stanzas = Array.isArray(poem.stanzas) ? poem.stanzas : [];
    const paragraphs = stanzas.map(chunksToParagraphs).filter(Boolean);
    return {
      title: String(poem.name || `Қосық ${i + 1}`).trim(),
      paragraphs: paragraphs.length ? paragraphs : ['—'],
    };
  });
  return {
    title: meta.title || data.name || 'Kitap',
    description: data.definition || meta.description || '',
    sections,
  };
}

/**
 * "- Title" heading style (Жоллар, lirika, gozzalliq, kitapxana toc+body ...).
 * TOC lines like "- Болған емес\t4" are recognized and dropped; the same
 * titles reappear as real headings in the body.
 */
function parseDashTitleTxt(text, meta = {}) {
  const body = applyStripPatterns(normalizeSource(text), meta);
  const lines = body.split('\n');
  const sections = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const paragraphs = splitBlankChunks(current.buf.join('\n'));
    if (paragraphs.length) {
      sections.push({ title: current.title, paragraphs });
    }
    current = null;
  };

  for (const line of lines) {
    // TOC entry with trailing page number ("- Болған емес\t4", "- ЙОҚ МЕНИҢ 7")
    // — drop entirely; the same title reappears as a real heading in the body.
    if (/^\s*-\s+.+[\t ]+\d{1,3}\s*$/.test(line)) continue;
    const m = line.match(/^\s*-\s+(.+?)\s*$/);
    if (m && m[1].trim().length >= 2 && m[1].trim().length < 120) {
      flush();
      current = { title: m[1].trim(), buf: [] };
      continue;
    }
    if (!current) {
      current = { title: meta.title || 'Бөлим 1', buf: [] };
    }
    current.buf.push(line);
  }
  flush();

  if (!sections.length) {
    const paragraphs = splitBlankChunks(body).slice(0, 400);
    sections.push({
      title: meta.title || 'Толық текст',
      paragraphs: paragraphs.length ? paragraphs : [body.slice(0, 4000)],
    });
  }
  return { title: meta.title, description: meta.description || '', sections };
}

/** ALL-CAPS standalone lines as headings (Мүнәжат-style books, tayarlangan). */
function isCapsHeading(line) {
  const t = line.trim();
  if (t.length < 3 || t.length > 90) return false;
  if (/^[IVXLC]+[.)]?$/.test(t)) return false; // roman numeral part markers
  const letters = Array.from(t).filter((c) => /\p{L}/u.test(c));
  if (letters.length < 4) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase());
  return upper.length / letters.length >= 0.85;
}

function parseCapsHeadingTxt(text, meta = {}) {
  const body = applyStripPatterns(normalizeSource(text), meta);
  const lines = body.split('\n');
  const sections = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    const paragraphs = splitBlankChunks(current.buf.join('\n'));
    if (paragraphs.length) {
      sections.push({ title: current.title, paragraphs });
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const prevBlank = i === 0 || !lines[i - 1].trim();
    if (isCapsHeading(line) && (prevBlank || (current && !current.buf.some((b) => b.trim())))) {
      flush();
      current = { title: line.trim(), buf: [] };
      continue;
    }
    if (!current) {
      current = { title: meta.title || 'Бөлим 1', buf: [] };
    }
    current.buf.push(line);
  }
  flush();

  if (!sections.length) {
    return parseBlankParagraphTxt(text, meta);
  }
  return { title: meta.title, description: meta.description || '', sections };
}

/** Prose without reliable headings — blank-line paragraphs, grouped in 8s. */
function parseBlankParagraphTxt(text, meta = {}) {
  const body = applyStripPatterns(normalizeSource(text), meta);
  const chunks = splitBlankChunks(body);
  const sections = [];
  for (let i = 0; i < chunks.length; i += 8) {
    const slice = chunks.slice(i, i + 8);
    sections.push({
      title: sections.length === 0 ? meta.title || 'Бөлим 1' : `Бөлим ${sections.length + 1}`,
      paragraphs: slice,
    });
  }
  if (!sections.length) {
    sections.push({
      title: meta.title || 'Толық текст',
      paragraphs: [body.slice(0, 4000) || '—'],
    });
  }
  return { title: meta.title, description: meta.description || '', sections };
}

/** One work per file (Посқан ел dástanı). Stanzas become paragraphs. */
function parseSinglePieceTxt(text, meta = {}) {
  const body = applyStripPatterns(normalizeSource(text), meta);
  let paragraphs = splitBlankChunks(body);
  if (paragraphs.length <= 1) {
    // Poem with no blank lines: keep original lines, group every 8 lines.
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    paragraphs = [];
    for (let i = 0; i < lines.length; i += 8) {
      paragraphs.push(lines.slice(i, i + 8).join('\n'));
    }
  }
  return {
    title: meta.title,
    description: meta.description || '',
    sections: [{ title: meta.title || 'Толық текст', paragraphs: paragraphs.length ? paragraphs : ['—'] }],
  };
}

const PARSERS = {
  'ushpelek-json': parseUshpelekJson,
  'dash-title-txt': parseDashTitleTxt,
  'caps-heading-txt': parseCapsHeadingTxt,
  'blank-paragraph-txt': parseBlankParagraphTxt,
  'single-piece-txt': parseSinglePieceTxt,
};

function parseBookFile(absPath, meta) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const parser =
    PARSERS[meta.parser] ||
    (absPath.endsWith('.json') ? parseUshpelekJson : parseBlankParagraphTxt);
  return { ...parser(raw, meta), raw };
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

function enrichBirth(plainBio, lifeSpan) {
  const facts = parseBirthFacts(plainBio, lifeSpan);
  let geo = null;
  if (facts.birthplaceOriginal) {
    geo = geocodeBirthplace(facts.birthplaceOriginal);
  }
  // Invariant: birthplace_original = Cyrillic, birthplace_latin = Latin
  const rawPlace = geo?.labelOriginal || facts.birthplaceOriginal || null;
  const placePair = rawPlace ? ensureScriptPair(rawPlace) : null;
  return {
    ...facts,
    birthLat: geo?.lat ?? null,
    birthLng: geo?.lng ?? null,
    geocodeStatus: geo ? 'resolved' : facts.birthplaceOriginal ? 'failed' : 'none',
    birthplaceOriginal: placePair?.cyrillic || null,
    birthplaceLatin:
      placePair?.latin ||
      facts.birthplaceLatin ||
      (facts.birthplaceOriginal ? toLatin(facts.birthplaceOriginal) : null),
  };
}

async function importWriters(db, manifest, audit) {
  const source = JSON.parse(fs.readFileSync(WRITERS_JSON, 'utf8'));
  const latinSource = fs.existsSync(WRITERS_LATIN_JSON)
    ? JSON.parse(fs.readFileSync(WRITERS_LATIN_JSON, 'utf8'))
    : [];
  audit.writers.latinSourceCount = latinSource.length;

  const usedSlugs = new Set();
  const byKey = new Map();
  const bySlug = new Map();
  const rememberWriter = (row) => {
    if (row.slug) bySlug.set(row.slug, row);
    for (const alias of row.aliases || []) {
      const key = matchKey(alias);
      if (key && !byKey.has(key)) byKey.set(key, row);
    }
  };

  if (RESEED && APPLY) {
    await db.query('DELETE FROM writer_creative_works');
    await db.query('DELETE FROM writer_aliases');
    await db.query('DELETE FROM book_writers');
    await db.query('DELETE FROM literature_pieces');
    await db.query('DELETE FROM literature_writers');
    console.log('🗑️  literature_writers hám baylanıslı qatarlar óshirildi (--reseed)');
  }

  const sourceNames = new Set(source.map((w) => matchKey(w.poetName)));

  const upsertWriter = async (item, { curated = false, fromLatin = false } = {}) => {
    const poetNameOriginal = normalizeSource(item.poetNameOriginal || item.poetName);
    const poetNameLatin = item.poetNameLatin || toLatin(poetNameOriginal);
    const plain = item.biographyPlain || stripHtmlToPlain(item.biography || '');
    const bioLatin = item.biographyLatin || (plain ? toLatin(plain) : '');
    const birth = enrichBirth(plain || bioLatin, item.lifeSpan || '');
    const birthYear = birth.birthYear ?? parseLifeSpan(item.lifeSpan).birthYear;
    const deathYear = birth.deathYear ?? parseLifeSpan(item.lifeSpan).deathYear;
    const contentHash = hashText(`${poetNameOriginal}|${plain}|${bioLatin}`);
    let slug = item.slug || slugifyWriterName(poetNameOriginal);
    // Normalize -uli / -uly for classics
    slug = slug.replace(/-uli$/, '-uly');
    slug = ensureUniqueSlug(slug, usedSlugs);
    const provenance = curated
      ? 'curated'
      : fromLatin
        ? 'shayirlar-latin/questions.json'
        : 'writers-qq-cyrillic.json';

    const aliases = new Set(
      [poetNameOriginal, poetNameLatin, ...(item.aliases || [])]
        .map((a) => String(a || '').trim())
        .filter(Boolean)
    );
    const parts = poetNameOriginal.split(/\s+/);
    if (parts.length === 2) {
      aliases.add(`${parts[1]} ${parts[0]}`);
      aliases.add(toLatin(`${parts[1]} ${parts[0]}`));
    }

    // Ómir jolı (jıl → waqıya) hám bio ishinde atalǵan shıǵarmalar
    const timeline = parseBioTimeline(plain || bioLatin);
    const factsJson = {
      ...(item.factsJson || {}),
      ...(timeline.events.length
        ? {
            timeline: timeline.events.map((e) => ({
              ...e,
              textLatin: toLatin(e.text),
            })),
          }
        : {}),
      ...(timeline.works.length ? { mentionedWorks: timeline.works } : {}),
    };
    const hasFacts = Object.keys(factsJson).length > 0;

    audit.writers.planned += 1;
    if (curated) audit.writers.curated.push({ slug, name: poetNameOriginal });
    if (fromLatin) audit.writers.latinMerged.push({ slug, name: poetNameLatin });
    if (birth.birthplaceOriginal) audit.writers.withBirthplace += 1;
    if (birth.birthDay) audit.writers.withBirthDay += 1;
    if (timeline.events.length) audit.writers.withTimeline += 1;
    audit.writers.bioWorks += timeline.works.length;

    if (DRY_RUN) {
      const row = {
        id: null,
        slug,
        name: poetNameOriginal,
        aliases: [...aliases],
        birth,
      };
      rememberWriter(row);
      return row;
    }

    const sourceId = curated || fromLatin ? null : item.id ?? null;
    await db.query(
      `INSERT INTO literature_writers
        (source_id, slug, poet_name_original, poet_name_latin, life_span,
         birth_year, death_year, birth_month, birth_day, birth_date, birth_precision,
         birthplace_original, birthplace_latin, birth_lat, birth_lng, geocode_status,
         facts_json, biography_original, biography_plain_original,
         biography_latin, source, content_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
       ON DUPLICATE KEY UPDATE
         poet_name_original = VALUES(poet_name_original),
         poet_name_latin = COALESCE(NULLIF(VALUES(poet_name_latin), ''), poet_name_latin),
         life_span = VALUES(life_span),
         birth_year = COALESCE(VALUES(birth_year), birth_year),
         death_year = COALESCE(VALUES(death_year), death_year),
         birth_month = COALESCE(VALUES(birth_month), birth_month),
         birth_day = COALESCE(VALUES(birth_day), birth_day),
         birth_date = COALESCE(VALUES(birth_date), birth_date),
         birth_precision = VALUES(birth_precision),
         birthplace_original = COALESCE(VALUES(birthplace_original), birthplace_original),
         birthplace_latin = COALESCE(VALUES(birthplace_latin), birthplace_latin),
         birth_lat = COALESCE(VALUES(birth_lat), birth_lat),
         birth_lng = COALESCE(VALUES(birth_lng), birth_lng),
         geocode_status = VALUES(geocode_status),
         facts_json = COALESCE(VALUES(facts_json), facts_json),
         biography_original = COALESCE(VALUES(biography_original), biography_original),
         biography_plain_original = COALESCE(NULLIF(VALUES(biography_plain_original), ''), biography_plain_original),
         biography_latin = COALESCE(NULLIF(VALUES(biography_latin), ''), biography_latin),
         source = VALUES(source),
         content_hash = VALUES(content_hash),
         status = 'published'`,
      [
        sourceId,
        slug,
        poetNameOriginal,
        poetNameLatin,
        item.lifeSpan || '',
        birthYear,
        deathYear,
        birth.birthMonth,
        birth.birthDay,
        birth.birthDate,
        birth.birthPrecision || 'year',
        birth.birthplaceOriginal,
        birth.birthplaceLatin,
        birth.birthLat,
        birth.birthLng,
        birth.geocodeStatus,
        hasFacts ? JSON.stringify(factsJson) : null,
        item.biography || null,
        plain,
        bioLatin,
        provenance,
        contentHash,
      ]
    );

    const [[row]] = await db.query(
      sourceId != null
        ? `SELECT id, slug FROM literature_writers WHERE source_id = ? LIMIT 1`
        : `SELECT id, slug FROM literature_writers WHERE slug = ? LIMIT 1`,
      [sourceId != null ? sourceId : slug]
    );

    for (const alias of aliases) {
      const fold = searchFold(alias);
      if (!fold) continue;
      await db.query(
        `INSERT INTO writer_aliases (writer_id, alias_original, alias_latin, alias_fold)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           alias_original = VALUES(alias_original),
           alias_latin = VALUES(alias_latin)`,
        [row.id, alias, toLatin(alias), fold]
      );
    }

    // Bio ishinde «...» (jıl) formasında atalǵan shıǵarmalar → ijod inventarı
    for (const w of timeline.works) {
      const titleOriginal = detectScript(w.title) === 'latin' ? toCyrillic(w.title) : w.title;
      const titleLatin = detectScript(w.title) === 'latin' ? w.title : toLatin(w.title);
      const workSlug = slugifyWriterName(titleLatin).slice(0, 160);
      if (!workSlug) continue;
      await db.query(
        `INSERT INTO writer_creative_works
          (writer_id, slug, title_original, title_latin, work_type, year_label,
           linked_book_id, availability, sort_order, content_hash)
         VALUES (?, ?, ?, ?, 'toplam', ?, NULL, 'mentioned_only', 500, ?)
         ON DUPLICATE KEY UPDATE
           year_label = CASE WHEN year_label = '' THEN VALUES(year_label) ELSE year_label END`,
        [
          row.id,
          workSlug,
          titleOriginal.slice(0, 255),
          titleLatin.slice(0, 255),
          `${w.year}-jıl`,
          hashText(`${titleLatin}|bio`),
        ]
      );
    }

    const entry = {
      id: row.id,
      slug: row.slug,
      name: poetNameOriginal,
      aliases: [...aliases],
      birth,
    };
    rememberWriter(entry);
    audit.writers.upserted += 1;
    return entry;
  };

  for (const w of source) {
    await upsertWriter(w);
  }

  for (const w of manifest.curatedWriters || []) {
    if (sourceNames.has(matchKey(w.poetNameOriginal))) {
      audit.writers.curatedSkipped.push(w.slug);
      continue;
    }
    // Prefer Latin-file bio if present later; curated fills gap for now.
    await upsertWriter(w, { curated: true });
  }

  // Latin enrichment / orphans
  for (const lw of latinSource) {
    const slugNorm = String(lw.slug || '').replace(/-uli$/, '-uly');
    const aliasList = [
      lw.name,
      ...(LATIN_WRITER_ALIASES[lw.slug] || LATIN_WRITER_ALIASES[slugNorm] || []),
      slugNorm,
      lw.slug,
    ];
    let existing = bySlug.get(slugNorm) || bySlug.get(lw.slug);
    if (!existing) {
      for (const a of aliasList) {
        existing = byKey.get(matchKey(a));
        if (existing) break;
      }
    }

    const lifeSpan = String(lw.bio?.year || '').replace(/\s+/g, ' ').trim();
    const about = String(lw.bio?.about || '').trim();
    const workTypes = lw['work-types'] || [];

    if (existing) {
      // Enrich Latin name/bio without overwriting Cyrillic original
      if (!DRY_RUN && existing.id) {
        const birth = enrichBirth(about, lifeSpan);
        await db.query(
          `UPDATE literature_writers SET
             poet_name_latin = COALESCE(NULLIF(?, ''), poet_name_latin),
             biography_latin = COALESCE(NULLIF(?, ''), biography_latin),
             life_span = CASE WHEN life_span = '' OR life_span IS NULL THEN ? ELSE life_span END,
             birth_year = COALESCE(birth_year, ?),
             death_year = COALESCE(death_year, ?),
             birth_month = COALESCE(birth_month, ?),
             birth_day = COALESCE(birth_day, ?),
             birth_date = COALESCE(birth_date, ?),
             birthplace_original = COALESCE(birthplace_original, ?),
             birthplace_latin = COALESCE(birthplace_latin, ?),
             birth_lat = COALESCE(birth_lat, ?),
             birth_lng = COALESCE(birth_lng, ?),
             geocode_status = CASE
               WHEN geocode_status = 'resolved' THEN geocode_status
               ELSE ?
             END,
             facts_json = JSON_MERGE_PATCH(COALESCE(facts_json, '{}'), ?)
           WHERE id = ?`,
          [
            lw.name || '',
            about,
            lifeSpan,
            birth.birthYear,
            birth.deathYear,
            birth.birthMonth,
            birth.birthDay,
            birth.birthDate,
            birth.birthplaceOriginal,
            birth.birthplaceLatin,
            birth.birthLat,
            birth.birthLng,
            birth.geocodeStatus,
            JSON.stringify({ workTypes, latinSlug: lw.slug, img: lw.img || null }),
            existing.id,
          ]
        );
        for (const a of aliasList) {
          const fold = searchFold(a);
          if (!fold) continue;
          await db.query(
            `INSERT INTO writer_aliases (writer_id, alias_original, alias_latin, alias_fold)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE alias_latin = VALUES(alias_latin)`,
            [existing.id, a, toLatin(a), fold]
          );
        }
      }
      existing.latinWorks = lw.works || [];
      existing.workTypes = workTypes;
      audit.writers.latinMatched += 1;
      continue;
    }

    // Orphan Latin classic — insert as new writer
    const nameLatin = lw.name;
    const nameOriginal = toCyrillic(nameLatin);
    const entry = await upsertWriter(
      {
        slug: slugNorm,
        poetNameOriginal: nameOriginal,
        poetNameLatin: nameLatin,
        lifeSpan,
        biographyPlain: about ? toCyrillic(about) : '',
        biographyLatin: about,
        biography: null,
        aliases: aliasList,
        factsJson: { workTypes, latinSlug: lw.slug, img: lw.img || null, orphanFromLatin: true },
      },
      { fromLatin: true }
    );
    entry.latinWorks = lw.works || [];
    entry.workTypes = workTypes;
    audit.writers.latinOrphans.push({ slug: slugNorm, name: nameLatin });
  }

  audit.writers.sourceCount = source.length;
  return { byKey, bySlug };
}

async function importCreativeWorks(db, bySlug, audit) {
  const latinSource = fs.existsSync(WRITERS_LATIN_JSON)
    ? JSON.parse(fs.readFileSync(WRITERS_LATIN_JSON, 'utf8'))
    : [];
  const [books] = DRY_RUN
    ? [[]]
    : await db.query('SELECT id, title, title_original, title_latin FROM books');
  const bookByFold = new Map();
  for (const b of books) {
    for (const t of [b.title, b.title_original, b.title_latin]) {
      const k = matchKey(t);
      if (k) bookByFold.set(k, b.id);
    }
  }

  for (const lw of latinSource) {
    const slugNorm = String(lw.slug || '').replace(/-uli$/, '-uly');
    const writer =
      bySlug.get(slugNorm) ||
      bySlug.get(lw.slug) ||
      [...bySlug.values()].find((w) =>
        (w.aliases || []).some((a) => matchKey(a) === matchKey(lw.name))
      );
    if (!writer) {
      audit.creativeWorks.unmatchedWriters.push(lw.slug);
      continue;
    }
    const works = Array.isArray(lw.works) ? lw.works : [];
    if (!works.length) {
      audit.creativeWorks.empty.push(lw.slug);
      continue;
    }

    // Linked books for this writer
    let linkedBookIds = new Set();
    if (!DRY_RUN && writer.id) {
      const [rows] = await db.query(
        'SELECT book_id FROM book_writers WHERE writer_id = ?',
        [writer.id]
      );
      linkedBookIds = new Set(rows.map((r) => r.book_id));
    }

    let sort = 0;
    for (const w of works) {
      const titleLatin = String(w.title || w.work || '').trim();
      if (!titleLatin) continue;
      const titleOriginal = toCyrillic(titleLatin);
      const workSlug = slugifyWriterName(w.work || titleLatin).slice(0, 160);
      const linked =
        bookByFold.get(matchKey(titleLatin)) ||
        bookByFold.get(matchKey(titleOriginal)) ||
        null;
      const availability = linked ? 'in_library' : 'mentioned_only';
      audit.creativeWorks.planned += 1;
      if (DRY_RUN || !writer.id) continue;
      const bodyRaw = w.texts ? String(w.texts).slice(0, 500000) : null;
      const bodyPair = bodyRaw ? ensureScriptPair(bodyRaw) : null;
      await db.query(
        `INSERT INTO writer_creative_works
          (writer_id, slug, title_original, title_latin, work_type, year_label,
           body_text, body_text_cyrillic, body_text_latin,
           linked_book_id, availability, sort_order, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title_original = VALUES(title_original),
           title_latin = VALUES(title_latin),
           work_type = VALUES(work_type),
           year_label = VALUES(year_label),
           body_text = VALUES(body_text),
           body_text_cyrillic = VALUES(body_text_cyrillic),
           body_text_latin = VALUES(body_text_latin),
           linked_book_id = VALUES(linked_book_id),
           availability = VALUES(availability),
           sort_order = VALUES(sort_order),
           content_hash = VALUES(content_hash)`,
        [
          writer.id,
          workSlug,
          titleOriginal.slice(0, 255),
          titleLatin.slice(0, 255),
          String(w.type || 'qosıq').slice(0, 40),
          String(w.year || '').slice(0, 80),
          bodyPair?.cyrillic || bodyRaw,
          bodyPair?.cyrillic || null,
          bodyPair?.latin || null,
          linked,
          availability,
          sort,
          hashText(`${titleLatin}|${w.texts || ''}`),
        ]
      );
      audit.creativeWorks.upserted += 1;
      sort += 1;
    }
  }
}

function resolveWriter(byKey, names = [], curatedSlug = null) {
  for (const name of names) {
    const hit = byKey.get(matchKey(name));
    if (hit) return hit;
  }
  if (curatedSlug) {
    const norm = curatedSlug.replace(/-uli$/, '-uly');
    for (const v of byKey.values()) {
      if (v.slug === curatedSlug || v.slug === norm) return v;
    }
  }
  return null;
}

/**
 * Ijod inventarın kitaplar HÁM kitap ishindegi qosıqlar (literature_pieces)
 * menen salıstıradı: tabılsa → 'in_library' + linked_book_id.
 * Tek jazıwshınıń óz kitapları ishinen izlenedi (jalǵan match bolmasın dep).
 */
async function reconcileCreativeWorks(db, audit) {
  if (DRY_RUN) return;

  const [bookRows] = await db.query(
    `SELECT b.id AS book_id, b.title, b.title_original, b.title_latin, bw.writer_id
     FROM books b JOIN book_writers bw ON bw.book_id = b.id`
  );
  const [pieceRows] = await db.query(
    `SELECT p.book_id, p.title_original, p.title_latin, p.sort_order, bw.writer_id
     FROM literature_pieces p
     JOIN book_writers bw ON bw.book_id = p.book_id`
  );

  const byWriter = new Map();
  const add = (writerId, title, bookId, sectionIndex) => {
    const k = matchKey(title);
    if (!k) return;
    if (!byWriter.has(writerId)) byWriter.set(writerId, new Map());
    const m = byWriter.get(writerId);
    // Anıq qosıq (piece) matchi kitap-title matchinen ústin turadı
    if (!m.has(k) || (m.get(k).sectionIndex == null && sectionIndex != null)) {
      m.set(k, { bookId, sectionIndex });
    }
  };
  for (const r of bookRows) {
    add(r.writer_id, r.title, r.book_id, null);
    add(r.writer_id, r.title_original, r.book_id, null);
    add(r.writer_id, r.title_latin, r.book_id, null);
  }
  for (const r of pieceRows) {
    add(r.writer_id, r.title_original, r.book_id, r.sort_order);
    add(r.writer_id, r.title_latin, r.book_id, r.sort_order);
  }

  // Barlıq qatarlar qayta esaplanadı — kitap qayta parse bolǵanda
  // bólim indeksleri jıljıwı múmkin.
  const [cwRows] = await db.query(
    `SELECT id, writer_id, title_original, title_latin
     FROM writer_creative_works`
  );

  let linked = 0;
  for (const row of cwRows) {
    const m = byWriter.get(row.writer_id);
    if (!m) continue;
    const hit =
      m.get(matchKey(row.title_original)) || m.get(matchKey(row.title_latin)) || null;
    if (!hit) continue;
    await db.query(
      `UPDATE writer_creative_works
       SET availability = 'in_library', linked_book_id = ?, linked_section_index = ?
       WHERE id = ?`,
      [hit.bookId, hit.sectionIndex, row.id]
    );
    linked += 1;
  }
  audit.creativeWorks.linkedToLibrary = linked;
}

// ---------------------------------------------------------------------------
// Jumbaqlar
// ---------------------------------------------------------------------------

async function importJumbaqlar(db, audit) {
  const rows = JSON.parse(fs.readFileSync(FORDATA_JUMBAQ, 'utf8'));
  audit.jumbaqlar.sourceCount = rows.length;
  if (RESEED && APPLY) {
    await db.query('DELETE FROM jumbaq_progress');
    await db.query('DELETE FROM jumbaqlar');
    console.log('🗑️  jumbaqlar / jumbaq_progress óshirildi (--reseed)');
  }

  const variantGroups = new Map();
  for (const row of rows) {
    const jumbaq = normalizeSource(String(row.jumbaq || '')).trim();
    const juwap = normalizeSource(String(row.juwap || '')).trim();
    // Variant hash groups near-duplicate rows (diacritic variants of the
    // same riddle) while every source row keeps its stable id.
    const variantGroup = hashText(searchFold(`${jumbaq}|${juwap}`)).slice(0, 32);
    variantGroups.set(variantGroup, (variantGroups.get(variantGroup) || 0) + 1);
    const contentHash = hashText(`${row.id}|${jumbaq}|${juwap}|${row.topar}|${row.utopar}`);
    audit.jumbaqlar.planned += 1;
    if (DRY_RUN) continue;
    await db.query(
      `INSERT INTO jumbaqlar
        (id, jumbaq_original, jumbaq_cyrillic, juwap_original, juwap_cyrillic,
         topar, utopar, variant_group, content_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
       ON DUPLICATE KEY UPDATE
         jumbaq_original = VALUES(jumbaq_original),
         jumbaq_cyrillic = VALUES(jumbaq_cyrillic),
         juwap_original = VALUES(juwap_original),
         juwap_cyrillic = VALUES(juwap_cyrillic),
         topar = VALUES(topar),
         utopar = VALUES(utopar),
         variant_group = VALUES(variant_group),
         content_hash = VALUES(content_hash),
         status = 'published'`,
      [
        Number(row.id),
        jumbaq,
        toCyrillic(jumbaq),
        juwap,
        toCyrillic(juwap),
        Number(row.topar) || 0,
        Number(row.utopar) || 0,
        variantGroup,
        contentHash,
      ]
    );
    audit.jumbaqlar.upserted += 1;
  }
  audit.jumbaqlar.duplicateVariants = [...variantGroups.values()].filter((n) => n > 1).length;
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

function sectionFallbackTitle(index) {
  return `Бөлим ${index + 1}`;
}

function resolveBookTitles(parsed, meta) {
  const rawTitle = String(parsed.title || meta.title || meta.id || '').trim();
  const titleOriginal = String(meta.titleOriginal || '').trim() ||
    (detectScript(rawTitle) === 'latin' ? toCyrillic(rawTitle) : rawTitle);
  const titleLatin = String(meta.titleLatin || '').trim() ||
    (detectScript(rawTitle) === 'cyrillic' ? toLatin(rawTitle) : rawTitle || toLatin(titleOriginal));
  return {
    title: titleOriginal.slice(0, 200),
    titleOriginal: titleOriginal.slice(0, 200),
    titleLatin: titleLatin.slice(0, 200),
  };
}

async function replaceSections(conn, bookId, sections) {
  await conn.query('DELETE FROM book_sections WHERE book_id = ?', [bookId]);
  await conn.query('DELETE FROM literature_pieces WHERE book_id = ?', [bookId]);
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    let titleRaw = String(s.title || sectionFallbackTitle(i)).slice(0, 250);
    // Latin fallback headings → Cyrillic display original
    if (/^Bólim\s+\d+/i.test(titleRaw) || /^Qosıq\s+\d+/i.test(titleRaw) || titleRaw === 'Tolıq tekst') {
      titleRaw = titleRaw
        .replace(/^Bólim\s+/i, 'Бөлим ')
        .replace(/^Qosıq\s+/i, 'Қосық ')
        .replace(/^Tolıq tekst$/i, 'Толық текст');
    }
    const titlePair = ensureScriptPair(titleRaw);
    const titleCyr = titlePair.cyrillic.slice(0, 250);
    const titleLat = titlePair.latin.slice(0, 250);

    const peeled = parsePoemTrailingMeta(s.paragraphs || []);
    const bodyParas = peeled.paragraphs.length ? peeled.paragraphs : s.paragraphs || ['—'];
    const parasCyr = bodyParas.map((p) => ensureScriptPair(p).cyrillic);
    const parasLat = bodyParas.map((p) => ensureScriptPair(p).latin);
    const meta = peeled.meta;

    await conn.query(
      `INSERT INTO book_sections (id, book_id, title, paragraphs_json, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [`${bookId}-s${i}`, bookId, titleCyr, JSON.stringify(parasCyr), i]
    );
    await conn.query(
      `INSERT INTO literature_pieces
        (id, book_id, writer_id, title_original, title_latin,
         paragraphs_json, paragraphs_cyrillic_json, paragraphs_latin_json,
         work_year, work_date_label_original, work_date_label_latin,
         work_place_original, work_place_latin,
         sort_order, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${bookId}-p${i}`,
        bookId,
        s.writerId || null,
        titleCyr,
        titleLat,
        JSON.stringify(parasCyr),
        JSON.stringify(parasCyr),
        JSON.stringify(parasLat),
        meta.workYear,
        meta.workDateLabelCyrillic,
        meta.workDateLabelLatin,
        meta.workPlaceCyrillic,
        meta.workPlaceLatin,
        i,
        hashText(`${titleCyr}|${JSON.stringify(parasCyr)}|${meta.workYear || ''}`),
      ]
    );
  }
}

async function importBooks(db, manifest, byKey, audit) {
  for (const meta of manifest.books || []) {
    const abs = path.join(FORDATA_BOOKS, meta.path);
    if (!fs.existsSync(abs)) {
      audit.books.missing.push(meta.path);
      continue;
    }
    let parsed;
    try {
      parsed = parseBookFile(abs, meta);
    } catch (err) {
      audit.books.errors.push({ id: meta.id, error: `parse: ${err.message}` });
      continue;
    }
    // PARSER_VERSION hash ishine kiredi: parser ózgergende barlıq kitaplar
    // bir márte qayta parse etiledi (eski, qátar bólinbegen seksiyalar jańalanadı).
    const contentHash = hashText(`${parsed.raw}|pv${PARSER_VERSION}`);
    const script = detectScript(parsed.raw.slice(0, 4000));
    const writer = resolveWriter(byKey, meta.authorMatch || [], meta.curatedSlug || null);
    const authorName =
      writer?.name || (meta.authorMatch && meta.authorMatch[0]) || 'Belgisiz';
    const importStatus = meta.importStatus || 'imported';

    const titles = resolveBookTitles(parsed, meta);
    const authorOriginal = String(authorName).slice(0, 200);
    const authorLatin = toLatin(authorOriginal).slice(0, 200);
    const descriptionOriginal = String(
      parsed.description || meta.descriptionOriginal || `${authorOriginal} — ${titles.titleOriginal}`
    );
    const descriptionLatin = toLatin(descriptionOriginal);

    audit.books.planned.push({
      id: meta.id,
      path: meta.path,
      parser: meta.parser,
      sections: parsed.sections.length,
      writer: authorName,
      matched: Boolean(writer),
      script,
      importStatus,
      pdfSidecar: meta.pdfSidecar || null,
      contentHash: contentHash.slice(0, 12),
      titleOriginal: titles.titleOriginal,
      titleLatin: titles.titleLatin,
    });

    if (DRY_RUN) continue;

    const [[existing]] = await db.query(
      `SELECT id, content_hash, import_status,
              (SELECT COUNT(*) FROM book_sections s WHERE s.book_id = books.id) AS section_count
       FROM books WHERE id = ? LIMIT 1`,
      [meta.id]
    );
    if (
      existing &&
      existing.content_hash === contentHash &&
      Number(existing.section_count) === parsed.sections.length &&
      !RESEED
    ) {
      // Refresh script-pair columns (manifest Cyrillic overrides Latin-stored titles)
      await db.query(
        `UPDATE books SET
           title = ?,
           title_original = ?,
           title_latin = ?,
           author_original = COALESCE(NULLIF(author_original, ''), ?),
           author_latin = COALESCE(NULLIF(author_latin, ''), ?),
           description_original = COALESCE(NULLIF(description_original, ''), ?),
           description_latin = COALESCE(NULLIF(description_latin, ''), ?)
         WHERE id = ?`,
        [
          titles.titleOriginal,
          titles.titleOriginal,
          titles.titleLatin,
          authorOriginal,
          authorLatin,
          descriptionOriginal,
          descriptionLatin,
          meta.id,
        ]
      );
      audit.books.skippedSameHash += 1;
      continue;
    }
    // Never destructively overwrite rows this importer does not own.
    if (existing && existing.import_status === 'seed' && !RESEED) {
      audit.books.errors.push({
        id: meta.id,
        error: 'existing seed book with same id — refusing to overwrite without --reseed',
      });
      continue;
    }

    try {
      await db.beginTransaction();
      await db.query(
        `INSERT INTO books
          (id, title, title_original, title_latin, author, author_original, author_latin,
           years, genre, description, description_original, description_latin, note, source_type,
           original_script, source_path, content_hash, import_status, work_kind)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'text', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           title_original = VALUES(title_original),
           title_latin = VALUES(title_latin),
           author = VALUES(author),
           author_original = VALUES(author_original),
           author_latin = VALUES(author_latin),
           years = VALUES(years),
           genre = VALUES(genre),
           description = VALUES(description),
           description_original = VALUES(description_original),
           description_latin = VALUES(description_latin),
           note = VALUES(note),
           original_script = VALUES(original_script),
           source_path = VALUES(source_path),
           content_hash = VALUES(content_hash),
           import_status = VALUES(import_status),
           work_kind = VALUES(work_kind)`,
        [
          meta.id,
          titles.titleOriginal,
          titles.titleOriginal,
          titles.titleLatin,
          authorOriginal,
          authorOriginal,
          authorLatin,
          meta.years || '',
          meta.genre || 'other',
          descriptionOriginal,
          descriptionOriginal,
          descriptionLatin,
          meta.pdfSidecar ? `pdf: ${meta.pdfSidecar}`.slice(0, 500) : '',
          script === 'unknown' ? 'mixed' : script,
          meta.path,
          contentHash,
          importStatus,
          meta.workKind || 'book',
        ]
      );

      const sections = parsed.sections.map((s) => ({
        ...s,
        writerId: writer?.id || null,
      }));
      await replaceSections(db, meta.id, sections);

      if (writer?.id) {
        await db.query(
          `INSERT INTO book_writers (book_id, writer_id, role, sort_order)
           VALUES (?, ?, 'author', 0)
           ON DUPLICATE KEY UPDATE role = 'author'`,
          [meta.id, writer.id]
        );
      }
      await db.commit();
      audit.books.upserted += 1;
    } catch (err) {
      await db.rollback();
      audit.books.errors.push({ id: meta.id, error: err.message });
    }
  }
}

/** Link pre-existing (seed) books to writers via alias match keys. */
async function linkExistingBooks(db, byKey, audit) {
  const [books] = await db.query('SELECT id, author FROM books');
  for (const book of books) {
    const writer = resolveWriter(byKey, authorCandidates(book.author));
    if (!writer) continue;
    audit.bookWriterLinks.push({ bookId: book.id, writer: writer.name });
    if (DRY_RUN || !writer.id) continue;
    await db.query(
      `INSERT INTO book_writers (book_id, writer_id, role, sort_order)
       VALUES (?, ?, 'author', 0)
       ON DUPLICATE KEY UPDATE role = 'author'`,
      [book.id, writer.id]
    );
  }
}

// ---------------------------------------------------------------------------
// Coverage: report fordata/books files the manifest does not account for.
// ---------------------------------------------------------------------------

function listBookFiles(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listBookFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

function auditCoverage(manifest, audit) {
  const covered = new Set((manifest.books || []).map((b) => b.path.replace(/\\/g, '/')));
  const skips = (manifest.skip || []).map((s) =>
    (typeof s === 'string' ? s : s.path).replace(/\\/g, '/')
  );
  const files = listBookFiles(FORDATA_BOOKS);
  for (const rel of files) {
    const norm = rel.replace(/\\/g, '/');
    if (norm === 'writers-qq-cyrillic.json') continue;
    if (covered.has(norm)) continue;
    if (/\.pdf$/i.test(norm)) continue; // binary sidecars, referenced via manifest
    if (skips.some((s) => norm === s || norm.startsWith(`${s.replace(/\/$/, '')}/`))) {
      audit.books.skipped.push(norm);
      continue;
    }
    audit.books.unlisted.push(norm);
  }
}

// ---------------------------------------------------------------------------

const audit = {
  startedAt: new Date().toISOString(),
  mode: DRY_RUN ? 'dry-run' : RESEED ? 'apply+reseed' : 'apply',
  writers: {
    sourceCount: 0,
    latinSourceCount: 0,
    planned: 0,
    upserted: 0,
    curated: [],
    curatedSkipped: [],
    latinMerged: [],
    latinMatched: 0,
    latinOrphans: [],
    withBirthplace: 0,
    withBirthDay: 0,
    withTimeline: 0,
    bioWorks: 0,
  },
  creativeWorks: {
    planned: 0,
    upserted: 0,
    empty: [],
    unmatchedWriters: [],
  },
  jumbaqlar: { sourceCount: 0, planned: 0, upserted: 0, duplicateVariants: 0 },
  books: {
    planned: [],
    upserted: 0,
    skippedSameHash: 0,
    skipped: [],
    unlisted: [],
    missing: [],
    errors: [],
  },
  bookWriterLinks: [],
};

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const db = await mysql.createConnection({ ...QUIZ_DB_CONFIG, charset: 'utf8mb4' });

console.log(`\n📚 Literature import (${audit.mode})\n`);

const { byKey, bySlug } = await importWriters(db, manifest, audit);
await importCreativeWorks(db, bySlug, audit);
await importJumbaqlar(db, audit);
await importBooks(db, manifest, byKey, audit);
await linkExistingBooks(db, byKey, audit);
await reconcileCreativeWorks(db, audit);
auditCoverage(manifest, audit);

await db.end();

fs.mkdirSync(TMP_DIR, { recursive: true });
const auditPath = path.join(TMP_DIR, `literature-import-audit-${Date.now()}.json`);
fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2), 'utf8');

console.log(JSON.stringify({
  mode: audit.mode,
  writers: {
    sourceCount: audit.writers.sourceCount,
    latinSourceCount: audit.writers.latinSourceCount,
    planned: audit.writers.planned,
    upserted: audit.writers.upserted,
    latinMatched: audit.writers.latinMatched,
    latinOrphans: audit.writers.latinOrphans,
    withBirthplace: audit.writers.withBirthplace,
    withBirthDay: audit.writers.withBirthDay,
    withTimeline: audit.writers.withTimeline,
    bioWorks: audit.writers.bioWorks,
    curated: audit.writers.curated.map((c) => c.slug),
    curatedSkipped: audit.writers.curatedSkipped,
  },
  creativeWorks: {
    planned: audit.creativeWorks.planned,
    upserted: audit.creativeWorks.upserted,
    empty: audit.creativeWorks.empty.length,
    linkedToLibrary: audit.creativeWorks.linkedToLibrary || 0,
  },
  jumbaqlar: audit.jumbaqlar,
  books: {
    planned: audit.books.planned.length,
    upserted: audit.books.upserted,
    skippedSameHash: audit.books.skippedSameHash,
    skipped: audit.books.skipped.length,
    unlisted: audit.books.unlisted,
    missing: audit.books.missing,
    errors: audit.books.errors,
  },
  bookWriterLinks: audit.bookWriterLinks.length,
  auditPath,
}, null, 2));

if (DRY_RUN) {
  console.log('\nℹ️  Dry-run only. Apply with: node scripts/import-literature-data.js --apply\n');
}
