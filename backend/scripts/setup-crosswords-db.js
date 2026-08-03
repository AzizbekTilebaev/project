import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, '../../frontend/src/data/crosswords.json');

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT) || 3306;
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASS || '';
const database = process.env.KK_KRASVORD_DB || 'kk_krasvord';

const admin = await mysql.createConnection({
  host,
  port,
  user,
  password,
  charset: 'utf8mb4',
});
await admin.query(
  `CREATE DATABASE IF NOT EXISTS \`${database}\`
   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await admin.end();

const db = await mysql.createConnection({
  host,
  port,
  user,
  password,
  database,
  charset: 'utf8mb4',
});

await db.query(`
  CREATE TABLE IF NOT EXISTS crosswords (
    id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    difficulty VARCHAR(64) NULL,
    description TEXT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    words_json JSON NOT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

if (fs.existsSync(seedPath)) {
  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const list = raw.crosswords || raw;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const id = String(c.id);
    const words = c.config?.WordsData || [];
    await db.query(
      `INSERT INTO crosswords
       (id, title, difficulty, description, width, height, words_json, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         difficulty = VALUES(difficulty),
         description = VALUES(description),
         width = VALUES(width),
         height = VALUES(height),
         words_json = VALUES(words_json),
         sort_order = VALUES(sort_order)`,
      [
        id,
        c.title,
        c.difficulty || null,
        c.description || null,
        c.config?.CrosswordWidth || 15,
        c.config?.CrosswordHeight || 14,
        JSON.stringify(words),
        i,
      ]
    );
  }
  console.log(`✅ Crosswords seed: ${list.length}`);
} else {
  console.warn('⚠️  crosswords.json tabılmadı — seed ótkizildi');
}

// Stats / game tables — FK ixtıyarıy (anonymous_actors basqa DB da bolıwı múmkin)
for (const sql of [
  `CREATE TABLE IF NOT EXISTS crossword_stats (
    id CHAR(36) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    crossword_id VARCHAR(64) NOT NULL,
    mode VARCHAR(32) NOT NULL,
    room_id CHAR(36) NULL,
    score INT NULL,
    duration_seconds INT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cw_stats_actor (actor_id),
    KEY idx_cw_stats_puzzle (crossword_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS dict_game_rounds (
    id CHAR(36) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    questions_json JSON NOT NULL,
    answers_json JSON NULL,
    score INT NULL,
    total INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_dict_rounds_actor (actor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]) {
  try {
    await db.query(sql);
  } catch (err) {
    console.warn(`⚠️  Jadval: ${err.message}`);
  }
}

await db.end();
console.log('✅ crosswords seed tayyor');
