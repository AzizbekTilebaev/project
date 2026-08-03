/**
 * Premium 50 curated sózler ushın immersiya audio seed (Windows SAPI → WAV).
 * Paydalanıw: node scripts/seed-immersion-curated.js
 * Qayta seed: node scripts/seed-immersion-curated.js --force
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FORCE = process.argv.includes('--force');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : 50;

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT) || 3306;
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASS || '';
const tusindirme = process.env.KK_TUSINDIRME_DB || 'kk_tusindirme';
const aiDb = process.env.KK_AI_DB || 'kk_ai_db';

const uploadDir = process.env.IMMERSION_UPLOAD_DIR
  ? path.isAbsolute(process.env.IMMERSION_UPLOAD_DIR)
    ? process.env.IMMERSION_UPLOAD_DIR
    : path.resolve(__dirname, '..', process.env.IMMERSION_UPLOAD_DIR)
  : path.resolve(__dirname, '../public/uploads/immersion');

fs.mkdirSync(uploadDir, { recursive: true });

function speakToWav(text, outPath) {
  const b64 = Buffer.from(String(text), 'utf8').toString('base64');
  const ps = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1
$synth.Volume = 100
$bytes = [Convert]::FromBase64String('${b64}')
$speakText = [Text.Encoding]::UTF8.GetString($bytes)
$synth.SetOutputToWaveFile(${JSON.stringify(outPath)})
$synth.Speak($speakText)
$synth.Dispose()
`;
  const tmp = path.join(uploadDir, `_tts_${crypto.randomUUID()}.ps1`);
  fs.writeFileSync(tmp, `\uFEFF${ps}`, 'utf8');
  try {
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp],
      { encoding: 'utf8', windowsHide: true }
    );
    if (r.status !== 0) {
      throw new Error(r.stderr || r.stdout || `TTS exit ${r.status}`);
    }
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 44) {
      throw new Error('WAV fayl jaratılmadı');
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

const conn = await mysql.createConnection({
  host,
  port,
  user,
  password,
  charset: 'utf8mb4',
  multipleStatements: false,
});

await conn.query(
  `CREATE TABLE IF NOT EXISTS \`${aiDb}\`.immersion_assets (
    id CHAR(36) NOT NULL,
    title_id VARCHAR(64) NULL,
    kind ENUM('model3d','video','audio') NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'primary',
    original_name VARCHAR(255) NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NULL,
    file_size INT NULL,
    duration_ms INT NULL,
    status ENUM('processing','ready','rejected') NOT NULL DEFAULT 'processing',
    uploaded_by VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_immersion_title (title_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
);

const [curated] = await conn.query(
  `SELECT cw.sort_order,
          cw.title_id AS soz_key,
          COALESCE(t.id, t2.id) AS title_uuid,
          COALESCE(t.soz, t2.soz, cw.title_id) AS soz
   FROM \`${tusindirme}\`.curated_words cw
   LEFT JOIN \`${tusindirme}\`.titles t
     ON t.id = cw.title_id AND t.status = 1
   LEFT JOIN \`${tusindirme}\`.titles t2
     ON t2.soz = cw.title_id AND t2.status = 1
   ORDER BY cw.sort_order
   LIMIT ?`,
  [LIMIT]
);

const words = curated.filter((r) => r.title_uuid);
console.log(`Curated: ${curated.length}, UUID tabıldı: ${words.length}`);

let created = 0;
let skipped = 0;
let failed = 0;

for (const row of words) {
  const titleId = String(row.title_uuid);
  const soz = String(row.soz || row.soz_key || '').trim();
  if (!soz) {
    skipped += 1;
    continue;
  }

  const [existing] = await conn.query(
    `SELECT id, stored_name FROM \`${aiDb}\`.immersion_assets
     WHERE title_id = ? AND kind = 'audio' AND status = 'ready' LIMIT 1`,
    [titleId]
  );

  if (existing.length && !FORCE) {
    skipped += 1;
    continue;
  }

  if (existing.length && FORCE) {
    for (const old of existing) {
      const oldPath = path.join(uploadDir, old.stored_name);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {
        /* ignore */
      }
      await conn.query(`DELETE FROM \`${aiDb}\`.immersion_assets WHERE id = ?`, [old.id]);
    }
  }

  const storedName = `${crypto.randomUUID()}.wav`;
  const fullPath = path.join(uploadDir, storedName);

  try {
    speakToWav(soz, fullPath);
    const stat = fs.statSync(fullPath);
    const id = crypto.randomUUID();
    await conn.query(
      `INSERT INTO \`${aiDb}\`.immersion_assets
       (id, title_id, kind, role, original_name, stored_name, mime_type, file_size, status, uploaded_by)
       VALUES (?, ?, 'audio', 'primary', ?, ?, 'audio/wav', ?, 'ready', 'seed-tts')`,
      [id, titleId, `${soz}.wav`, storedName, stat.size]
    );
    created += 1;
    console.log(`✅ ${row.sort_order}. ${soz} → ${titleId}`);
  } catch (err) {
    failed += 1;
    try {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
      /* ignore */
    }
    console.warn(`⚠️  ${soz}: ${err.message}`);
  }
}

await conn.end();
console.log(`\nTayyor. jaratıldı=${created} ótkizildi=${skipped} qáte=${failed}`);
console.log(`Upload dir: ${uploadDir}`);
