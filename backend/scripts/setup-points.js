/**
 * Ball (points) tizimi migratsiyasi — idempotent.
 *  - kk_statistika.actor_wallets        — hamyon: balans, jami, daraja
 *  - kk_statistika.point_transactions   — kirim/chiqim tarixi (o‘zgarmas)
 *  - kk_statistika.answer_review_unlocks — qaysi test javoblari ochilgani
 *  - kk_users.anonymous_actors          — nickname + reyting roziligi
 * Ishga tushirish: node scripts/setup-points.js
 */
import { pools, DB } from '../src/config/db.js';

const stat = pools.statistika;
const users = pools.users;

async function columnExists(pool, schema, table, column) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schema, table, column]
  );
  return row.n > 0;
}

await stat.query(`
  CREATE TABLE IF NOT EXISTS actor_wallets (
    actor_id BIGINT UNSIGNED NOT NULL,
    balance INT NOT NULL DEFAULT 0,
    total_earned INT NOT NULL DEFAULT 0,
    total_spent INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (actor_id),
    KEY idx_wallet_total_earned (total_earned)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ actor_wallets');

await stat.query(`
  CREATE TABLE IF NOT EXISTS point_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NOT NULL,
    amount INT NOT NULL,
    kind VARCHAR(40) NOT NULL,
    ref_id VARCHAR(64) NULL,
    meta_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_point_tx_kind_ref (kind, ref_id),
    KEY idx_point_tx_actor (actor_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ point_transactions');

await stat.query(`
  CREATE TABLE IF NOT EXISTS answer_review_unlocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NOT NULL,
    attempt_id CHAR(36) NOT NULL,
    cost INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_review_unlock_attempt (attempt_id),
    KEY idx_review_unlock_actor (actor_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
console.log('✅ answer_review_unlocks');

if (!(await columnExists(users, DB.users, 'anonymous_actors', 'nickname'))) {
  await users.query(`ALTER TABLE anonymous_actors ADD COLUMN nickname VARCHAR(40) NULL`);
  console.log('✅ anonymous_actors.nickname');
} else {
  console.log('✓ nickname bor');
}

if (!(await columnExists(users, DB.users, 'anonymous_actors', 'leaderboard_opt_in'))) {
  await users.query(
    `ALTER TABLE anonymous_actors ADD COLUMN leaderboard_opt_in TINYINT(1) NOT NULL DEFAULT 0`
  );
  console.log('✅ anonymous_actors.leaderboard_opt_in');
} else {
  console.log('✓ leaderboard_opt_in bor');
}

await Promise.all(Object.values(pools).map((p) => p.end().catch(() => {})));
console.log('\n✅ Ball tizimi migratsiyasi tamamlandı.');
