#!/usr/bin/env node
/**
 * apertium raw morfologiya → MySQL title_morphology
 *
 * Kirish:
 *   tmp/apertium/dict-words.lat.txt
 *   tmp/apertium/dict-morph.raw.txt   (lt-proc/hfst-proc -w)
 *   tmp/apertium/dict-words.map.jsonl
 *
 * Ishlatish:
 *   node scripts/import-apertium-morph.mjs
 *   node scripts/import-apertium-morph.mjs --dry
 *
 * Runtime: ilova apertiumga bog‘lanmaydi — faqat shu jadvalni o‘qiydi.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { analyzeWord } from '../src/services/morphologyService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const dry = args.includes('--dry');

const OUT_DIR = path.resolve(__dirname, '../tmp/apertium');
const WORDS = path.join(OUT_DIR, 'dict-words.lat.txt');
const RAW = path.join(OUT_DIR, 'dict-morph.raw.txt');
const MAP = path.join(OUT_DIR, 'dict-words.map.jsonl');

function parseLtProcLine(line) {
  // ^kitapqa/kitap<n><dat>/kitap<n><dat><err>$  yoki  ^unknown/*unknown$
  const m = String(line || '').trim().match(/^\^([^/$*]+)\/(.+)\$$/);
  if (!m) return null;
  const surface = m[1];
  const body = m[2];
  if (body.startsWith('*') || body === surface) {
    return { surface, analyses: [], unknown: true };
  }
  const analyses = body.split('/').map((chunk) => {
    const tags = [...chunk.matchAll(/<([^>]+)>/g)].map((x) => x[1]);
    // "qıyınshılıq<n>+sız<post>" → lemma = qıyınshılıq
    const lemma = chunk.replace(/<[^>]+>/g, '').split('+')[0];
    return { lemma, tags, raw: chunk };
  });
  return { surface, analyses, unknown: analyses.length === 0 };
}

function pickBest(analyses) {
  if (!analyses?.length) return null;
  // Afzal: surface qosımta ajratilgan analiz (lemma+affix, masalan qıyınshılıq+sız)
  // Keyin: eng kam teg / qisqa lemma
  const scored = analyses.map((a) => {
    const hasPlus = a.raw.includes('+') ? 0 : 1;
    const isUnknown = a.lemma.startsWith('*') ? 10 : 0;
    return { a, score: isUnknown * 1000 + hasPlus * 100 + a.tags.length + a.lemma.length / 100 };
  });
  scored.sort((x, y) => x.score - y.score);
  return scored[0].a;
}

/** apertium raw: "qıyınshılıq<n>+sız<post>" → surface bo‘laklar */
function segmentsFromApertiumRaw(raw, surface) {
  if (!raw || !raw.includes('+')) return null;
  // lemma<tags>+affix<tags>+...
  const parts = raw.split('+').map((p) => {
    const tags = [...p.matchAll(/<([^>]+)>/g)].map((x) => x[1]);
    const text = p.replace(/<[^>]+>/g, '');
    return { text, tags };
  });
  if (parts.length < 2 || !parts[0].text) return null;

  // Surface bo‘yicha affix matnlarini tiklash (sız, menen, ...)
  const segs = [];
  let rest = surface;
  // Oxiridan: har bir affix (1..) surface so‘ngida turishi kerak
  const affixes = parts.slice(1).reverse();
  const foundAff = [];
  for (const af of affixes) {
    // postposition/clitic formalar
    const candidates = [af.text, af.text.replace(/^e$/, '')].filter(Boolean);
    let hit = null;
    for (const c of candidates) {
      if (c && rest.endsWith(c)) {
        hit = c;
        break;
      }
    }
    // +sız post — surface "sız"/"siz"
    if (!hit && af.tags.includes('post')) {
      for (const c of ['sız', 'siz', 'lı', 'li', 'day', 'dey']) {
        if (rest.endsWith(c)) {
          hit = c;
          break;
        }
      }
    }
    if (!hit) return null;
    foundAff.unshift({
      text: hit,
      slot: af.tags.includes('post') ? 'derivation' : 'clitic',
      role: af.tags.map((t) => TAG_GLOSS[t] || t).join(', '),
      gloss: af.tags.map((t) => TAG_GLOSS[t] || t).join(', '),
      isRoot: false,
    });
    rest = rest.slice(0, rest.length - hit.length);
  }
  if (!rest) return null;
  segs.push({
    text: rest,
    slot: 'root',
    role: 'tübir',
    gloss: parts[0].tags.map((t) => TAG_GLOSS[t] || t).join(', '),
    isRoot: true,
  });
  segs.push(...foundAff);
  return segs;
}

