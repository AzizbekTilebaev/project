import mysql from 'mysql2/promise';
import { QUIZ_DB_CONFIG } from '../src/config/quiz.db.js';
import { SEED_QUIZZES_KAA as SEED_QUIZZES } from './quiz-seed-kaa.js';

// Boshlang'ich seed — quiz-seed-kaa.js (to‘liq qaraqalpaq).

async function columnExists(db, table, column) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [QUIZ_DB_CONFIG.database, table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(db, table, column, ddl) {
  if (!(await columnExists(db, table, column))) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`✅ Ustun qo‘shildi: ${table}.${column}`);
  }
}

// 1. Bazani yaratamiz
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
console.log(`✅ Baza tayyor: ${QUIZ_DB_CONFIG.database}`);
await admin.end();

const db = await mysql.createConnection({ ...QUIZ_DB_CONFIG, charset: 'utf8mb4' });

if (process.argv.includes('--fresh')) {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of [
    'game_room_members',
    'game_rooms',
    'quiz_attempt_questions',
    'quiz_attempts',
    'quiz_instances',
    'learning_events',
    'anonymous_actors',
    'quiz_questions',
    'quizzes',
  ]) {
    await db.query(`DROP TABLE IF EXISTS \`${t}\``);
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('🗑️  Eski jadvallar tashlandi (--fresh).');
}

