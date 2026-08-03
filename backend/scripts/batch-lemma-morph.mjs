/**
 * Sózlik (titles) bas formaların túbir+qosımtaǵa bóledi (qq segmenter, lemmaMode).
 *
 *   node scripts/batch-lemma-morph.mjs           # tek statistika
 *   node scripts/batch-lemma-morph.mjs --apply   # title_morphology ga jazıw
 *
 * source = 'qq-approx' (taxminiy). Anıq túbir = root sózlikte bar.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { analyzeWord, stripLemmaNoise } from '../src/services/morphologyService.js';
import { toLatin, toCyrillic } from '../src/utils/qqScript.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const OUT = path.join(__dirname, '../../fordata/grammar/lemma-morph-stats.json');

function headwordLatin(soz) {
  return stripLemmaNoise(soz);
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.KK_TUSINDIRME_DB || 'kk_tusindirme',
    charset: 'utf8mb4',
  });

  const [titles] = await pool.query(
    `SELECT id, soz FROM titles WHERE status = 1 ORDER BY \`order\` ASC`
  );

  const rootSet = new Set();
  const latinToId = new Map();
  for (const t of titles) {
    const L = headwordLatin(t.soz);
    if (!L || /\s/.test(L)) continue;
    rootSet.add(L);
    if (!latinToId.has(L)) latinToId.set(L, t.id);
  }
  const isRoot = (c) => rootSet.has(c);

  console.log(`titles: ${titles.length}, rootSet: ${rootSet.size}`);

  if (APPLY) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS title_morphology (
        title_id VARCHAR(64) NOT NULL,
        surface_latin VARCHAR(191) NOT NULL,
        lemma_latin VARCHAR(191) NULL,
        tags_json JSON NULL,
        analyses_json JSON NULL,
        segments_json JSON NULL,
        display_split VARCHAR(512) NULL,
        is_unknown TINYINT(1) NOT NULL DEFAULT 0,
        source VARCHAR(32) NOT NULL DEFAULT 'apertium-kaa',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (title_id),
        KEY idx_tm_lemma (lemma_latin),
        KEY idx_tm_surface (surface_latin)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  const affixCounts = new Map();
  let withSuffixes = 0;
  let knownRoot = 0;
  let knownRootWithSuffixes = 0;
  let bareKnown = 0;
  let unknownRoot = 0;
  let multiWord = 0;
  const samples = { good: [], bare: [], unknown: [], multi: [] };

  const upserts = [];
  const t0 = Date.now();

  for (let i = 0; i < titles.length; i++) {
    const t = titles[i];
    const latin = headwordLatin(t.soz);
    if (!latin) continue;
    if (/\s/.test(latin)) {
      multiWord++;
      if (samples.multi.length < 8) samples.multi.push(t.soz);
      continue;
    }

    const a = await analyzeWord(latin, {
      script: 'latin',
      isRoot,
      lemmaMode: true,
    });

    for (const s of a.suffixes) {
      affixCounts.set(s.latin, (affixCounts.get(s.latin) || 0) + 1);
    }

    if (a.hasSuffixes) withSuffixes++;
    if (a.rootIsKnown) {
      knownRoot++;
      if (a.hasSuffixes) knownRootWithSuffixes++;
      else bareKnown++;
    } else {
      unknownRoot++;
    }

    if (a.hasSuffixes && a.rootIsKnown && samples.good.length < 12) {
      samples.good.push({ soz: t.soz, split: a.displaySplit });
    } else if (!a.hasSuffixes && a.rootIsKnown && samples.bare.length < 6) {
      samples.bare.push(t.soz);
    } else if (!a.rootIsKnown && samples.unknown.length < 10) {
      samples.unknown.push({ soz: t.soz, split: a.displaySplit });
    }

    if (APPLY) {
      const rootId = a.rootIsKnown ? latinToId.get(a.rootLatin) || null : null;
      const segments = a.segments.map((s) => ({
        surface: s.latin,
        slot: s.slot,
        role: s.role,
        gloss: s.gloss || undefined,
        isRoot: !!s.isRoot,
        isKnown: !!s.isKnown,
      }));
      const tags = a.suffixes.map((s) => ({
        tag: s.slot,
        gloss: s.gloss || s.role,
        form: s.latin,
      }));
      upserts.push([
        t.id,
        latin.slice(0, 191),
        a.rootLatin.slice(0, 191),
        JSON.stringify(tags),
        JSON.stringify({
          approximate: true,
          rootIsKnown: a.rootIsKnown,
          rootTitleId: rootId,
          rootCyrillic: toCyrillic(a.rootLatin),
          engine: 'qq-segmenter-lemma',
        }),
        JSON.stringify(segments),
        (a.displaySplit || latin).slice(0, 512),
        a.rootIsKnown ? 0 : 1,
        'qq-approx',
      ]);
    }

    if ((i + 1) % 2000 === 0) {
      console.log(`  … ${i + 1}/${titles.length} (${Date.now() - t0}ms)`);
    }
  }

  if (APPLY && upserts.length) {
    const chunk = 200;
    for (let i = 0; i < upserts.length; i += chunk) {
      const part = upserts.slice(i, i + chunk);
      const ph = part.map(() => '(?,?,?,?,?,?,?,?,?)').join(',');
      await pool.query(
        `INSERT INTO title_morphology
          (title_id, surface_latin, lemma_latin, tags_json, analyses_json,
           segments_json, display_split, is_unknown, source)
         VALUES ${ph}
         ON DUPLICATE KEY UPDATE
           surface_latin=VALUES(surface_latin),
           lemma_latin=VALUES(lemma_latin),
           tags_json=VALUES(tags_json),
           analyses_json=VALUES(analyses_json),
           segments_json=VALUES(segments_json),
           display_split=VALUES(display_split),
           is_unknown=VALUES(is_unknown),
           source=VALUES(source)`,
        part.flat()
      );
    }
    console.log(`DB: ${upserts.length} qator jazıldı (source=qq-approx)`);
  }

  const topAffixes = [...affixCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([form, n]) => ({ form, n }));

  const stats = {
    generatedAt: new Date().toISOString(),
    applied: APPLY,
    titles: titles.length,
    rootSetSize: rootSet.size,
    multiWordSkipped: multiWord,
    withSuffixes,
    knownRoot,
    knownRootWithSuffixes,
    bareKnownRoot: bareKnown,
    unknownRoot,
    pctKnownRoot: +((knownRoot / titles.length) * 100).toFixed(1),
    pctWithSuffixes: +((withSuffixes / titles.length) * 100).toFixed(1),
    pctKnownRootAmongSplit: withSuffixes
      ? +((knownRootWithSuffixes / withSuffixes) * 100).toFixed(1)
      : 0,
    topAffixes,
    samples,
    elapsedMs: Date.now() - t0,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(stats, null, 2));
  console.log('\n=== STATISTIKA ===');
  console.log(JSON.stringify({
    titles: stats.titles,
    withSuffixes: stats.withSuffixes,
    knownRoot: stats.knownRoot,
    knownRootWithSuffixes: stats.knownRootWithSuffixes,
    bareKnownRoot: stats.bareKnownRoot,
    unknownRoot: stats.unknownRoot,
    pctKnownRoot: stats.pctKnownRoot,
    pctWithSuffixes: stats.pctWithSuffixes,
    pctKnownRootAmongSplit: stats.pctKnownRootAmongSplit,
    topAffixes: topAffixes.slice(0, 15),
    samples: stats.samples,
    elapsedMs: stats.elapsedMs,
  }, null, 2));
  console.log('saved', OUT);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
