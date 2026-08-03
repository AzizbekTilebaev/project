/**
 * 10 ta kk_* domen bazasini yaratadi va mavjud ma’lumotni ko‘chiradi.
 *
 * Manba (backup sifatida saqlanadi):
 *   - quiz_db            → adabiyot, kitob, jumbaq, quiz, krossvord, actor, stat, ai
 *   - tusindirme_sozlik  → lug‘at
 *
 * Usul: `CREATE TABLE kk_x.t LIKE src.t` (FK’larsiz aniq klon) →
 *       `INSERT INTO kk_x.t SELECT * FROM src.t` → baza-ichi FK’larni qayta qo‘shish.
 * Bazalararo FK’lar ataylab tashlanadi (MySQL cross-DB FK’ni qo‘llamaydi;
 * yaxlitlik app darajasida ta’minlanadi).
 *
 * Idempotent: jadval bo‘sh bo‘lsagina ko‘chiradi; FK mavjud bo‘lsa o‘tkazadi.
 *
 *   node scripts/setup-kk-databases.js
 *   node scripts/setup-kk-databases.js --fresh   (yangi kk_* jadvallarni tashlab qayta quradi)
 */
import mysql from 'mysql2/promise';
import { DB, SERVER_CONFIG } from '../src/config/db.js';

const SRC_QUIZ = process.env.LEGACY_QUIZ_DB || 'quiz_db';
const SRC_DICT = process.env.LEGACY_TUSINDIRME_DB || 'tusindirme_sozlik';
const FRESH = process.argv.includes('--fresh');

// target DB, jadval, manba DB — FK bog‘liqlik tartibida (ota-jadval avval)
const TABLES = [
  // kk_users
  [DB.users, 'anonymous_actors', SRC_QUIZ],
  [DB.users, 'admin_accounts', SRC_QUIZ],
  [DB.users, 'api_clients', SRC_QUIZ],
  // kk_poets
  [DB.poets, 'literature_writers', SRC_QUIZ],
  [DB.poets, 'writer_aliases', SRC_QUIZ],
  [DB.poets, 'book_writers', SRC_QUIZ],
  // kk_poetrys
  [DB.poetrys, 'books', SRC_QUIZ],
  [DB.poetrys, 'book_sections', SRC_QUIZ],
  [DB.poetrys, 'literature_pieces', SRC_QUIZ],
  [DB.poetrys, 'writer_creative_works', SRC_QUIZ],
  [DB.poetrys, 'book_lessons', SRC_QUIZ],
  // kk_jumbaqlar
  [DB.jumbaqlar, 'jumbaqlar', SRC_QUIZ],
  [DB.jumbaqlar, 'jumbaq_progress', SRC_QUIZ],
  // kk_tusindirme
  [DB.tusindirme, 'categorys', SRC_DICT],
  [DB.tusindirme, 'titles', SRC_DICT],
  [DB.tusindirme, 'description', SRC_DICT],
  [DB.tusindirme, 'examples', SRC_DICT],
  [DB.tusindirme, 'idioms', SRC_DICT],
  [DB.tusindirme, 'idiom_desc', SRC_DICT],
  [DB.tusindirme, 'etimologiya', SRC_DICT],
  [DB.tusindirme, 'word_relations', SRC_DICT],
  [DB.tusindirme, 'synonym_groups', SRC_DICT],
  [DB.tusindirme, 'synonym_group_descriptions', SRC_DICT],
  [DB.tusindirme, 'description_antonyms', SRC_DICT],
  [DB.tusindirme, 'compound_words', SRC_DICT],
  [DB.tusindirme, 'community_suggestions', SRC_DICT],
  [DB.tusindirme, 'community_suggestion_votes', SRC_DICT],
  [DB.tusindirme, 'curated_words', SRC_DICT],
  // kk_quiz
  [DB.quiz, 'quizzes', SRC_QUIZ],
  [DB.quiz, 'quiz_questions', SRC_QUIZ],
  [DB.quiz, 'quiz_instances', SRC_QUIZ],
  [DB.quiz, 'quiz_attempts', SRC_QUIZ],
  [DB.quiz, 'quiz_attempt_questions', SRC_QUIZ],
  [DB.quiz, 'game_rooms', SRC_QUIZ],
  [DB.quiz, 'game_room_members', SRC_QUIZ],
  // kk_krasvord
  [DB.krasvord, 'crosswords', SRC_QUIZ],
  [DB.krasvord, 'crossword_stats', SRC_QUIZ],
  [DB.krasvord, 'dict_game_rounds', SRC_QUIZ],
  // kk_statistika
  [DB.statistika, 'learning_events', SRC_QUIZ],
  [DB.statistika, 'actor_ability', SRC_QUIZ],
  [DB.statistika, 'book_progress', SRC_QUIZ],
  [DB.statistika, 'reading_sessions', SRC_QUIZ],
  [DB.statistika, 'content_manifest', SRC_QUIZ],
  // kk_ai_db
  [DB.ai, 'tutor_sessions', SRC_QUIZ],
  [DB.ai, 'mistake_bank', SRC_QUIZ],
  [DB.ai, 'literature_tutor_events', SRC_QUIZ],
  [DB.ai, 'immersion_assets', SRC_QUIZ],
];