await db.query(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    level VARCHAR(32),
    category VARCHAR(64),
    time_mode ENUM('timed','untimed') NOT NULL DEFAULT 'untimed',
    time_limit_seconds INT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS quiz_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quiz_id VARCHAR(32) NOT NULL,
    question TEXT NOT NULL,
    options JSON NOT NULL,
    correct_answer VARCHAR(500) NOT NULL,
    time_limit_seconds INT NULL,
    sort_order INT DEFAULT 0,
    CONSTRAINT fk_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await addColumnIfMissing(
  db,
  'quizzes',
  'time_mode',
  `time_mode ENUM('timed','untimed') NOT NULL DEFAULT 'untimed' AFTER category`
);
await addColumnIfMissing(
  db,
  'quizzes',
  'time_limit_seconds',
  'time_limit_seconds INT NULL AFTER time_mode'
);
await addColumnIfMissing(
  db,
  'quizzes',
  'is_published',
  `is_published TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order`
);
await addColumnIfMissing(
  db,
  'quiz_questions',
  'time_limit_seconds',
  'time_limit_seconds INT NULL AFTER correct_answer'
);

await db.query(`
  CREATE TABLE IF NOT EXISTS anonymous_actors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_key CHAR(64) NOT NULL,
    age_years TINYINT UNSIGNED NULL,
    age_consent TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_actor_key (actor_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS learning_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    quiz_id VARCHAR(32) NULL,
    attempt_id CHAR(36) NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_events_actor_created (actor_id, created_at),
    KEY idx_events_type_created (event_type, created_at),
    KEY idx_events_quiz (quiz_id),
    CONSTRAINT fk_events_actor FOREIGN KEY (actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS quiz_instances (
    id CHAR(36) NOT NULL,
    quiz_id VARCHAR(32) NOT NULL,
    question_order JSON NOT NULL,
    option_orders JSON NOT NULL,
    seed VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_instance_quiz (quiz_id),
    CONSTRAINT fk_instance_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id CHAR(36) NOT NULL,
    instance_id CHAR(36) NOT NULL,
    quiz_id VARCHAR(32) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    status ENUM('in_progress','completed','partial','expired','voided') NOT NULL DEFAULT 'in_progress',
    current_index INT NOT NULL DEFAULT 0,
    age_years TINYINT UNSIGNED NULL,
    age_consent TINYINT(1) NOT NULL DEFAULT 0,
    score INT NULL,
    total INT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    total_deadline_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    KEY idx_attempt_actor_status (actor_id, status),
    KEY idx_attempt_quiz_age (quiz_id, age_years, status),
    KEY idx_attempt_instance (instance_id),
    CONSTRAINT fk_attempt_instance FOREIGN KEY (instance_id) REFERENCES quiz_instances(id) ON DELETE CASCADE,
    CONSTRAINT fk_attempt_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    CONSTRAINT fk_attempt_actor FOREIGN KEY (actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    attempt_id CHAR(36) NOT NULL,
    question_id INT NOT NULL,
    position INT NOT NULL,
    viewed TINYINT(1) NOT NULL DEFAULT 0,
    selected_option_index INT NULL,
    selected_original_index INT NULL,
    is_correct TINYINT(1) NULL,
    time_spent_ms INT NULL,
    question_started_at TIMESTAMP NULL,
    question_deadline_at TIMESTAMP NULL,
    answered_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_attempt_question (attempt_id, question_id),
    KEY idx_aq_question (question_id),
    KEY idx_aq_attempt_pos (attempt_id, position),
    CONSTRAINT fk_aq_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    CONSTRAINT fk_aq_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS game_rooms (
    id CHAR(36) NOT NULL,
    code CHAR(6) NOT NULL,
    game_type ENUM('quiz','crossword') NOT NULL,
    mode VARCHAR(32) NOT NULL,
    content_id VARCHAR(64) NOT NULL,
    host_actor_id BIGINT UNSIGNED NOT NULL,
    status ENUM('lobby','starting','in_progress','finished','cancelled') NOT NULL DEFAULT 'lobby',
    max_players TINYINT NOT NULL DEFAULT 4,
    min_players TINYINT NOT NULL DEFAULT 2,
    shared_state_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_game_room_code (code),
    KEY idx_game_rooms_status (status),
    KEY idx_game_rooms_host (host_actor_id),
    CONSTRAINT fk_game_rooms_host FOREIGN KEY (host_actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS game_room_members (
    id CHAR(36) NOT NULL,
    room_id CHAR(36) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    display_name VARCHAR(32) NOT NULL,
    role ENUM('host','player') NOT NULL DEFAULT 'player',
    ready TINYINT(1) NOT NULL DEFAULT 0,
    connected TINYINT(1) NOT NULL DEFAULT 1,
    attempt_id CHAR(36) NULL,
    score INT NULL,
    progress_json JSON NULL,
    finished_at TIMESTAMP NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_room_actor (room_id, actor_id),
    KEY idx_members_actor (actor_id),
    CONSTRAINT fk_members_room FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_members_actor FOREIGN KEY (actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await addColumnIfMissing(
  db,
  'quiz_attempts',
  'room_id',
  'room_id CHAR(36) NULL AFTER actor_id'
);
await addColumnIfMissing(
  db,
  'quiz_attempts',
  'play_mode',
  `play_mode VARCHAR(32) NULL AFTER room_id`
);

for (const [col, ddl] of [
  ['irt_difficulty', 'irt_difficulty DOUBLE NULL'],
  ['irt_discrimination', 'irt_discrimination DOUBLE NULL DEFAULT 1'],
  ['irt_guessing', 'irt_guessing DOUBLE NULL DEFAULT 0.2'],
  ['times_seen', 'times_seen INT NOT NULL DEFAULT 0'],
  ['times_correct', 'times_correct INT NOT NULL DEFAULT 0'],
  ['p_value', 'p_value DOUBLE NULL'],
  ['calibrated_at', 'calibrated_at TIMESTAMP NULL'],
]) {
  await addColumnIfMissing(db, 'quiz_questions', col, ddl);
}

for (const [col, ddl] of [
  ['is_adaptive', 'is_adaptive TINYINT(1) NOT NULL DEFAULT 0'],
  ['skill', 'skill VARCHAR(64) NULL'],
  ['theta_start', 'theta_start DOUBLE NULL'],
  ['theta_end', 'theta_end DOUBLE NULL'],
]) {
  await addColumnIfMissing(db, 'quiz_attempts', col, ddl);
}

try {
  await db.query(
    `ALTER TABLE quiz_attempts
     MODIFY COLUMN status
     ENUM('in_progress','completed','partial','expired','voided')
     NOT NULL DEFAULT 'in_progress'`
  );
  console.log('✅ quiz_attempts.status includes voided');
} catch (err) {
  console.warn('quiz_attempts.status voided migrate:', err.message);
}

await db.query(`
  CREATE TABLE IF NOT EXISTS actor_ability (
    actor_id BIGINT UNSIGNED NOT NULL,
    skill VARCHAR(64) NOT NULL DEFAULT 'global',
    theta DOUBLE NOT NULL DEFAULT 0,
    theta_se DOUBLE NOT NULL DEFAULT 1,
    attempts INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id, skill),
    CONSTRAINT fk_ability_actor FOREIGN KEY (actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS mistake_bank (
    id CHAR(36) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    question_id INT NULL,
    dict_title_id VARCHAR(64) NULL,
    source ENUM('quiz','dict_game','adaptive','reading','crossword','immersion','jumbaq') NOT NULL,
    prompt TEXT NULL,
    wrong_count INT NOT NULL DEFAULT 1,
    correct_streak INT NOT NULL DEFAULT 0,
    box TINYINT NOT NULL DEFAULT 0,
    due_at DATETIME NOT NULL,
    last_seen_at TIMESTAMP NULL,
    resolved TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unique_key VARCHAR(128) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mistake_key (unique_key),
    KEY idx_mistake_actor (actor_id),
    KEY idx_mistake_due (actor_id, due_at),
    CONSTRAINT fk_mistake_actor FOREIGN KEY (actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

// Existing DBs: expand mistake_bank.source (reading/crossword/immersion)
try {
  await db.query(
    `ALTER TABLE mistake_bank
     MODIFY COLUMN source ENUM('quiz','dict_game','adaptive','reading','crossword','immersion','jumbaq') NOT NULL`
  );
  console.log('✅ mistake_bank.source ENUM: reading, crossword, immersion, jumbaq');
} catch (e) {
  console.warn('⚠️  mistake_bank.source ENUM:', e.message);
}

await db.query(`
  CREATE TABLE IF NOT EXISTS tutor_sessions (
    id CHAR(36) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    session_date DATE NOT NULL,
    plan_json JSON NOT NULL,
    status ENUM('active','completed') NOT NULL DEFAULT 'active',
    score INT NULL,
    total INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tutor_actor_date (actor_id, session_date),
    CONSTRAINT fk_tutor_actor FOREIGN KEY (actor_id) REFERENCES anonymous_actors(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS admin_accounts (
    id CHAR(36) NOT NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('owner','editor','uploader') NOT NULL DEFAULT 'editor',
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS api_clients (
    id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    key_prefix CHAR(8) NOT NULL,
    key_hash CHAR(64) NOT NULL,
    tier VARCHAR(32) NOT NULL DEFAULT 'partner',
    rpm INT NOT NULL DEFAULT 600,
    rpd INT NOT NULL DEFAULT 50000,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_api_prefix (key_prefix),
    KEY idx_api_hash (key_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  CREATE TABLE IF NOT EXISTS content_manifest (
    id TINYINT NOT NULL DEFAULT 1,
    schema_version VARCHAR(32) NOT NULL,
    content_version VARCHAR(32) NOT NULL,
    notes TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(
  `INSERT INTO content_manifest (id, schema_version, content_version, notes)
   VALUES (1, '2.0.0', '2026.07.19', 'Adaptive + immersion MVP')
   ON DUPLICATE KEY UPDATE schema_version = VALUES(schema_version)`
);

await db.query(`
  CREATE TABLE IF NOT EXISTS immersion_assets (
    id CHAR(36) NOT NULL,
    title_id VARCHAR(64) NULL,
    kind ENUM('model3d','video','audio') NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'primary',
    original_name VARCHAR(255) NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NULL,
    file_size INT NULL,
    duration_ms INT NULL,
    status ENUM('processing','ready','rejected') NOT NULL DEFAULT 'ready',
    uploaded_by VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_immersion_title (title_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.query(`
  UPDATE quiz_questions qq
  JOIN quizzes q ON q.id = qq.quiz_id
  SET qq.irt_difficulty = CASE
    WHEN q.level IN ('beginner','baslawish') THEN -1
    WHEN q.level IN ('advanced','joqari') THEN 1
    ELSE 0
  END
  WHERE qq.irt_difficulty IS NULL
`);

console.log(
  '✅ Jadvallar tayyor: quizzes… game_rooms, actor_ability, mistake_bank, tutor_sessions, admin_accounts, api_clients'
);

const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM quizzes');
if (total > 0) {
  console.log(`ℹ️  Bazada allaqachon ${total} ta test bor — seed o'tkazib yuborildi.`);
} else {
  for (let qi = 0; qi < SEED_QUIZZES.length; qi++) {
    const q = SEED_QUIZZES[qi];
    await db.query(
      `INSERT INTO quizzes (id, title, description, level, category, time_mode, time_limit_seconds, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        q.id,
        q.title,
        q.description || null,
        q.level || null,
        q.category || null,
        q.timeMode || 'untimed',
        q.timeLimitSeconds ?? null,
        qi,
      ]
    );
    for (let ii = 0; ii < q.questions.length; ii++) {
      const item = q.questions[ii];
      await db.query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, time_limit_seconds, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          item.question,
          JSON.stringify(item.options),
          item.correctAnswer,
          item.timeLimitSeconds ?? null,
          ii,
        ]
      );
    }
    console.log(`  + ${q.title} (${q.questions.length} soraw)`);
  }
  console.log(`✅ ${SEED_QUIZZES.length} ta test bazaga jaylandı.`);
}

await db.end();