/** Apertium teg → o‘quvchi uchun qaraqalpaq/lotin gloss */
const TAG_GLOSS = {
  n: 'atlıq',
  np: 'menshiklik atlıq',
  adj: 'kelbetlik',
  v: 'feyil',
  adv: 'ráwish',
  num: 'san',
  prn: 'almash',
  sg: 'birlik',
  pl: 'kóplik',
  px1sg: 'tartım I jaq',
  px2sg: 'tartım II jaq',
  px3sp: 'tartım III jaq',
  px1pl: 'tartım I kóplik',
  px2pl: 'tartım II kóplik',
  nom: 'ataw seplik',
  gen: 'iyelik seplik',
  dat: 'barıs seplik',
  acc: 'tabıs seplik',
  abl: 'shıǵıs seplik',
  loc: 'jatıs seplik',
  ins: 'kómekshi seplik',
  abe: 'josızlıq (-sız)',
  past: 'ótken máhál',
  ifi: 'ótken (-dı)',
  aor: 'házirgi/awısıq',
  fut: 'kelesi',
  neg: 'bolımsız',
  pass: 'passiv',
  caus: 'sebepshilik',
  coop: 'birgelikte',
  tv: 'ótpewshi',
  iv: 'ótpewshi emes',
  p1: 'I jaq',
  p2: 'II jaq',
  p3: 'III jaq',
};