// Baza-ichi FK’lar: [db, jadval, constraint_nomi, ta’rif]
const FKS = [
  [DB.poets, 'writer_aliases', 'fk_writer_aliases_writer',
    'FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE CASCADE'],
  [DB.poets, 'book_writers', 'fk_book_writers_writer',
    'FOREIGN KEY (writer_id) REFERENCES literature_writers(id) ON DELETE CASCADE'],

  [DB.poetrys, 'book_sections', 'fk_book_sections_book',
    'FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE'],
  [DB.poetrys, 'literature_pieces', 'fk_literature_pieces_book',
    'FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE'],
  [DB.poetrys, 'book_lessons', 'fk_book_lessons_book',
    'FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE'],
  [DB.poetrys, 'writer_creative_works', 'fk_writer_creative_book',
    'FOREIGN KEY (linked_book_id) REFERENCES books(id) ON DELETE SET NULL'],

  [DB.jumbaqlar, 'jumbaq_progress', 'fk_jumbaq_progress_jumbaq',
    'FOREIGN KEY (jumbaq_id) REFERENCES jumbaqlar(id) ON DELETE CASCADE'],

  [DB.tusindirme, 'description', 'description_ibfk_1',
    'FOREIGN KEY (titles_id) REFERENCES titles(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'description', 'description_ibfk_2',
    'FOREIGN KEY (categorys_id) REFERENCES categorys(id) ON DELETE SET NULL'],
  [DB.tusindirme, 'examples', 'examples_ibfk_1',
    'FOREIGN KEY (descriptions_id) REFERENCES description(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'idioms', 'idioms_ibfk_1',
    'FOREIGN KEY (descriptions_id) REFERENCES description(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'idiom_desc', 'idiom_desc_ibfk_1',
    'FOREIGN KEY (idioms_id) REFERENCES idioms(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'etimologiya', 'etimologiya_ibfk_1',
    'FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'synonym_group_descriptions', 'sgd_group_fk',
    'FOREIGN KEY (group_id) REFERENCES synonym_groups(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'synonym_group_descriptions', 'sgd_desc_fk',
    'FOREIGN KEY (description_id) REFERENCES description(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'description_antonyms', 'ant_a_fk',
    'FOREIGN KEY (description_id_a) REFERENCES description(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'description_antonyms', 'ant_b_fk',
    'FOREIGN KEY (description_id_b) REFERENCES description(id) ON DELETE CASCADE'],
  [DB.tusindirme, 'community_suggestion_votes', 'sug_vote_fk',
    'FOREIGN KEY (suggestion_id) REFERENCES community_suggestions(id) ON DELETE CASCADE'],

  [DB.quiz, 'quiz_questions', 'fk_quiz',
    'FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE'],
  [DB.quiz, 'quiz_instances', 'fk_instance_quiz',
    'FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE'],
  [DB.quiz, 'quiz_attempts', 'fk_attempt_instance',
    'FOREIGN KEY (instance_id) REFERENCES quiz_instances(id) ON DELETE CASCADE'],
  [DB.quiz, 'quiz_attempts', 'fk_attempt_quiz',
    'FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE'],
  [DB.quiz, 'quiz_attempt_questions', 'fk_aq_attempt',
    'FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE'],
  [DB.quiz, 'quiz_attempt_questions', 'fk_aq_question',
    'FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE'],
  [DB.quiz, 'game_room_members', 'fk_members_room',
    'FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE'],
];

