/**
 * Rol tizimi migratsiyasi (idempotent):
 *  - admin_accounts.role enumiga 'moderator' qo'shiladi
 *  - last_login_at, created_by ustunlari qo'shiladi
 * Ishga tushirish: node scripts/setup-roles.js
 */
import { pools, DB } from '../src/config/db.js';

const db = pools.users;

async function columnExists(table, column) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB.users, table, column]
  );
  return row.n > 0;
}

// 1) role enumini kengaytirish
const [[roleCol]] = await db.query(
  `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_accounts' AND COLUMN_NAME = 'role'`,
  [DB.users]
);
if (roleCol && !roleCol.t.includes('moderator')) {
  await db.query(
    `ALTER TABLE admin_accounts
     MODIFY COLUMN role ENUM('owner','editor','uploader','moderator') NOT NULL DEFAULT 'editor'`
  );
  console.log("✅ role enumiga 'moderator' qo'shildi");
} else {
  console.log('✓ role enumi allaqachon yangilangan');
}

// 2) last_login_at
if (!(await columnExists('admin_accounts', 'last_login_at'))) {
  await db.query(`ALTER TABLE admin_accounts ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL`);
  console.log('✅ last_login_at ustuni qo‘shildi');
} else {
  console.log('✓ last_login_at bor');
}

// 3) created_by (kim yaratgan — audit)
if (!(await columnExists('admin_accounts', 'created_by'))) {
  await db.query(`ALTER TABLE admin_accounts ADD COLUMN created_by CHAR(36) NULL DEFAULT NULL`);
  console.log('✅ created_by ustuni qo‘shildi');
} else {
  console.log('✓ created_by bor');
}

await Promise.all(Object.values(pools).map((p) => p.end().catch(() => {})));
console.log('\n✅ Rol migratsiyasi tamamlandı.');
