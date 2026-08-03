import dotenv from 'dotenv';
dotenv.config();
import mysql from 'mysql2/promise';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_USERS || 'kk_users',
});

await c.query('SET FOREIGN_KEY_CHECKS=0');

// Ghost InnoDB entry: try MyISAM first, then convert.
try {
  await c.query(`
    CREATE TABLE anonymous_actors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_key CHAR(64) NOT NULL,
      age_years TINYINT UNSIGNED NULL,
      age_consent TINYINT(1) NOT NULL DEFAULT 0,
      user_id BIGINT UNSIGNED NULL,
      quiz_completes INT UNSIGNED NOT NULL DEFAULT 0,
      word_views INT UNSIGNED NOT NULL DEFAULT 0,
      nickname VARCHAR(40) NULL,
      leaderboard_opt_in TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_actor_key (actor_key)
    ) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Created as MyISAM');
} catch (e) {
  console.log('MyISAM create failed:', e.message);
  // Fallback new name + view won't work for INSERT well.
  await c.query(`
    CREATE TABLE guest_actors (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_key CHAR(64) NOT NULL,
      age_years TINYINT UNSIGNED NULL,
      age_consent TINYINT(1) NOT NULL DEFAULT 0,
      user_id BIGINT UNSIGNED NULL,
      quiz_completes INT UNSIGNED NOT NULL DEFAULT 0,
      word_views INT UNSIGNED NOT NULL DEFAULT 0,
      nickname VARCHAR(40) NULL,
      leaderboard_opt_in TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_actor_key (actor_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Created guest_actors as fallback');
  await c.end();
  process.exit(2);
}

try {
  await c.query('ALTER TABLE anonymous_actors ENGINE=InnoDB');
  console.log('Converted to InnoDB');
} catch (e) {
  console.log('Keep MyISAM (InnoDB convert failed):', e.message);
}

await c.query('SET FOREIGN_KEY_CHECKS=1');
const [r] = await c.query(`SHOW TABLE STATUS LIKE 'anonymous_actors'`);
console.log('OK', r[0]?.Engine, r[0]?.Comment || '');
await c.end();