const conn = await mysql.createConnection({
  ...SERVER_CONFIG,
  charset: 'utf8mb4',
  multipleStatements: true,
});

async function tableExists(dbName, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [dbName, table]
  );
  return rows.length > 0;
}

async function rowCount(dbName, table) {
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${dbName}\`.\`${table}\``);
  return Number(r.n) || 0;
}

async function fkExists(dbName, table, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`,
    [dbName, table, name]
  );
  return rows.length > 0;
}

// 1) Bazalarni yaratamiz
for (const name of Object.values(DB)) {
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
}
console.log(`✅ 10 baza tayyor: ${Object.values(DB).join(', ')}`);

// 2) --fresh: yangi kk_* jadvallarni tashlaymiz (manbaga tegmaydi)
if (FRESH) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const [dbName, table] of [...TABLES].reverse()) {
    await conn.query(`DROP TABLE IF EXISTS \`${dbName}\`.\`${table}\``);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('🗑️  Eski kk_* jadvallar tashlandi (--fresh).');
}

// 3) Klonlash + ma’lumot ko‘chirish
await conn.query('SET FOREIGN_KEY_CHECKS = 0');
let copiedTables = 0;
let copiedRows = 0;
for (const [dbName, table, src] of TABLES) {
  if (!(await tableExists(src, table))) {
    console.warn(`⚠️  Manbada yo‘q, o‘tkazildi: ${src}.${table}`);
    continue;
  }
  await conn.query(
    `CREATE TABLE IF NOT EXISTS \`${dbName}\`.\`${table}\` LIKE \`${src}\`.\`${table}\``
  );
  const existing = await rowCount(dbName, table);
  if (existing > 0) {
    console.log(`↷ ${dbName}.${table} — allaqachon ${existing} qator (o‘tkazildi)`);
    continue;
  }
  await conn.query(
    `INSERT INTO \`${dbName}\`.\`${table}\` SELECT * FROM \`${src}\`.\`${table}\``
  );
  const n = await rowCount(dbName, table);
  copiedTables += 1;
  copiedRows += n;
  console.log(`✅ ${dbName}.${table} ← ${src}.${table} (${n} qator)`);
}
await conn.query('SET FOREIGN_KEY_CHECKS = 1');
console.log(`✅ Ko‘chirildi: ${copiedTables} jadval, ${copiedRows} qator`);

// 4) Baza-ichi FK’larni qayta qo‘shish
let addedFks = 0;
for (const [dbName, table, name, def] of FKS) {
  if (!(await tableExists(dbName, table))) continue;
  if (await fkExists(dbName, table, name)) continue;
  try {
    await conn.query(`ALTER TABLE \`${dbName}\`.\`${table}\` ADD CONSTRAINT \`${name}\` ${def}`);
    addedFks += 1;
  } catch (e) {
    console.warn(`⚠️  FK qo‘shilmadi ${dbName}.${table}.${name}: ${e.code || e.message}`);
  }
}
console.log(`✅ Baza-ichi FK qo‘shildi: ${addedFks}`);

// 5) kk_logs.app_errors — yangi jadval (xatolar/loglar)
await conn.query(`
  CREATE TABLE IF NOT EXISTS \`${DB.logs}\`.\`app_errors\` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    level ENUM('error','warn','info') NOT NULL DEFAULT 'error',
    source VARCHAR(120) NULL,
    method VARCHAR(10) NULL,
    path VARCHAR(500) NULL,
    status_code INT NULL,
    message TEXT NULL,
    stack MEDIUMTEXT NULL,
    context_json JSON NULL,
    actor_key CHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_app_errors_level_created (level, created_at),
    KEY idx_app_errors_source (source),
    KEY idx_app_errors_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log(`✅ Jadval: ${DB.logs}.app_errors`);

await conn.end();
console.log('\n✅ kk_* setup + migratsiya tamamlandı.\n');
