/**
 * Literature schema: writers, aliases, book links, jumbaqlar, reading tutor tables.
 * Idempotent — safe to re-run.
 */
import mysql from 'mysql2/promise';
import { QUIZ_DB_CONFIG } from '../src/config/quiz.db.js';

const admin = await mysql.createConnection({
  host: QUIZ_DB_CONFIG.host,
  port: QUIZ_DB_CONFIG.port,
  user: QUIZ_DB_CONFIG.user,
  password: QUIZ_DB_CONFIG.password,
  charset: 'utf8mb4',
});
await admin.query(
  `CREATE DATABASE IF NOT EXISTS \`${QUIZ_DB_CONFIG.database}\`
   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await admin.end();

const db = await mysql.createConnection({ ...QUIZ_DB_CONFIG, charset: 'utf8mb4' });

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [QUIZ_DB_CONFIG.database, table, column]
  );
  return Boolean(rows[0]);
}

async function ensureColumn(table, column, ddl) {
  if (await columnExists(table, column)) return;
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`  + ${table}.${column}`);
}

// FK order: prerequisite tables first (fresh quiz_db must not fail on
// book_writers/reading_sessions FKs). Same schema as setup-books-db.js.
await db.query(`
  CREATE TABLE IF NOT EXISTS books (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author VARCHAR(200) NOT NULL,
    years VARCHAR(100) NOT NULL DEFAULT '',
    genre VARCHAR(40) NOT NULL DEFAULT 'other',
    description TEXT,
    note VARCHAR(500) DEFAULT '',
    source_type ENUM('text','pdf','doc','docx') NOT NULL DEFAULT 'text',
    original_name VARCHAR(255) NULL,
    stored_name VARCHAR(255) NULL,
    file_size BIGINT NULL,
    mime_type VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_books_genre (genre),
    INDEX idx_books_source (source_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS book_sections (
    id VARCHAR(80) PRIMARY KEY,
    book_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    paragraphs_json LONGTEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_book_sections_book
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    INDEX idx_book_sections_book (book_id, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS literature_writers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_id INT UNSIGNED NULL,
    slug VARCHAR(120) NOT NULL,
    poet_name_original VARCHAR(255) NOT NULL,
    poet_name_latin VARCHAR(255) NOT NULL DEFAULT '',
    life_span VARCHAR(100) NOT NULL DEFAULT '',
    birth_year SMALLINT NULL,
    death_year SMALLINT NULL,
    birth_month TINYINT UNSIGNED NULL,
    birth_day TINYINT UNSIGNED NULL,
    birth_date DATE NULL,
    birth_precision ENUM('year','month','day','approx') NOT NULL DEFAULT 'year',
    death_date DATE NULL,
    birthplace_original VARCHAR(255) NULL,
    birthplace_latin VARCHAR(255) NULL,
    birth_lat DECIMAL(9,6) NULL,
    birth_lng DECIMAL(9,6) NULL,
    geocode_status ENUM('none','pending','resolved','failed','manual') NOT NULL DEFAULT 'none',
    facts_json JSON NULL,
    biography_original MEDIUMTEXT NULL,
    biography_plain_original MEDIUMTEXT NULL,
    biography_latin MEDIUMTEXT NULL,
    source VARCHAR(120) NOT NULL DEFAULT 'writers-qq-cyrillic.json',
    content_hash CHAR(64) NULL,
    status ENUM('published','draft') NOT NULL DEFAULT 'published',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_literature_writers_source (source_id),
    UNIQUE KEY uq_literature_writers_slug (slug),
    INDEX idx_literature_writers_name (poet_name_original),
    INDEX idx_literature_writers_status (status),
    INDEX idx_literature_writers_place (birthplace_original)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS writer_creative_works (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    writer_id INT UNSIGNED NOT NULL,
    slug VARCHAR(160) NOT NULL,
    title_original VARCHAR(255) NOT NULL,
    title_latin VARCHAR(255) NOT NULL DEFAULT '',
    work_type VARCHAR(40) NOT NULL DEFAULT 'qosıq',
    year_label VARCHAR(80) NOT NULL DEFAULT '',
    body_text MEDIUMTEXT NULL,
    body_text_cyrillic MEDIUMTEXT NULL,
    body_text_latin MEDIUMTEXT NULL,
    linked_book_id VARCHAR(64) NULL,
    linked_section_index INT NULL,
    availability ENUM('in_library','mentioned_only','not_imported') NOT NULL DEFAULT 'not_imported',
    sort_order INT NOT NULL DEFAULT 0,
    content_hash CHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_writer_creative_slug (writer_id, slug),
    INDEX idx_writer_creative_writer (writer_id),
    INDEX idx_writer_creative_avail (availability),
    CONSTRAINT fk_writer_creative_writer
      FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE CASCADE,
    CONSTRAINT fk_writer_creative_book
      FOREIGN KEY (linked_book_id) REFERENCES books(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS writer_aliases (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    writer_id INT UNSIGNED NOT NULL,
    alias_original VARCHAR(255) NOT NULL,
    alias_latin VARCHAR(255) NOT NULL DEFAULT '',
    alias_fold VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_writer_alias_fold (alias_fold),
    INDEX idx_writer_aliases_writer (writer_id),
    CONSTRAINT fk_writer_aliases_writer
      FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS book_writers (
    book_id VARCHAR(64) NOT NULL,
    writer_id INT UNSIGNED NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'author',
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (book_id, writer_id),
    INDEX idx_book_writers_writer (writer_id),
    CONSTRAINT fk_book_writers_book
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    CONSTRAINT fk_book_writers_writer
      FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS literature_pieces (
    id VARCHAR(80) NOT NULL PRIMARY KEY,
    book_id VARCHAR(64) NOT NULL,
    writer_id INT UNSIGNED NULL,
    title_original VARCHAR(255) NOT NULL,
    title_latin VARCHAR(255) NOT NULL DEFAULT '',
    paragraphs_json LONGTEXT NOT NULL,
    paragraphs_cyrillic_json LONGTEXT NULL,
    paragraphs_latin_json LONGTEXT NULL,
    work_year SMALLINT NULL,
    work_date_label_original VARCHAR(120) NULL,
    work_date_label_latin VARCHAR(120) NULL,
    work_place_original VARCHAR(255) NULL,
    work_place_latin VARCHAR(255) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    content_hash CHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_literature_pieces_book (book_id, sort_order),
    CONSTRAINT fk_literature_pieces_book
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    CONSTRAINT fk_literature_pieces_writer
      FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS jumbaqlar (
    id INT UNSIGNED NOT NULL PRIMARY KEY,
    jumbaq_original TEXT NOT NULL,
    jumbaq_cyrillic TEXT NULL,
    juwap_original VARCHAR(500) NOT NULL,
    juwap_cyrillic VARCHAR(500) NULL,
    topar INT NOT NULL DEFAULT 0,
    utopar INT NOT NULL DEFAULT 0,
    variant_group CHAR(64) NULL,
    content_hash CHAR(64) NULL,
    status ENUM('published','draft') NOT NULL DEFAULT 'published',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_jumbaq_topar (topar, utopar),
    INDEX idx_jumbaq_variant (variant_group),
    INDEX idx_jumbaq_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS jumbaq_progress (
    actor_id BIGINT UNSIGNED NOT NULL,
    jumbaq_id INT UNSIGNED NOT NULL,
    revealed TINYINT(1) NOT NULL DEFAULT 0,
    favorited TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id, jumbaq_id),
    CONSTRAINT fk_jumbaq_progress_jumbaq
      FOREIGN KEY (jumbaq_id) REFERENCES jumbaqlar(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS book_lessons (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    book_id VARCHAR(64) NOT NULL,
    section_index INT NOT NULL DEFAULT 0,
    engine VARCHAR(40) NOT NULL DEFAULT 'local-reading-v1',
    lesson_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_book_lessons_section (book_id, section_index),
    CONSTRAINT fk_book_lessons_book
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS reading_sessions (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    actor_id BIGINT UNSIGNED NOT NULL,
    book_id VARCHAR(64) NOT NULL,
    section_index INT NOT NULL DEFAULT 0,
    plan_json LONGTEXT NOT NULL,
    status ENUM('active','answered','completed') NOT NULL DEFAULT 'active',
    score INT NOT NULL DEFAULT 0,
    total INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_reading_sessions_actor (actor_id, created_at),
    CONSTRAINT fk_reading_sessions_book
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

// Note: app reading_sessions + reading_lesson_srs live in kk_statistika
// (see repair-orphaned-innodb.js). This quiz_db copy is for legacy FK tooling.

await db.query(`
  CREATE TABLE IF NOT EXISTS literature_tutor_events (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    actor_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lit_tutor_events_actor (actor_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

// Older deployments may miss later-added columns — align idempotently.
await ensureColumn(
  'literature_writers',
  'source',
  `source VARCHAR(120) NOT NULL DEFAULT 'writers-qq-cyrillic.json' AFTER biography_latin`
);
await ensureColumn('literature_writers', 'birth_month', `birth_month TINYINT UNSIGNED NULL AFTER death_year`);
await ensureColumn('literature_writers', 'birth_day', `birth_day TINYINT UNSIGNED NULL AFTER birth_month`);
await ensureColumn('literature_writers', 'birth_date', `birth_date DATE NULL AFTER birth_day`);
await ensureColumn(
  'literature_writers',
  'birth_precision',
  `birth_precision ENUM('year','month','day','approx') NOT NULL DEFAULT 'year' AFTER birth_date`
);
await ensureColumn('literature_writers', 'death_date', `death_date DATE NULL AFTER birth_precision`);
await ensureColumn(
  'literature_writers',
  'birthplace_original',
  `birthplace_original VARCHAR(255) NULL AFTER death_date`
);
await ensureColumn(
  'literature_writers',
  'birthplace_latin',
  `birthplace_latin VARCHAR(255) NULL AFTER birthplace_original`
);
await ensureColumn('literature_writers', 'birth_lat', `birth_lat DECIMAL(9,6) NULL AFTER birthplace_latin`);
await ensureColumn('literature_writers', 'birth_lng', `birth_lng DECIMAL(9,6) NULL AFTER birth_lat`);
await ensureColumn(
  'literature_writers',
  'geocode_status',
  `geocode_status ENUM('none','pending','resolved','failed','manual') NOT NULL DEFAULT 'none' AFTER birth_lng`
);
await ensureColumn('literature_writers', 'facts_json', `facts_json JSON NULL AFTER geocode_status`);
await ensureColumn(
  'writer_creative_works',
  'linked_section_index',
  `linked_section_index INT NULL AFTER linked_book_id`
);
await ensureColumn(
  'writer_creative_works',
  'body_text_cyrillic',
  `body_text_cyrillic MEDIUMTEXT NULL AFTER body_text`
);
await ensureColumn(
  'writer_creative_works',
  'body_text_latin',
  `body_text_latin MEDIUMTEXT NULL AFTER body_text_cyrillic`
);
await ensureColumn(
  'literature_pieces',
  'paragraphs_cyrillic_json',
  `paragraphs_cyrillic_json LONGTEXT NULL AFTER paragraphs_json`
);
await ensureColumn(
  'literature_pieces',
  'paragraphs_latin_json',
  `paragraphs_latin_json LONGTEXT NULL AFTER paragraphs_cyrillic_json`
);
await ensureColumn('literature_pieces', 'work_year', `work_year SMALLINT NULL AFTER paragraphs_latin_json`);
await ensureColumn(
  'literature_pieces',
  'work_date_label_original',
  `work_date_label_original VARCHAR(120) NULL AFTER work_year`
);
await ensureColumn(
  'literature_pieces',
  'work_date_label_latin',
  `work_date_label_latin VARCHAR(120) NULL AFTER work_date_label_original`
);
await ensureColumn(
  'literature_pieces',
  'work_place_original',
  `work_place_original VARCHAR(255) NULL AFTER work_date_label_latin`
);
await ensureColumn(
  'literature_pieces',
  'work_place_latin',
  `work_place_latin VARCHAR(255) NULL AFTER work_place_original`
);

// Extend existing books table without failing when columns already exist.
const booksExists = (
  await db.query(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'books' LIMIT 1`,
    [QUIZ_DB_CONFIG.database]
  )
)[0][0];

if (booksExists) {
  console.log('Altering books metadata columns (idempotent)...');
  await ensureColumn(
    'books',
    'original_script',
    `original_script ENUM('cyrillic','latin','mixed','unknown') NOT NULL DEFAULT 'unknown'`
  );
  await ensureColumn('books', 'source_path', `source_path VARCHAR(500) NULL`);
  await ensureColumn('books', 'content_hash', `content_hash CHAR(64) NULL`);
  await ensureColumn(
    'books',
    'import_status',
    `import_status ENUM('seed','imported','draft','skipped') NOT NULL DEFAULT 'seed'`
  );
  await ensureColumn('books', 'work_kind', `work_kind VARCHAR(40) NOT NULL DEFAULT 'book'`);
  await ensureColumn('books', 'title_original', `title_original VARCHAR(200) NULL AFTER title`);
  await ensureColumn('books', 'title_latin', `title_latin VARCHAR(200) NULL AFTER title_original`);
  await ensureColumn('books', 'author_original', `author_original VARCHAR(200) NULL AFTER author`);
  await ensureColumn('books', 'author_latin', `author_latin VARCHAR(200) NULL AFTER author_original`);
  await ensureColumn(
    'books',
    'description_original',
    `description_original TEXT NULL AFTER description`
  );
  await ensureColumn(
    'books',
    'description_latin',
    `description_latin TEXT NULL AFTER description_original`
  );

  // Backfill script pairs from existing single columns when empty.
  await db.query(
    `UPDATE books SET title_original = title
     WHERE title_original IS NULL OR title_original = ''`
  );
  await db.query(
    `UPDATE books SET author_original = author
     WHERE author_original IS NULL OR author_original = ''`
  );
  await db.query(
    `UPDATE books SET description_original = description
     WHERE description_original IS NULL AND description IS NOT NULL`
  );

  // Seed kitaplardagi Latin title → Cyrillic original juftligi
  const seedTitleFixes = [
    ['ibrayim-yusupov', 'Таңламалы қосықлар', 'Tańlamalı qosıqlar'],
    ['berdaq', 'Таңламалы шығармалары', 'Tańlamalı shıǵarmaları'],
    ['kunxoja', 'Қосықлар топламы', 'Qosıqlar toplamı'],
  ];
  for (const [id, titleOriginal, titleLatin] of seedTitleFixes) {
    await db.query(
      `UPDATE books SET title = ?, title_original = ?, title_latin = ?
       WHERE id = ? AND (title_latin IS NULL OR title_original = title OR title REGEXP '[A-Za-záǵıńóúÁǴÍŃÓÚ]')`,
      [titleOriginal, titleOriginal, titleLatin, id]
    );
  }
}

await ensureColumn(
  'literature_pieces',
  'status',
  `status ENUM('published','draft','skipped') NOT NULL DEFAULT 'published'`
);

await db.end();
console.log('\n✅ Literature DB setup tamamlandı.\n');
