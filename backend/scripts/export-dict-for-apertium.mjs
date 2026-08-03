#!/usr/bin/env node
/**
 * kk_tusindirme titles → latin so‘zlar ro‘yxati (apertium uchun).
 *
 * Chiqish:
 *   backend/tmp/apertium/dict-words.lat.txt   — faqat latin (1 qator = 1 so‘z)
 *   backend/tmp/apertium/dict-words.map.jsonl — id\tsoz\tlatin (import uchun)
 *
 * Ishlatish:
 *   node scripts/export-dict-for-apertium.mjs
 *   node scripts/export-dict-for-apertium.mjs --limit 100
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { toLatin } from '../src/utils/qqScript.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const limit = args.includes('--limit')
  ? Number(args[args.indexOf('--limit') + 1])
  : Infinity;

const OUT_DIR = path.resolve(__dirname, '../tmp/apertium');
const WORDS = path.join(OUT_DIR, 'dict-words.lat.txt');
const MAP = path.join(OUT_DIR, 'dict-words.map.jsonl');

function bareHeadword(soz) {
  // "АЗЫҚ І" / "АЗЫҚ II" → "АЗЫҚ"
  return String(soz || '')
    .replace(/\s+(I{1,3}|IV|V|VI{0,3}|IX|X|[І]{1,3}|[І]V|V[І]{0,2})$/u, '')
    .trim();
}

function toApertiumLatin(soz) {
  // apertium-kaa 2016 latin; g' emas ǵ
  // hfst-proc stream: /, \, ^, $ — maxsus; ko‘p forma (a//b) yoki bo‘shliqli iboralarni
  // birinchi token sifatida olamiz.
  let s = toLatin(bareHeadword(soz))
    .toLowerCase()
    .trim()
    .replace(/g'/g, 'ǵ')
    .replace(/G'/g, 'Ǵ');
  // JS toLowerCase: Í→í, lekin apertium-kaa / milliy orfografiya: ı (dotless)
  s = s.replace(/í/g, 'ı');
  // "ebese//emese", "akusher/akusherka" → birinchi forma
  s = s.split(/\s*\/+\s*/)[0].trim();
  // bo‘shliqli ibora: birinchi so‘z
  if (/\s/.test(s)) s = s.split(/\s+/)[0];
  // stream-xavfli belgilarni olib tashlash
  s = s.replace(/[/\\^*$]+/g, '');
  // faqat harf/apostrof/tire
  s = s.replace(/[^a-záäéíóöúüńǵıʼ'\-]/gi, '');
  return s;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const pool = await mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.KK_TUSINDIRME_DB || process.env.DATABASE_TUSINDIRME || 'kk_tusindirme',
  charset: 'utf8mb4',
});

const [rows] = await pool.query(
  `SELECT id, soz, normalized
   FROM titles
   WHERE status = 1
   ORDER BY \`order\`, id
   ${Number.isFinite(limit) ? `LIMIT ${Number(limit)}` : ''}`
);

const latLines = [];
const mapLines = [];
const seenLat = new Set();

for (const r of rows) {
  const latin = toApertiumLatin(r.soz);
  if (!latin || latin.length < 2) continue;
  mapLines.push(JSON.stringify({ id: r.id, soz: r.soz, latin }));
  // apertiumga unique latin (bir xil forma bir marta)
  if (!seenLat.has(latin)) {
    seenLat.add(latin);
    latLines.push(latin);
  }
}

fs.writeFileSync(WORDS, latLines.join('\n') + '\n', 'utf8');
fs.writeFileSync(MAP, mapLines.join('\n') + '\n', 'utf8');

console.log(`titles: ${rows.length}`);
console.log(`unique latin: ${latLines.length}`);
console.log(`wrote ${WORDS}`);
console.log(`wrote ${MAP}`);

await pool.end();
