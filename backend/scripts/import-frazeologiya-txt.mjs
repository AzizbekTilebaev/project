/**
 * Import Qaraqalpaq frazeologizmler sózligi (TXT) → kaa_frazeologiya
 *
 *   node scripts/import-frazeologiya-txt.mjs           # dry-run
 *   node scripts/import-frazeologiya-txt.mjs --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, 'backend/.env') });

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const SOURCE = 'paxratdinov-bekniyazov-2018';
const TXT = path.join(ROOT, 'new/qaraqalpaq_frazeologizmler_sozligi.txt');

function parseEntries(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const out = [];
  const used = new Set();

  function push(phrase, gloss) {
    phrase = String(phrase || '')
      .replace(/\s+/g, ' ')
      .trim();
    gloss = String(gloss || '')
      .replace(/\s+/g, ' ')
      .trim();
    // letter section headers from OCR: "- K", "— M"
    if (/^[—–-]\s*[A-Za-zА-Яа-яӘәӨөҮүҚқҒғҢңЎўІіЁё]\s*$/.test(phrase)) return;
    if (phrase.length < 3 || gloss.length < 2) return;
    if (phrase.length > 500) phrase = phrase.slice(0, 500);
    const key = phrase.toLocaleLowerCase('kk');
    if (used.has(key)) return;
    used.add(key);
    out.push({ phrase, gloss, source: SOURCE, kind: 'dictionary' });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith('=') || /ФРАЗЕОЛОГИЗМ|Пахратдинов|Бекниязов/.test(line)) continue;

    const em = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (em) {
      push(em[1], em[2]);
      continue;
    }

    const hyphen = line.match(/^(.+?)\s+-\s+(.+)$/);
    if (hyphen && hyphen[1].length <= 80) {
      push(hyphen[1], hyphen[2]);
      continue;
    }

    const sense = line.match(/^(.{2,90}?)\s+(\d+\))\s*(.+)$/);
    if (sense) {
      push(sense[1], `${sense[2]} ${sense[3]}`.trim());
      continue;
    }

    // phrase on this line, gloss on next (OCR break)
    const next = lines[i + 1];
    if (
      next &&
      !/[—–]/.test(line) &&
      line.length <= 70 &&
      !/\d+\)/.test(line) &&
      !/[.!?]$/.test(line) &&
      next.length >= 4 &&
      !next.startsWith('=') &&
      !/[—–]/.test(next.slice(0, 40))
    ) {
      push(line, next);
      i += 1;
      continue;
    }

    // "phrase gloss" without separator: last verb-ish chunk heuristic — skip low confidence
  }

  return out;
}

async function main() {
  if (!fs.existsSync(TXT)) {
    console.error('Missing', TXT);
    process.exit(1);
  }
  const entries = parseEntries(fs.readFileSync(TXT, 'utf8'));
  console.log(`Parsed ${entries.length} entries from TXT`);
  console.log('sample:', entries[0]);
  console.log('sample mid:', entries[Math.floor(entries.length / 2)]);

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write DB.');
    return;
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'kk_tusindirme',
    charset: 'utf8mb4',
  });

  await db.query(`
    CREATE TABLE IF NOT EXISTS kaa_frazeologiya (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      phrase varchar(512) NOT NULL,
      gloss text NOT NULL,
      variants text NULL,
      source varchar(64) NOT NULL,
      kind varchar(32) NOT NULL DEFAULT 'dictionary',
      title_id varchar(64) NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_phrase (phrase),
      KEY idx_source (source),
      KEY idx_fraz_title (title_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (FORCE) {
    await db.query(`DELETE FROM kaa_frazeologiya WHERE source = ?`, [SOURCE]);
    console.log('Cleared previous rows for', SOURCE);
  }

  // Keep older small seed; replace duplicates by phrase for this source
  await db.query(`DELETE FROM kaa_frazeologiya WHERE source = ?`, [SOURCE]);

  const chunk = 200;
  let inserted = 0;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk);
    const values = slice.map((e) => [e.phrase, e.gloss, null, e.source, e.kind]);
    await db.query(
      `INSERT INTO kaa_frazeologiya (phrase, gloss, variants, source, kind) VALUES ?`,
      [values]
    );
    inserted += slice.length;
    if (inserted % 1000 === 0 || inserted === entries.length) {
      console.log(`… ${inserted}/${entries.length}`);
    }
  }

  const [[n]] = await db.query(`SELECT COUNT(*) n FROM kaa_frazeologiya`);
  console.log('Done. Table total:', n.n);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
