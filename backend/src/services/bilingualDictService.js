/**
 * UZB↔KAA, EN/RU bilingual dictionaries + morphology helpers.
 */
import db from '../config/dictionary.db.js';
import searchFold from '../utils/searchFold.js';
import {
  enrichSensesWithExamples,
  parseNumberedSenses,
  structureGloss,
} from '../utils/glossStructure.js';
import { linkSenseAuthors } from './writerLinkService.js';

function safeJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function mapUzbSozlikRow(r) {
  return {
    id: r.id,
    lang: 'uzb',
    direction: 'uzb→kaa',
    word: r.uzb,
    surface: r.uzb_surface || r.uzb,
    primary: r.kaa_primary || null,
    senses: enrichSensesWithExamples(parseNumberedSenses(r.kaa_gloss)),
    gloss: r.kaa_gloss,
    source: r.source,
    titleId: r.title_id || null,
  };
}

/**
 * Rus sózlik belgisin: БЕСПРИЗОРН//ЫЙ → БЕСПРИЗОРНЫЙ.
 * "//" — tipografiyalıq stem shegara; paydalanıwshıǵa kórsetilmeydi.
 */
export function normalizeRuHeadword(word) {
  return String(word || '')
    .replace(/([А-ЯЁа-яёA-Za-z])\/{1,2}([А-ЯЁа-яёA-Za-z])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapBilingualRow(r) {
  const rawSenses = safeJson(r.senses_json, null);
  const senses = enrichSensesWithExamples(
    Array.isArray(rawSenses) && rawSenses.length
      ? rawSenses
      : parseNumberedSenses(r.translation_text)
  );
  const rawWord = r.word;
  const word = r.lang === 'ru' ? normalizeRuHeadword(rawWord) : rawWord;
  return {
    id: r.id,
    lang: r.lang,
    direction: r.lang === 'en' ? 'kaa→en' : 'ru→kaa',
    word,
    wordRaw: rawWord !== word ? rawWord : undefined,
    pos: r.pos || null,
    senses,
    gloss: r.translation_text,
    glossHtml: r.translation_html,
    source: r.source,
    titleId: r.title_id || null,
  };
}

function mapLexiconRow(r) {
  return {
    uzb: r.uzb,
    kaa: r.kaa,
    source: r.source,
    confidence: r.confidence,
  };
}

export async function searchUzbKaa(q, limit = 30) {
  const query = String(q || '').trim();
  if (query.length < 1) return { data: [], count: 0 };
  const fold = searchFold(query);
  const like = `%${query.replace(/[%_]/g, '')}%`;
  const foldLike = fold ? `%${fold}%` : like;

  const [sozlik] = await db.query(
    `SELECT id, uzb, uzb_surface, kaa_primary, kaa_gloss, source
     FROM uzb_kaa_sozlik
     WHERE uzb LIKE ? OR kaa_primary LIKE ? OR kaa_gloss LIKE ?
        OR uzb LIKE ? OR kaa_primary LIKE ?
     ORDER BY
       CASE
         WHEN uzb = ? THEN 0
         WHEN uzb LIKE ? THEN 1
         ELSE 2
       END,
       CHAR_LENGTH(uzb)
     LIMIT ?`,
    [like, like, like, foldLike, foldLike, query, `${query}%`, Number(limit)]
  );

  const [lex] = await db.query(
    `SELECT uzb, kaa, source, confidence
     FROM uzb_kaa_lexicon
     WHERE uzb LIKE ? OR kaa LIKE ?
     ORDER BY confidence DESC, CHAR_LENGTH(uzb)
     LIMIT ?`,
    [like, like, Math.min(20, Number(limit))]
  );

  return {
    data: sozlik.map(mapUzbSozlikRow),
    lexicon: lex.map(mapLexiconRow),
    count: sozlik.length,
  };
}

export async function getUzbKaaById(id) {
  const [[row]] = await db.query(
    `SELECT id, uzb, uzb_surface, kaa_primary, kaa_gloss, source
     FROM uzb_kaa_sozlik WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) return null;

  const fold = searchFold(row.kaa_primary || row.uzb);
  let titleId = null;
  if (fold) {
    const [[t]] = await db.query(
      `SELECT id FROM titles
       WHERE status = 1 AND (search_key = ? OR normalized = ? OR soz = ?)
       LIMIT 1`,
      [fold, (row.kaa_primary || '').toLocaleLowerCase('kk'), row.kaa_primary]
    );
    titleId = t?.id || null;
  }

  const [relatedLex] = await db.query(
    `SELECT uzb, kaa, source, confidence FROM uzb_kaa_lexicon
     WHERE uzb = ? OR uzb LIKE ?
     ORDER BY confidence DESC LIMIT 12`,
    [row.uzb, `${row.uzb}%`]
  );

  return {
    ...mapUzbSozlikRow({ ...row, title_id: titleId }),
    senses: await linkSenseAuthors(
      enrichSensesWithExamples(parseNumberedSenses(row.kaa_gloss))
    ),
    lexicon: relatedLex.map(mapLexiconRow),
  };
}

export async function searchBilingual(lang, q, limit = 30) {
  if (!['en', 'ru'].includes(lang)) throw Object.assign(new Error('bad lang'), { status: 400 });
  const query = String(q || '').trim();
  if (query.length < 1) return { data: [], count: 0 };
  const fold = searchFold(query);
  const like = `%${query.replace(/[%_]/g, '')}%`;

  const [rows] = await db.query(
    `SELECT id, lang, word, word_fold, translation_html, translation_text, pos, senses_json, title_id, source
     FROM bilingual_dict
     WHERE lang = ?
       AND (word LIKE ? OR translation_text LIKE ? OR word_fold LIKE ?)
     ORDER BY
       CASE
         WHEN word = ? THEN 0
         WHEN word LIKE ? THEN 1
         WHEN word_fold = ? THEN 2
         ELSE 3
       END,
       CHAR_LENGTH(word)
     LIMIT ?`,
    [lang, like, like, fold ? `%${fold}%` : like, query, `${query}%`, fold || query, Number(limit)]
  );

  return { data: rows.map(mapBilingualRow), count: rows.length };
}

export async function getBilingualById(lang, id) {
  const [[row]] = await db.query(
    `SELECT id, lang, word, word_fold, translation_html, translation_text, pos, senses_json, title_id, source
     FROM bilingual_dict WHERE lang = ? AND id = ? LIMIT 1`,
    [lang, id]
  );
  if (!row) return null;
  const mapped = mapBilingualRow(row);
  mapped.senses = await linkSenseAuthors(mapped.senses);
  return mapped;
}

export async function listBilingual(lang, { page = 1, limit = 40, letter } = {}) {
  if (!['en', 'ru'].includes(lang)) throw Object.assign(new Error('bad lang'), { status: 400 });
  const offset = (Math.max(1, page) - 1) * limit;
  const params = [lang];
  let where = 'lang = ?';
  if (letter) {
    where += ' AND word LIKE ?';
    params.push(`${letter}%`);
  }
  const [[{ n }]] = await db.query(
    `SELECT COUNT(*) AS n FROM bilingual_dict WHERE ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT id, lang, word, word_fold, translation_html, translation_text, pos, senses_json, title_id, source
     FROM bilingual_dict WHERE ${where}
     ORDER BY word ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );
  return {
    data: rows.map(mapBilingualRow),
    total: n,
    page,
    limit,
  };
}

export async function listUzbKaa({ page = 1, limit = 40, letter } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const params = [];
  let where = '1=1';
  if (letter) {
    where += ' AND uzb LIKE ?';
    params.push(`${letter}%`);
  }
  const [[{ n }]] = await db.query(
    `SELECT COUNT(*) AS n FROM uzb_kaa_sozlik WHERE ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT id, uzb, uzb_surface, kaa_primary, kaa_gloss, source
     FROM uzb_kaa_sozlik WHERE ${where}
     ORDER BY uzb ASC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );
  return { data: rows.map(mapUzbSozlikRow), total: n, page, limit };
}

export async function getMorphologyForTitle(titleId) {
  const [[row]] = await db.query(
    `SELECT title_id, surface_latin, lemma_latin, tags_json, analyses_json,
            segments_json, display_split, is_unknown, source
     FROM title_morphology WHERE title_id = ? LIMIT 1`,
    [titleId]
  );
  if (!row) return null;
  const analyses = safeJson(row.analyses_json, {});
  const approximate =
    row.source === 'qq-approx' || analyses?.approximate === true || analyses?.engine === 'qq-segmenter-lemma';
  const rootTitleId = analyses?.rootTitleId || null;
  const rootIsKnown = analyses?.rootIsKnown !== false && !row.is_unknown;

  let rootGloss = null;
  let rootHeadword = null;
  // Túbir óz basqa sózlik maqalası bolsa — qısqa anıqlamanı qosamız
  if (rootTitleId && String(rootTitleId) !== String(titleId)) {
    try {
      const [[rootRow]] = await db.query(
        `SELECT t.soz,
           (SELECT d.description FROM description d
            WHERE d.titles_id = t.id
            ORDER BY d.sort_order ASC LIMIT 1) AS gloss
         FROM titles t WHERE t.id = ? LIMIT 1`,
        [rootTitleId]
      );
      if (rootRow) {
        rootHeadword = rootRow.soz || null;
        const g = String(rootRow.gloss || '').replace(/\s+/g, ' ').trim();
        rootGloss = g ? g.slice(0, 220) : null;
      }
    } catch {
      /* gloss ixtiyarıy */
    }
  }

  return {
    titleId: row.title_id,
    surfaceLatin: row.surface_latin,
    lemmaLatin: row.lemma_latin,
    tags: safeJson(row.tags_json, []),
    analyses,
    segments: safeJson(row.segments_json, []),
    displaySplit: row.display_split,
    isUnknown: !!row.is_unknown,
    source: row.source,
    approximate,
    rootIsKnown,
    rootTitleId,
    rootHeadword,
    rootGloss,
    rootCyrillic: analyses?.rootCyrillic || null,
  };
}

/**
 * Cross-dictionary links for a tusindirme title (WordDetail enrichment).
 */
export async function getLinksForTitle(titleId, soz) {
  const fold = searchFold(soz);
  const base = String(soz || '')
    .replace(/\s+[IVXІХ]+$/u, '')
    .trim();
  const baseFold = searchFold(base);

  const [enRows] = await db.query(
    `SELECT id, lang, word, translation_text, pos, senses_json, title_id, source
     FROM bilingual_dict
     WHERE lang = 'en' AND (title_id = ? OR word_fold IN (?, ?))
     LIMIT 8`,
    [titleId, fold, baseFold]
  );

  const [ruByTitle] = await db.query(
    `SELECT id, lang, word, translation_text, pos, senses_json, title_id, source
     FROM bilingual_dict
     WHERE lang = 'ru' AND title_id = ?
     LIMIT 8`,
    [titleId]
  );

  let ruRows = ruByTitle;
  if (ruRows.length < 2 && base.length >= 3) {
    const [ruExtra] = await db.query(
      `SELECT id, lang, word, translation_text, pos, senses_json, title_id, source
       FROM bilingual_dict
       WHERE lang = 'ru' AND title_id IS NOT NULL
         AND translation_text LIKE ?
       LIMIT 6`,
      [`%${base.slice(0, 48)}%`]
    );
    const seen = new Set(ruRows.map((r) => r.id));
    for (const r of ruExtra) {
      if (seen.has(r.id)) continue;
      ruRows.push(r);
      if (ruRows.length >= 8) break;
    }
  }

  const [uzbByKaa] = await db.query(
    `SELECT id, uzb, uzb_surface, kaa_primary, kaa_gloss, source
     FROM uzb_kaa_sozlik
     WHERE kaa_primary = ? OR kaa_primary LIKE ? OR kaa_gloss LIKE ?
     ORDER BY CHAR_LENGTH(kaa_primary) ASC
     LIMIT 8`,
    [base, `${base}%`, `%${base}%`]
  );

  const [lex] = await db.query(
    `SELECT uzb, kaa, source, confidence FROM uzb_kaa_lexicon
     WHERE kaa = ? OR kaa LIKE ?
     ORDER BY confidence DESC LIMIT 10`,
    [base, `${base}%`]
  );

  const morph = await getMorphologyForTitle(titleId);

  let frazeologiya = [];
  try {
    const [byTitle] = await db.query(
      `SELECT id, phrase, gloss, variants, source, kind, title_id
       FROM kaa_frazeologiya
       WHERE title_id = ?
       ORDER BY phrase
       LIMIT 12`,
      [titleId]
    );
    frazeologiya = byTitle;
    if (frazeologiya.length < 4 && base.length >= 3) {
      const [byPhrase] = await db.query(
        `SELECT id, phrase, gloss, variants, source, kind, title_id
         FROM kaa_frazeologiya
         WHERE phrase LIKE ? OR phrase LIKE ?
         ORDER BY CHAR_LENGTH(phrase) ASC
         LIMIT 10`,
        [`${base}%`, `% ${base}%`]
      );
      const seen = new Set(frazeologiya.map((r) => r.id));
      for (const r of byPhrase) {
        if (seen.has(r.id)) continue;
        frazeologiya.push(r);
        if (frazeologiya.length >= 12) break;
      }
    }
  } catch {
    frazeologiya = [];
  }

  let adamAtlari = [];
  try {
    const { getAdamAtlariForTitle } = await import('./adamAtlariService.js');
    adamAtlari = await getAdamAtlariForTitle(titleId, soz);
  } catch {
    adamAtlari = [];
  }

  let imla = [];
  try {
    const { getImlaForTitle } = await import('./imlaService.js');
    imla = await getImlaForTitle(titleId, soz);
  } catch {
    imla = [];
  }

  return {
    morphology: morph,
    en: enRows.map(mapBilingualRow),
    ru: ruRows.map(mapBilingualRow),
    uzb: uzbByKaa.map(mapUzbSozlikRow),
    lexicon: lex.map(mapLexiconRow),
    frazeologiya: frazeologiya.map(mapPhraseRow),
    adamAtlari,
    imla,
  };
}

export async function getDictStats() {
  const [[uzb]] = await db.query(`SELECT COUNT(*) AS n FROM uzb_kaa_sozlik`);
  const [[lex]] = await db.query(`SELECT COUNT(*) AS n FROM uzb_kaa_lexicon`);
  const [[morph]] = await db.query(`SELECT COUNT(*) AS n FROM title_morphology`);
  const [bi] = await db.query(
    `SELECT lang, COUNT(*) AS n, SUM(title_id IS NOT NULL) AS linked
     FROM bilingual_dict GROUP BY lang`
  );
  let frazeologiya = 0;
  let adamAtlari = 0;
  let imla = 0;
  try {
    const [[fr]] = await db.query(`SELECT COUNT(*) AS n FROM kaa_frazeologiya`);
    frazeologiya = fr.n;
  } catch {
    frazeologiya = 0;
  }
  try {
    const [[ad]] = await db.query(`SELECT COUNT(*) AS n FROM kaa_adam_atlari`);
    adamAtlari = ad.n;
  } catch {
    adamAtlari = 0;
  }
  let imlaBySource = {};
  try {
    const [[im]] = await db.query(`SELECT COUNT(*) AS n FROM kaa_imla`);
    imla = im.n;
    const [srcRows] = await db.query(
      `SELECT source, COUNT(*) AS n FROM kaa_imla GROUP BY source`
    );
    imlaBySource = Object.fromEntries(srcRows.map((r) => [r.source, r.n]));
  } catch {
    imla = 0;
    imlaBySource = {};
  }
  return {
    uzbSozlik: uzb.n,
    uzbLexicon: lex.n,
    morphology: morph.n,
    frazeologiya,
    adamAtlari,
    imla,
    imlaBySource,
    bilingual: Object.fromEntries(bi.map((r) => [r.lang, { n: r.n, linked: Number(r.linked) }])),
  };
}

export async function getKaaMonthNames() {
  try {
    const [rows] = await db.query(
      `SELECT month_num AS monthNum, soz, arabic, meaning, etymology,
              gregorian_month AS gregorianMonth, title_id AS titleId
       FROM kaa_month_names
       ORDER BY month_num`
    );
    return rows;
  } catch {
    return [];
  }
}

export async function getKaaCulture() {
  try {
    const [[row]] = await db.query(
      `SELECT payload_json FROM kaa_culture_packs WHERE pack_id = 'all' LIMIT 1`
    );
    if (!row?.payload_json) return null;
    return typeof row.payload_json === 'string'
      ? JSON.parse(row.payload_json)
      : row.payload_json;
  } catch {
    return null;
  }
}

function mapPhraseRow(r) {
  const senses = structureGloss(r.gloss);
  return {
    id: r.id,
    phrase: r.phrase,
    gloss: r.gloss,
    senses,
    variants: r.variants || null,
    source: r.source,
    kind: r.kind,
    titleId: r.title_id || null,
  };
}

export async function searchFrazeologiya({ q = '', limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  const query = String(q || '').trim();

  if (!query) {
    const where = `phrase NOT LIKE '- %'
      AND phrase NOT LIKE '— %'
      AND phrase NOT LIKE '– %'
      AND phrase NOT REGEXP '^[0-9]+\\\\)'`;
    const [rows] = await db.query(
      `SELECT id, phrase, gloss, variants, source, kind, title_id
       FROM kaa_frazeologiya
       WHERE ${where}
       ORDER BY phrase
       LIMIT ? OFFSET ?`,
      [lim, off]
    );
    const [[c]] = await db.query(`SELECT COUNT(*) AS n FROM kaa_frazeologiya WHERE ${where}`);
    return { total: c.n, items: rows.map(mapPhraseRow) };
  }

  const like = `%${query}%`;
  const [rows] = await db.query(
    `SELECT id, phrase, gloss, variants, source, kind, title_id
     FROM kaa_frazeologiya
     WHERE phrase LIKE ? OR gloss LIKE ?
     ORDER BY
       CASE
         WHEN phrase = ? THEN 0
         WHEN phrase LIKE ? THEN 1
         WHEN phrase LIKE ? THEN 2
         ELSE 3
       END,
       phrase
     LIMIT ? OFFSET ?`,
    [like, like, query, `${query}%`, like, lim, off]
  );
  const [[c]] = await db.query(
    `SELECT COUNT(*) AS n FROM kaa_frazeologiya WHERE phrase LIKE ? OR gloss LIKE ?`,
    [like, like]
  );
  return { total: c.n, items: rows.map(mapPhraseRow) };
}

export async function getFrazeologiyaById(id) {
  const [rows] = await db.query(
    `SELECT id, phrase, gloss, variants, source, kind, title_id
     FROM kaa_frazeologiya WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const mapped = mapPhraseRow(rows[0]);
  mapped.senses = await linkSenseAuthors(mapped.senses);
  return mapped;
}
