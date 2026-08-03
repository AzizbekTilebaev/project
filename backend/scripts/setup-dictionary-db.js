import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username) || 'root',
      password: decodeURIComponent(u.password) || '',
      database: u.pathname.replace(/^\//, '') || 'tusindirme_sozlik',
    };
  } catch {
    return null;
  }
}

const fromUrl = process.env.DATABASE_TUSINDIRME
  ? parseUrl(process.env.DATABASE_TUSINDIRME)
  : null;

const config = fromUrl || {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'tusindirme_sozlik',
};

const schemaPath = path.join(__dirname, '..', 'db', 'schema.tusindirme.sql');

const admin = await mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  charset: 'utf8mb4',
  multipleStatements: true,
});

await admin.query(
  `CREATE DATABASE IF NOT EXISTS \`${config.database}\`
   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
console.log(`✅ Baza tayyor: ${config.database}`);
await admin.end();

const db = await mysql.createConnection({
  ...config,
  charset: 'utf8mb4',
  multipleStatements: true,
});

const sql = fs.readFileSync(schemaPath, 'utf-8');
await db.query(sql);
console.log('✅ Schema qo‘llandi:', schemaPath);

// search_key ustuni eski bazalarda yo'q bo'lishi mumkin
const [cols] = await db.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'titles' AND COLUMN_NAME = 'search_key'`,
  [config.database]
);
if (!cols.length) {
  await db.query(
    `ALTER TABLE titles
     ADD COLUMN search_key VARCHAR(191) NULL AFTER normalized,
     ADD INDEX idx_titles_search_key (search_key)`
  );
  console.log('✅ search_key ustuni qo‘shildi');
}

async function addIndexIfMissing(table, index, columns) {
  const [rows] = await db.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [config.database, table, index]
  );
  if (!rows.length) {
    await db.query(`ALTER TABLE \`${table}\` ADD INDEX \`${index}\` (${columns})`);
    console.log(`✅ Index qo‘shildi: ${table}.${index}`);
  }
}

await addIndexIfMissing('titles', 'idx_titles_status_order', '`status`, `order`');
await addIndexIfMissing(
  'titles',
  'idx_titles_status_letter_order',
  '`status`, `st_let`, `order`'
);
await addIndexIfMissing(
  'description',
  'idx_description_title_order',
  '`titles_id`, `sort_order`'
);
await addIndexIfMissing(
  'examples',
  'idx_examples_description_approved_order',
  '`descriptions_id`, `is_approved`, `sort_order`'
);
await addIndexIfMissing('titles', 'idx_titles_views', '`views_count`');

async function tableExists(name) {
  const [rows] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [config.database, name]
  );
  return rows.length > 0;
}

async function hasColumn(table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [config.database, table, column]
  );
  return rows.length > 0;
}

// Legacy (tayn_emesleri davri) bo'sh sinonim jadvallarini yangi tuzilishga ko'chirish
async function migrateLegacySynonymTables() {
  if (
    (await tableExists('synonym_group_descriptions')) &&
    !(await hasColumn('synonym_group_descriptions', 'description_id'))
  ) {
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM synonym_group_descriptions');
    if (n > 0) {
      console.warn('⚠️  synonym_group_descriptions eski tuzilishda va bo‘sh emas — qo‘lda migratsiya kerak');
      return;
    }
    await db.query('DROP TABLE synonym_group_descriptions');
    console.log('🗑️  Legacy synonym_group_descriptions tashlandi');
  }
  if ((await tableExists('synonym_groups')) && !(await hasColumn('synonym_groups', 'note'))) {
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM synonym_groups');
    if (n > 0) {
      console.warn('⚠️  synonym_groups eski tuzilishda va bo‘sh emas — qo‘lda migratsiya kerak');
      return;
    }
    await db.query('DROP TABLE synonym_groups');
    console.log('🗑️  Legacy synonym_groups tashlandi');
  }
  // Yangi tuzilishda qayta yaratish
  await db.query(`
    CREATE TABLE IF NOT EXISTS synonym_groups (
      id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      note varchar(255) DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS synonym_group_descriptions (
      id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      group_id bigint(20) unsigned NOT NULL,
      description_id varchar(36) NOT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY uq_group_desc (group_id, description_id),
      KEY idx_sgd_description (description_id),
      CONSTRAINT sgd_group_fk FOREIGN KEY (group_id) REFERENCES synonym_groups (id) ON DELETE CASCADE,
      CONSTRAINT sgd_desc_fk FOREIGN KEY (description_id) REFERENCES description (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

await migrateLegacySynonymTables();

// Curated (premium-50) so‘zlar ro‘yxati — ilgari fordata/curated fayldan o‘qilar edi,
// endi to‘liq MySQL’da saqlanadi (fordata o‘chirilgach ham ishlaydi).
await db.query(`
  CREATE TABLE IF NOT EXISTS curated_words (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    soz VARCHAR(191) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    score INT DEFAULT NULL,
    category VARCHAR(64) DEFAULT NULL,
    source VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY uq_curated_soz (soz)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ Jadval: curated_words');

// Sense-level / crowdsourcing jadvallar (schema CREATE IF NOT EXISTS bilan ham keladi)
const communityTables = [
  'synonym_groups',
  'synonym_group_descriptions',
  'description_antonyms',
  'compound_words',
  'community_suggestions',
  'community_suggestion_votes',
];
for (const t of communityTables) {
  const ok = await tableExists(t);
  console.log(ok ? `✅ Jadval: ${t}` : `⚠️  Jadval yo‘q: ${t}`);
}

const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM titles');
console.log(`ℹ️  titles: ${total} ta yozuv`);
console.log('✅ Dictionary setup complete (ma’lumot seed emas — backup/import bilan to‘ldiriladi)');
await db.end();