async function ensureTable(db) {
  // titles.id — UUID/string; INT emas
  await db.query(`
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

if (!fs.existsSync(WORDS) || !fs.existsSync(RAW) || !fs.existsSync(MAP)) {
  console.error('Kerakli fayllar yo‘q. Avval export + 02-analyze-dict.sh');
  process.exit(1);
}

const wordsFile = fs.existsSync(path.join(OUT_DIR, 'dict-words.analyzed.txt'))
  ? path.join(OUT_DIR, 'dict-words.analyzed.txt')
  : WORDS;
const words = fs.readFileSync(wordsFile, 'utf8').split(/\r?\n/).filter(Boolean);
const rawLines = fs.readFileSync(RAW, 'utf8').split(/\r?\n/).filter(Boolean);
const mapRows = fs
  .readFileSync(MAP, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));

// surface → apertium parse — qator indeksi yoki ^surface/ dan
const bySurface = new Map();
const n = Math.min(words.length, rawLines.length);
for (let i = 0; i < n; i++) {
  const parsed = parseLtProcLine(rawLines[i]) || {
    surface: words[i],
    analyses: [],
    unknown: true,
  };
  bySurface.set(words[i], parsed);
  if (parsed.surface) bySurface.set(parsed.surface, parsed);
}

console.log(`words: ${words.length}, raw: ${rawLines.length}, map: ${mapRows.length}`);

const pool = await mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.KK_TUSINDIRME_DB || process.env.DATABASE_TUSINDIRME || 'kk_tusindirme',
  charset: 'utf8mb4',
});

if (!dry) await ensureTable(pool);

let ok = 0;
let unk = 0;
let withSeg = 0;

for (const row of mapRows) {
  const parsed = bySurface.get(row.latin) || {
    surface: row.latin,
    analyses: [],
    unknown: true,
  };
  const best = pickBest(parsed.analyses);
  const lemma = best?.lemma || null;
  const tags = best?.tags || [];

  // 1) Apertium +affix (qıyınshılıq+sız)
  // 2) JS stripper lemma langar (azıqlandır+ıw)
  let segments = [];
  let displaySplit = row.latin;
  if (lemma && lemma.length >= 2) {
    const fromApt = best?.raw ? segmentsFromApertiumRaw(best.raw, row.latin) : null;
    if (fromApt?.length) {
      segments = fromApt;
      // Ichki tübirni yanada bólish: qıyınshılıq → qıyın+shılıq
      const rootPart = segments[0];
      if (rootPart?.isRoot && rootPart.text.length > 4) {
        const deeper = await analyzeWord(rootPart.text, {
          script: 'latin',
          isRoot: (cand) => cand.length >= 3 && rootPart.text.startsWith(cand) && cand !== rootPart.text,
        });
        // Faqat haqiqiy qosımta topilsa va qaldıq yetarli bo‘lsa
        if (deeper.hasSuffixes && deeper.rootLatin.length >= 3) {
          const inner = deeper.segments.map((s) => ({
            text: s.latin || s.text,
            slot: s.slot,
            role: s.role,
            gloss: s.gloss,
            isRoot: Boolean(s.isRoot),
          }));
          segments = [...inner, ...segments.slice(1)];
        }
      }
    } else {
      const analysis = await analyzeWord(row.latin, {
        script: 'latin',
        // Faqat apertium lemma — qıyın → qıy+ın kabi ortiqcha kesilmasin
        isRoot: (cand) => cand === lemma,
      });
      if (analysis.hasSuffixes) {
        segments = analysis.segments.map((s) => ({
          text: s.latin || s.text,
          slot: s.slot,
          role: s.role,
          gloss: s.gloss,
          isRoot: Boolean(s.isRoot),
        }));
      } else if (row.latin.startsWith(lemma) && row.latin.length > lemma.length) {
        const rest = row.latin.slice(lemma.length);
        segments = [
          { text: lemma, slot: 'root', role: 'tübir', gloss: '', isRoot: true },
          {
            text: rest,
            slot: 'derivation',
            role: 'qosımta',
            gloss: tags.map((t) => TAG_GLOSS[t] || t).join(', '),
            isRoot: false,
          },
        ];
      } else {
        segments = [
          {
            text: lemma,
            slot: 'root',
            role: 'tübir',
            gloss: tags.map((t) => TAG_GLOSS[t] || t).join(', '),
            isRoot: true,
          },
        ];
      }
    }
    displaySplit = segments.map((s) => String(s.text).toUpperCase()).join('+');
    if (segments.length > 1) withSeg += 1;
  }

  const tagGloss = tags.map((t) => ({ tag: t, gloss: TAG_GLOSS[t] || t }));
  const isUnknown = parsed.unknown || !best ? 1 : 0;
  if (isUnknown) unk += 1;
  else ok += 1;

  if (dry) {
    if (ok + unk <= 12) {
      console.log(
        `${row.soz} → ${displaySplit} | lemma=${lemma || '?'} tags=${tags.join('.')}`
      );
    }
    continue;
  }

  await pool.query(
    `INSERT INTO title_morphology
      (title_id, surface_latin, lemma_latin, tags_json, analyses_json, segments_json, display_split, is_unknown, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'apertium-kaa')
     ON DUPLICATE KEY UPDATE
      surface_latin=VALUES(surface_latin),
      lemma_latin=VALUES(lemma_latin),
      tags_json=VALUES(tags_json),
      analyses_json=VALUES(analyses_json),
      segments_json=VALUES(segments_json),
      display_split=VALUES(display_split),
      is_unknown=VALUES(is_unknown),
      source=VALUES(source)`,
    [
      row.id,
      row.latin,
      lemma,
      JSON.stringify(tagGloss),
      JSON.stringify(parsed.analyses || []),
      JSON.stringify(segments),
      displaySplit,
      isUnknown,
    ]
  );
}

console.log(`known: ${ok}, unknown: ${unk}, with_segments: ${withSeg}`);
if (dry) console.log('(dry — DB yozilmadi)');
else console.log('title_morphology yangilandi');

await pool.end();
