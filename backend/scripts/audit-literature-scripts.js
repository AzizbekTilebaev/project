/**
 * Audit + safe backfill for dual-script literature columns.
 *
 *   node scripts/audit-literature-scripts.js           # report only
 *   node scripts/audit-literature-scripts.js --apply   # fix safe cases
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { QUIZ_DB_CONFIG } from '../src/config/quiz.db.js';
import {
  detectScript,
  ensureScriptPair,
  parsePoemTrailingMeta,
  toCyrillic,
  toLatin,
} from '../src/utils/qqScript.js';

const APPLY = process.argv.includes('--apply');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(__dirname, '../tmp');

function looksLatin(s) {
  return detectScript(s) === 'latin';
}
function looksCyr(s) {
  return detectScript(s) === 'cyrillic';
}

const report = {
  mode: APPLY ? 'apply' : 'dry-run',
  fixed: [],
  review: [],
  counts: {
    writersFixed: 0,
    booksFixed: 0,
    piecesFixed: 0,
    creativeFixed: 0,
    reviewItems: 0,
  },
};

const db = await mysql.createConnection({ ...QUIZ_DB_CONFIG, charset: 'utf8mb4' });

// --- writers ---
{
  const [rows] = await db.query(
    `SELECT id, slug, poet_name_original, poet_name_latin,
            biography_plain_original, biography_latin,
            birthplace_original, birthplace_latin
     FROM literature_writers`
  );
  for (const r of rows) {
    let nameCyr = r.poet_name_original || '';
    let nameLat = r.poet_name_latin || '';
    let bioCyr = r.biography_plain_original || '';
    let bioLat = r.biography_latin || '';
    let placeCyr = r.birthplace_original || '';
    let placeLat = r.birthplace_latin || '';
    let changed = false;

    if (nameCyr && looksLatin(nameCyr)) {
      if (!nameLat) nameLat = nameCyr;
      nameCyr = toCyrillic(nameLat || nameCyr);
      changed = true;
      report.fixed.push({ table: 'writers', id: r.id, field: 'poet_name', slug: r.slug });
    }
    if (!nameLat && nameCyr) {
      nameLat = toLatin(nameCyr);
      changed = true;
    }
    if (bioCyr && looksLatin(bioCyr)) {
      if (!bioLat) bioLat = bioCyr;
      bioCyr = toCyrillic(bioLat || bioCyr);
      changed = true;
      report.fixed.push({ table: 'writers', id: r.id, field: 'biography', slug: r.slug });
    }
    if (!bioLat && bioCyr) {
      bioLat = toLatin(bioCyr);
      changed = true;
    }
    if (placeCyr && looksLatin(placeCyr)) {
      if (!placeLat) placeLat = placeCyr;
      placeCyr = toCyrillic(placeLat || placeCyr);
      changed = true;
    }
    if (!placeLat && placeCyr) {
      placeLat = toLatin(placeCyr);
      changed = true;
    }
    if (bioCyr && detectScript(bioCyr) === 'mixed') {
      report.review.push({ table: 'writers', id: r.id, slug: r.slug, issue: 'mixed_bio' });
      report.counts.reviewItems += 1;
    }
    if (changed && APPLY) {
      await db.query(
        `UPDATE literature_writers SET
           poet_name_original = ?, poet_name_latin = ?,
           biography_plain_original = ?, biography_latin = ?,
           birthplace_original = NULLIF(?, ''), birthplace_latin = NULLIF(?, '')
         WHERE id = ?`,
        [nameCyr, nameLat, bioCyr, bioLat, placeCyr, placeLat, r.id]
      );
      report.counts.writersFixed += 1;
    } else if (changed) {
      report.counts.writersFixed += 1;
    }
  }
}

// --- books ---
{
  const [rows] = await db.query(
    `SELECT id, title, title_original, title_latin,
            author, author_original, author_latin,
            description, description_original, description_latin
     FROM books`
  );
  for (const r of rows) {
    const fixPair = (orig, lat, stored) => {
      let cyr = orig || '';
      let latin = lat || '';
      let ch = false;
      if (cyr && looksLatin(cyr)) {
        if (!latin) latin = cyr;
        cyr = toCyrillic(latin);
        ch = true;
      } else if (!cyr && stored) {
        if (looksLatin(stored)) {
          latin = latin || stored;
          cyr = toCyrillic(latin);
        } else {
          cyr = stored;
          latin = latin || toLatin(cyr);
        }
        ch = true;
      }
      if (!latin && cyr) {
        latin = toLatin(cyr);
        ch = true;
      }
      if (!cyr && latin) {
        cyr = toCyrillic(latin);
        ch = true;
      }
      return { cyr, latin, ch };
    };
    const t = fixPair(r.title_original, r.title_latin, r.title);
    const a = fixPair(r.author_original, r.author_latin, r.author);
    const d = fixPair(r.description_original, r.description_latin, r.description);
    if ((t.ch || a.ch || d.ch) && APPLY) {
      await db.query(
        `UPDATE books SET
           title = ?, title_original = ?, title_latin = ?,
           author = ?, author_original = ?, author_latin = ?,
           description = ?, description_original = ?, description_latin = ?
         WHERE id = ?`,
        [
          t.cyr || r.title,
          t.cyr,
          t.latin,
          a.cyr || r.author,
          a.cyr,
          a.latin,
          d.cyr || r.description,
          d.cyr || null,
          d.latin || null,
          r.id,
        ]
      );
      report.counts.booksFixed += 1;
      report.fixed.push({ table: 'books', id: r.id, field: 'meta' });
    } else if (t.ch || a.ch || d.ch) {
      report.counts.booksFixed += 1;
    }
  }
}

// --- pieces ---
{
  const [rows] = await db.query(
    `SELECT id, title_original, title_latin, paragraphs_json,
            paragraphs_cyrillic_json, paragraphs_latin_json,
            work_year, work_date_label_original, work_date_label_latin,
            work_place_original, work_place_latin
     FROM literature_pieces`
  );
  for (const r of rows) {
    let titleCyr = r.title_original || '';
    let titleLat = r.title_latin || '';
    if (titleCyr && looksLatin(titleCyr)) {
      titleLat = titleLat || titleCyr;
      titleCyr = toCyrillic(titleLat);
    } else if (!titleLat && titleCyr) {
      titleLat = toLatin(titleCyr);
    }

    let paras = [];
    try {
      paras = JSON.parse(r.paragraphs_json || '[]');
    } catch {
      paras = [];
    }
    if (!Array.isArray(paras)) paras = [];

    let parasCyr = [];
    let parasLat = [];
    try {
      parasCyr = JSON.parse(r.paragraphs_cyrillic_json || '[]');
    } catch {
      parasCyr = [];
    }
    try {
      parasLat = JSON.parse(r.paragraphs_latin_json || '[]');
    } catch {
      parasLat = [];
    }
    if (!Array.isArray(parasCyr)) parasCyr = [];
    if (!Array.isArray(parasLat)) parasLat = [];

    // Peel meta if not yet stored OR if place looks like a day-month token
    let workYear = r.work_year;
    let dateCyr = r.work_date_label_original;
    let dateLat = r.work_date_label_latin;
    let placeCyr = r.work_place_original;
    let placeLat = r.work_place_latin;

    const dayMonthRe =
      /^\d{1,2}\s*[-–.]?\s*(?:январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр|yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentyabr|oktyabr|noyabr|dekabr)/iu;
    const monthOnlyRe =
      /^(?:январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр|yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentyabr|oktyabr|noyabr|dekabr)/iu;

    if (placeCyr && (dayMonthRe.test(placeCyr) || monthOnlyRe.test(placeCyr))) {
      dateCyr = dateCyr ? `${placeCyr}, ${dateCyr}` : placeCyr;
      dateLat = dateCyr ? toLatin(dateCyr) : dateLat;
      placeCyr = null;
      placeLat = null;
    }

    const sourceParas = parasCyr.length ? parasCyr : paras;
    const peeled = parsePoemTrailingMeta(sourceParas);
    if ((!workYear && peeled.meta.workYear) || (!dateCyr && peeled.meta.workDateLabelCyrillic)) {
      workYear = workYear || peeled.meta.workYear;
      dateCyr = dateCyr || peeled.meta.workDateLabelCyrillic;
      dateLat = dateLat || peeled.meta.workDateLabelLatin;
      if (!placeCyr) {
        placeCyr = peeled.meta.workPlaceCyrillic;
        placeLat = peeled.meta.workPlaceLatin;
      }
    }

    const body = peeled.paragraphs.length ? peeled.paragraphs : sourceParas;
    if (!parasCyr.length || !parasLat.length || body.length !== parasCyr.length) {
      parasCyr = body.map((p) => ensureScriptPair(p).cyrillic);
      parasLat = body.map((p) => ensureScriptPair(p).latin);
    }

    if (APPLY) {
      await db.query(
        `UPDATE literature_pieces SET
           title_original = ?, title_latin = ?,
           paragraphs_json = ?, paragraphs_cyrillic_json = ?, paragraphs_latin_json = ?,
           work_year = ?, work_date_label_original = ?, work_date_label_latin = ?,
           work_place_original = ?, work_place_latin = ?
         WHERE id = ?`,
        [
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
          r.id,
        ]
      );
      report.counts.piecesFixed += 1;
    } else {
      report.counts.piecesFixed += 1;
    }
  }
}

// --- creative works bodies ---
{
  const [rows] = await db.query(
    `SELECT id, body_text, body_text_cyrillic, body_text_latin FROM writer_creative_works`
  );
  for (const r of rows) {
    if (!r.body_text && !r.body_text_cyrillic && !r.body_text_latin) continue;
    const pair = ensureScriptPair(r.body_text_cyrillic || r.body_text_latin || r.body_text || '');
    if (APPLY) {
      await db.query(
        `UPDATE writer_creative_works SET
           body_text = ?, body_text_cyrillic = ?, body_text_latin = ?
         WHERE id = ?`,
        [pair.cyrillic || r.body_text, pair.cyrillic || null, pair.latin || null, r.id]
      );
      report.counts.creativeFixed += 1;
    } else if (!r.body_text_cyrillic || !r.body_text_latin) {
      report.counts.creativeFixed += 1;
    }
  }
}

await db.end();
fs.mkdirSync(TMP, { recursive: true });
const outPath = path.join(TMP, `literature-script-audit-${Date.now()}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ ...report, fixed: report.fixed.slice(0, 20), auditPath: outPath }, null, 2));
