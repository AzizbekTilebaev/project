/**
 * Push token yig‘ish (FCM/APNs) — yuborish keyinroq (ROADMAP C.6).
 */
import { pools, DB } from '../config/db.js';

const db = pools.users;
let schemaReady = false;

const PLATFORMS = new Set(['fcm', 'apns', 'web']);

function httpError(message, statusCode = 400, error = 'bad_request') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.error = error;
  return err;
}

export async function ensureDeviceTokensSchema() {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${DB.users}.device_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_id BIGINT UNSIGNED NULL,
      user_id BIGINT UNSIGNED NULL,
      platform ENUM('fcm', 'apns', 'web') NOT NULL,
      token VARCHAR(512) NOT NULL,
      app_version VARCHAR(32) NULL,
      device_label VARCHAR(128) NULL,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_device_token (token(191)),
      KEY idx_device_actor (actor_id),
      KEY idx_device_user (user_id),
      KEY idx_device_platform (platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

/**
 * @param {{ actorId?: number|null, userId?: number|null, token: string, platform: string, appVersion?: string|null, deviceLabel?: string|null }}
 */
export async function registerDeviceToken({
  actorId = null,
  userId = null,
  token,
  platform,
  appVersion = null,
  deviceLabel = null,
}) {
  await ensureDeviceTokensSchema();
  const t = String(token || '').trim();
  const p = String(platform || '').trim().toLowerCase();
  if (!t || t.length < 20 || t.length > 512) {
    throw httpError('Token noto‘g‘ri', 400, 'invalid_token');
  }
  if (!PLATFORMS.has(p)) {
    throw httpError('platform: fcm | apns | web', 400, 'invalid_platform');
  }
  if (!actorId && !userId) {
    throw httpError('Actor yoki user kerak', 400, 'missing_identity');
  }

  await db.query(
    `INSERT INTO ${DB.users}.device_tokens
       (actor_id, user_id, platform, token, app_version, device_label)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       actor_id = COALESCE(VALUES(actor_id), actor_id),
       user_id = COALESCE(VALUES(user_id), user_id),
       platform = VALUES(platform),
       app_version = VALUES(app_version),
       device_label = COALESCE(VALUES(device_label), device_label),
       last_seen_at = CURRENT_TIMESTAMP`,
    [
      actorId || null,
      userId || null,
      p,
      t,
      appVersion ? String(appVersion).slice(0, 32) : null,
      deviceLabel ? String(deviceLabel).slice(0, 128) : null,
    ]
  );

  return { registered: true, platform: p };
}

export async function unregisterDeviceToken(token) {
  await ensureDeviceTokensSchema();
  const t = String(token || '').trim();
  if (!t) throw httpError('Token kerak', 400, 'invalid_token');
  const [result] = await db.query(`DELETE FROM ${DB.users}.device_tokens WHERE token = ?`, [t]);
  return { removed: (result.affectedRows || 0) > 0 };
}

export async function deleteDeviceTokensForActor(actorId) {
  await ensureDeviceTokensSchema().catch(() => {});
  await db
    .query(`DELETE FROM ${DB.users}.device_tokens WHERE actor_id = ?`, [actorId])
    .catch(() => {});
}
