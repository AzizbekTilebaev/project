import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { pathToFileURL } from 'url';
import db from '../src/config/dictionary.db.js';

const { splitExamples } = await import(
  pathToFileURL(path.resolve('../fordata/tools/lib/transform.js')).href
);

const WRITE = process.argv.includes('--write');
// Sitata ta'rif oxirida ham, o'rtasida (gap oxirida) ham bo'lishi mumkin
const CITATION_END = /\(([^)]{1,80})\)\s*\.?\s*$/;
const CITATION_MID = /\(([^)]{1,80})\)\s*\.\s+/;

function endWithDot(s) {
  return /\.$/.test(s.trim()) ? s.trim() : s.trim() + '.';
}

const [descs] = await db.query(
  `SELECT d.id, d.titles_id, d.description, t.soz
   FROM description d JOIN titles t ON d.titles_id = t.id`
);

let merged = 0; // author-less rebuilt into def
let extracted = 0; // new citation examples pulled out
let touchedDesc = 0;
const samples = [];

const conn = WRITE ? await db.getConnection() : null;
if (conn) await conn.beginTransaction();

try {
  for (const d of descs) {
    const [exRows] = await (conn || db).query(
      'SELECT id, example, author, sort_order FROM examples WHERE descriptions_id = ? ORDER BY sort_order',
      [d.id]
    );
    const authorless = exRows.filter((e) => !e.author || !e.author.trim());
    const authored = exRows.filter((e) => e.author && e.author.trim());

    const defHasCitation =
      CITATION_END.test(d.description) || CITATION_MID.test(d.description);
    if (authorless.length === 0 && !defHasCitation) continue;

    // Reconstruct candidate: definition + author-less fragments appended back
    let candidate = d.description.trim();
    for (const a of authorless) {
      candidate = endWithDot(candidate) + ' ' + a.example.trim();
    }

    const { definition, example } = splitExamples(candidate);

    // Nothing meaningfully changed
    const newDef = definition.trim();
    const changedDef = newDef !== d.description.trim();
    const newCitationExamples = example; // all citation-backed

    if (!changedDef && newCitationExamples.length === 0) continue;

    touchedDesc++;
    if (authorless.length) merged += authorless.length;
    extracted += newCitationExamples.length;

    if (samples.length < 15) {
      samples.push({
        soz: d.soz,
        before_def: d.description.slice(0, 70),
        after_def: newDef.slice(0, 70),
        authorless_removed: authorless.length,
        new_examples: newCitationExamples.map((e) => `${e.example.slice(0, 40)} (${e.author})`),
      });
    }

    if (WRITE) {
      await conn.query('UPDATE description SET description = ? WHERE id = ?', [newDef, d.id]);
      // remove author-less rows (folded back into def or re-extracted with author)
      for (const a of authorless) {
        await conn.query('DELETE FROM examples WHERE id = ?', [a.id]);
      }
      // insert freshly extracted citation examples (avoid dup with existing authored)
      const existingKeys = new Set(authored.map((e) => (e.example || '').trim()));
      let order = authored.length;
      for (const ex of newCitationExamples) {
        if (existingKeys.has(ex.example.trim())) continue;
        order++;
        const id = Math.random().toString(36).slice(2, 10);
        await conn.query(
          'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?,?,?,?,?,1)',
          [id, d.id, ex.example.trim(), ex.author || null, order]
        );
      }
    }
  }

  if (conn) {
    await conn.commit();
    conn.release();
  }
} catch (e) {
  if (conn) {
    await conn.rollback();
    conn.release();
  }
  console.error('failed', e);
  await db.end();
  process.exit(1);
}

console.log(JSON.stringify({ mode: WRITE ? 'WRITE' : 'DRY-RUN', touchedDesc, mergedAuthorless: merged, extractedCitations: extracted }, null, 2));
console.log('\nNamunalar:');
for (const s of samples) {
  console.log('\n===', s.soz);
  console.log('  oldin:', s.before_def);
  console.log('  keyin:', s.after_def);
  console.log('  o\u2018chirilgan avtorsiz:', s.authorless_removed, '| yangi misol:', s.new_examples);
}
await db.end();
