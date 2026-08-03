/**
 * Mehmon kvotalari + ekosistem schema (idempotent).
 * Ishga tushirish: node scripts/setup-ecosystem.js
 */
import crypto from 'crypto';
import { pools, DB } from '../src/config/db.js';

const users = pools.users;
const stat = pools.statistika;

async function columnExists(pool, schema, table, column) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schema, table, column]
  );
  return row.n > 0;
}

async function addColumn(pool, schema, table, column, ddl) {
  if (await columnExists(pool, schema, table, column)) {
    console.log(`✓ ${table}.${column}`);
    return;
  }
  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`✅ ${table}.${column}`);
}

await users.query(`
  CREATE TABLE IF NOT EXISTS app_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(190) NULL,
    password_hash VARCHAR(255) NULL,
    google_sub VARCHAR(64) NULL,
    display_name VARCHAR(80) NULL,
    avatar_url VARCHAR(500) NULL,
    bio TEXT NULL,
    interests JSON NULL,
    location VARCHAR(120) NULL,
    schools JSON NULL,
    birthday DATE NULL,
    phone VARCHAR(40) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_users_email (email),
    UNIQUE KEY uq_app_users_google (google_sub)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ app_users');

await users.query(`
  CREATE TABLE IF NOT EXISTS app_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_session_token (token_hash),
    KEY idx_session_user (user_id),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ app_sessions');

await addColumn(
  users,
  DB.users,
  'anonymous_actors',
  'user_id',
  'user_id BIGINT UNSIGNED NULL AFTER actor_key'
);
await addColumn(
  users,
  DB.users,
  'anonymous_actors',
  'quiz_completes',
  'quiz_completes INT UNSIGNED NOT NULL DEFAULT 0 AFTER leaderboard_opt_in'
);
await addColumn(
  users,
  DB.users,
  'anonymous_actors',
  'word_views',
  'word_views INT UNSIGNED NOT NULL DEFAULT 0 AFTER quiz_completes'
);

await stat.query(`
  CREATE TABLE IF NOT EXISTS actor_time_spent (
    actor_id BIGINT UNSIGNED NOT NULL,
    surface VARCHAR(32) NOT NULL,
    day DATE NOT NULL,
    duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (actor_id, surface, day),
    KEY idx_time_day (day)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ actor_time_spent');

await stat.query(`
  CREATE TABLE IF NOT EXISTS exit_feedback (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL,
    helpful TINYINT(1) NOT NULL,
    note VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_exit_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ exit_feedback');

// seed check
const tokenSample = crypto.randomBytes(8).toString('hex');
console.log(`\n✅ Ekosistema migratsiyasi tamamlandı (sample ${tokenSample.slice(0, 4)}…).`);

await Promise.all(Object.values(pools).map((p) => p.end().catch(() => {})));
