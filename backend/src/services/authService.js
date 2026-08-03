import crypto from 'crypto';
import { pools } from '../config/db.js';
import { claimAnonymousHistory } from './actorService.js';
import { linkActorToUser } from './quotaService.js';
import { sendPasswordResetMail } from '../utils/mail.js';
import {
  getPrimaryGoogleClientId,
  isGoogleSignInConfigured,
  verifyGoogleIdToken,
} from '../utils/googleOidc.js';
import { authFeatures, requireFeature } from '../config/authFeatures.js';
import { generateTotpSecret, totpUri, verifyTotp } from './totpService.js';
import { fetchGooglePeopleProfile, GOOGLE_PEOPLE_SCOPES } from './googlePeopleService.js';
import { sanitizeAvatarUrl } from '../utils/safeUrl.js';

const db = pools.users;
const SESSION_DAYS = Math.min(Math.max(Number(process.env.AUTH_SESSION_DAYS) || 14, 1), 30);
const TOTP_CHALLENGE_MS = 5 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const next = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.displayName || '',
    avatarUrl: row.avatar_url || row.avatarUrl || null,
    bio: row.bio || '',
    interests: parseJson(row.interests, []),
    location: row.location || '',
    schools: parseJson(row.schools, []),
    birthday: row.birthday || null,
    phone: row.phone || '',
    phoneVerified: Boolean(row.phone_verified_at),
    totpEnabled: Boolean(row.totp_enabled),
    googleLinked: Boolean(row.google_sub || row.googleSub),
    hasPassword: Boolean(row.password_hash),
  };
}

function parseJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

export async function ensureAuthSchema() {
  await db.query(`
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
  `).catch(() => {});
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_session_token (token_hash),
      KEY idx_session_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reset_token (token_hash),
      KEY idx_reset_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});

  // Additive columns for 2FA / phone / Google People (safe if already exist)
  const alters = [
    `ALTER TABLE app_users ADD COLUMN phone_verified_at DATETIME NULL`,
    `ALTER TABLE app_users ADD COLUMN totp_secret VARCHAR(64) NULL`,
    `ALTER TABLE app_users ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE app_users ADD COLUMN totp_pending_secret VARCHAR(64) NULL`,
    `ALTER TABLE app_users ADD COLUMN google_access_meta JSON NULL`,
  ];
  for (const sql of alters) {
    await db.query(sql).catch(() => {});
  }
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  await db.query(
    `INSERT INTO app_sessions (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [userId, tokenHash, SESSION_DAYS]
  );
  return token;
}

async function afterAuth(userId, actorId) {
  if (!actorId) return;
  try {
    await linkActorToUser(actorId, userId);
    await claimAnonymousHistory(actorId, userId);
  } catch (e) {
    // Qurılma boshqa akkauntqa tegishli — login ishlasin, merge yo‘q
    if (e?.statusCode === 409) return;
    throw e;
  }
}

function assertPasswordStrength(password) {
  const p = String(password || '');
  if (p.length < 8) {
    const err = new Error('Qupıya sóz keminde 8 belgi bolıwı kerek');
    err.statusCode = 400;
    throw err;
  }
  if (p.length > 128) {
    const err = new Error('Qupıya sóz júdá uzun');
    err.statusCode = 400;
    throw err;
  }
  if (!/[A-Za-zÀ-ÿА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(p) || !/\d/.test(p)) {
    const err = new Error('Qupıya sózda keminde bir háriṕ hám bir san bolıwı kerek');
    err.statusCode = 400;
    throw err;
  }
}

function totpChallengeSecret() {
  return (
    process.env.AUTH_TOTP_CHALLENGE_SECRET ||
    process.env.ACTOR_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    ''
  );
}

function createTotpChallenge(userId) {
  const secret = totpChallengeSecret();
  if (!secret || secret.length < 16) {
    const err = new Error('2FA challenge sazlanbaǵan');
    err.statusCode = 503;
    throw err;
  }
  const exp = Date.now() + TOTP_CHALLENGE_MS;
  const payload = `${Number(userId)}.${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyTotpChallenge(token) {
  const secret = totpChallengeSecret();
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const payload = `${userId}.${expStr}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return null;
    }
  } catch {
    return null;
  }
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const id = Number(userId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function issueAuthSession(userId, actorId) {
  await afterAuth(userId, actorId);
  const token = await createSession(userId);
  const user = await getUserById(userId);
  return { token, user: publicUser(user) };
}

async function maybeRequireTotp(userRow, actorId) {
  if (!authFeatures().totp2fa || !userRow?.totp_enabled) {
    return issueAuthSession(userRow.id, actorId);
  }
  return {
    requiresTotp: true,
    challengeToken: createTotpChallenge(userRow.id),
    user: { id: userRow.id, email: userRow.email, displayName: userRow.display_name || '' },
  };
}

export async function registerEmail({ email, password, displayName, actorId }) {
  await ensureAuthSchema();
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const err = new Error('Email dúris emes');
    err.statusCode = 400;
    throw err;
  }
  assertPasswordStrength(password);
  const hash = hashPassword(password);
  const name = String(displayName || cleanEmail.split('@')[0]).slice(0, 80);
  let userId;
  try {
    const [result] = await db.query(
      `INSERT INTO app_users (email, password_hash, display_name) VALUES (?, ?, ?)`,
      [cleanEmail, hash, name]
    );
    userId = result.insertId;
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      const err = new Error('Bul email allaqachon tipke alınǵan');
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
  await afterAuth(userId, actorId);
  const token = await createSession(userId);
  const user = await getUserById(userId);
  return { token, user: publicUser(user) };
}

export async function loginEmail({ email, password, actorId }) {
  await ensureAuthSchema();
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase();
  const [rows] = await db.query(
    `SELECT * FROM app_users WHERE email = ? LIMIT 1`,
    [cleanEmail]
  );
  const row = rows[0];
  if (!row?.password_hash) {
    const err = new Error('Email yamasa qupıya sóz qáte');
    err.statusCode = 401;
    throw err;
  }
  const ok = verifyPassword(password, row.password_hash);
  if (!ok) {
    const err = new Error('Email yamasa qupıya sóz qáte');
    err.statusCode = 401;
    throw err;
  }
  return maybeRequireTotp(row, actorId);
}

/** Google Sign-In (OAuth 2.0 / OpenID Connect ID token). */
export async function loginGoogle({ credential, actorId, nonce }) {
  await ensureAuthSchema();
  if (!isGoogleSignInConfigured()) {
    const err = new Error('Google kiriw házirshe sozlanbaǵan');
    err.statusCode = 503;
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  if (!credential) {
    const err = new Error('Google credential kerek');
    err.statusCode = 400;
    throw err;
  }

  const payload = await verifyGoogleIdToken(String(credential), {
    expectedNonce: nonce || null,
  });
  return upsertGoogleUser(payload, actorId);
}

async function upsertGoogleUser(payload, actorId) {
  const sub = payload.sub;
  const email = payload.email ? String(payload.email).toLowerCase() : null;
  const name = String(payload.name || email?.split('@')[0] || 'Oyınshı').slice(0, 80);
  const avatar = sanitizeAvatarUrl(payload.picture || null);

  let [rows] = await db.query(`SELECT * FROM app_users WHERE google_sub = ? LIMIT 1`, [sub]);
  let user = rows[0];

  if (!user && email) {
    [rows] = await db.query(`SELECT * FROM app_users WHERE email = ? LIMIT 1`, [email]);
    user = rows[0];
    if (user) {
      if (user.google_sub && user.google_sub !== sub) {
        const err = new Error('Bul email basqa Google akkauntqa baylanǵan');
        err.statusCode = 409;
        err.code = 'GOOGLE_EMAIL_CONFLICT';
        throw err;
      }
      await db.query(
        `UPDATE app_users SET
           google_sub = ?,
           avatar_url = COALESCE(avatar_url, ?),
           display_name = COALESCE(NULLIF(display_name, ''), ?)
         WHERE id = ?`,
        [sub, avatar, name, user.id]
      );
      user = await getUserById(user.id);
    }
  }

  if (!user) {
    try {
      const [result] = await db.query(
        `INSERT INTO app_users (email, google_sub, display_name, avatar_url) VALUES (?, ?, ?, ?)`,
        [email, sub, name, avatar]
      );
      user = await getUserById(result.insertId);
    } catch (e) {
      if (e?.code === 'ER_DUP_ENTRY') {
        const err = new Error('Bul Google akkaunt allaqachon tipke alınǵan');
        err.statusCode = 409;
        throw err;
      }
      throw e;
    }
  }

  return maybeRequireTotp(user, actorId);
}

export async function completeTotpLogin({ challengeToken, code, actorId }) {
  requireFeature('totp2fa');
  await ensureAuthSchema();
  const userId = verifyTotpChallenge(challengeToken);
  if (!userId) {
    const err = new Error('2FA waqtı ótti — qayta kiriń');
    err.statusCode = 401;
    err.code = 'TOTP_CHALLENGE_EXPIRED';
    throw err;
  }
  const user = await getUserById(userId);
  if (!user?.totp_enabled || !user.totp_secret) {
    const err = new Error('2FA qosılmaǵan');
    err.statusCode = 400;
    throw err;
  }
  if (!verifyTotp(user.totp_secret, code)) {
    const err = new Error('Authenticator kodı qáte');
    err.statusCode = 401;
    err.code = 'TOTP_INVALID';
    throw err;
  }
  return issueAuthSession(userId, actorId);
}

/** Logged-in email user: attach Google sub. */
export async function linkGoogleAccount(userId, { credential, nonce }) {
  await ensureAuthSchema();
  const payload = await verifyGoogleIdToken(String(credential || ''), {
    expectedNonce: nonce || null,
  });
  const sub = payload.sub;
  const email = payload.email ? String(payload.email).toLowerCase() : null;
  const avatar = payload.picture || null;

  const me = await getUserById(userId);
  if (!me) {
    const err = new Error('Paydalanıwshı tabılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (me.google_sub && me.google_sub !== sub) {
    const err = new Error('Akkauntta basqa Google baylanıwı bar');
    err.statusCode = 409;
    throw err;
  }

  const [taken] = await db.query(
    `SELECT id FROM app_users WHERE google_sub = ? AND id <> ? LIMIT 1`,
    [sub, userId]
  );
  if (taken[0]) {
    const err = new Error('Bul Google akkaunt basqa paydalanıwshıda');
    err.statusCode = 409;
    throw err;
  }

  if (email && me.email && email !== String(me.email).toLowerCase()) {
    const err = new Error('Google email házirgi akkaunt emailı menen sáykes kelmeydi');
    err.statusCode = 400;
    err.code = 'GOOGLE_EMAIL_MISMATCH';
    throw err;
  }

  await db.query(
    `UPDATE app_users SET
       google_sub = ?,
       avatar_url = COALESCE(avatar_url, ?),
       email = COALESCE(email, ?)
     WHERE id = ?`,
    [sub, avatar, email, userId]
  );
  return { user: publicUser(await getUserById(userId)) };
}

export async function unlinkGoogleAccount(userId) {
  await ensureAuthSchema();
  const me = await getUserById(userId);
  if (!me) {
    const err = new Error('Paydalanıwshı tabılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (!me.google_sub) {
    return { user: publicUser(me) };
  }
  if (!me.password_hash) {
    const err = new Error('Aldın qupıya sóz ornatıń — Google sıńırıwdan aldın');
    err.statusCode = 400;
    err.code = 'GOOGLE_UNLINK_NEEDS_PASSWORD';
    throw err;
  }
  await db.query(`UPDATE app_users SET google_sub = NULL WHERE id = ?`, [userId]);
  return { user: publicUser(await getUserById(userId)) };
}

/**
 * Google ID token tekshiruvi — googleOidc.js
 */

export async function getUserById(id) {
  const [rows] = await db.query(`SELECT * FROM app_users WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function getUserByToken(token) {
  if (!token) return null;
  await ensureAuthSchema();
  const tokenHash = hashToken(token);
  const [rows] = await db.query(
    `SELECT u.* FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] || null;
}

export async function destroySession(token) {
  if (!token) return;
  await db.query(`DELETE FROM app_sessions WHERE token_hash = ?`, [hashToken(token)]);
}

export async function updateUserProfile(userId, profile = {}) {
  const fields = [];
  const vals = [];
  const map = {
    displayName: 'display_name',
    bio: 'bio',
    location: 'location',
    phone: 'phone',
    birthday: 'birthday',
  };
  for (const [k, col] of Object.entries(map)) {
    if (profile[k] !== undefined) {
      fields.push(`${col} = ?`);
      let val = profile[k] || null;
      if (k === 'bio' && typeof val === 'string') val = val.slice(0, 2000);
      if (k === 'displayName' && typeof val === 'string') val = val.slice(0, 80);
      if (k === 'location' && typeof val === 'string') val = val.slice(0, 120);
      if (k === 'phone' && typeof val === 'string') val = val.slice(0, 40);
      vals.push(val);
    }
  }
  // Client avatarUrl ignored — faqat /avatar upload yoki Google sync
  if (profile.avatarUrl !== undefined && process.env.AUTH_ALLOW_CLIENT_AVATAR_URL === '1') {
    const safe = sanitizeAvatarUrl(profile.avatarUrl);
    fields.push('avatar_url = ?');
    vals.push(safe);
  }
  if (profile.interests !== undefined) {
    fields.push('interests = ?');
    vals.push(JSON.stringify(profile.interests || []));
  }
  if (profile.schools !== undefined) {
    fields.push('schools = ?');
    vals.push(JSON.stringify(profile.schools || []));
  }
  if (!fields.length) return publicUser(await getUserById(userId));
  vals.push(userId);
  await db.query(`UPDATE app_users SET ${fields.join(', ')} WHERE id = ?`, vals);
  return publicUser(await getUserById(userId));
}

export async function setUserAvatar(userId, publicUrl) {
  await ensureAuthSchema();
  const safe = sanitizeAvatarUrl(publicUrl);
  const prev = await getUserById(userId);
  await db.query(`UPDATE app_users SET avatar_url = ? WHERE id = ?`, [safe, userId]);
  return { user: publicUser(await getUserById(userId)), previousUrl: prev?.avatar_url || null };
}

const RESET_TTL_HOURS = 1;

function appPublicOrigin() {
  return (
    process.env.SITE_ORIGIN ||
    process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function shouldExposeResetUrl() {
  // Productionda hech qachon reset URL qaytarilmaydi (env flag ignore)
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.AUTH_EXPOSE_RESET_URL === '0') return false;
  if (process.env.AUTH_EXPOSE_RESET_URL === '1') return true;
  return true;
}

/** Always returns the same shape — does not reveal whether email exists. */
export async function requestPasswordReset(email) {
  await ensureAuthSchema();
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase();
  const generic = {
    success: true,
    message: 'Eger bul email tipke alınǵan bolsa, tiklew siltemesi jiberildi.',
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return generic;
  }

  const [rows] = await db.query(
    `SELECT id, email, password_hash FROM app_users WHERE email = ? LIMIT 1`,
    [cleanEmail]
  );
  const user = rows[0];
  // Google-only accounts: still allow setting a password via reset
  if (!user) return generic;

  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  await db.query(
    `UPDATE password_reset_tokens SET used_at = NOW()
     WHERE user_id = ? AND used_at IS NULL`,
    [user.id]
  );
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [user.id, tokenHash, RESET_TTL_HOURS]
  );

  const resetUrl = `${appPublicOrigin()}/reset-password?token=${encodeURIComponent(raw)}`;
  const mail = await sendPasswordResetMail({ to: cleanEmail, resetUrl });

  const out = { ...generic, mailed: Boolean(mail.delivered) };
  if (shouldExposeResetUrl()) {
    out.resetUrl = resetUrl;
  }
  return out;
}

export async function resetPasswordWithToken({ token, newPassword, actorId = null }) {
  await ensureAuthSchema();
  assertPasswordStrength(newPassword);
  const raw = String(token || '').trim();
  if (raw.length < 32) {
    const err = new Error('Tiklew siltemesi jaramlı emes');
    err.statusCode = 400;
    throw err;
  }
  const tokenHash = hashToken(raw);
  const [rows] = await db.query(
    `SELECT id, user_id AS userId FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row) {
    const err = new Error('Tiklew siltemesi waqtı ótken yamasa qáte');
    err.statusCode = 400;
    throw err;
  }

  const hash = hashPassword(newPassword);
  await db.query(`UPDATE app_users SET password_hash = ? WHERE id = ?`, [hash, row.userId]);
  await db.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`, [row.id]);
  await db.query(`DELETE FROM app_sessions WHERE user_id = ?`, [row.userId]);

  await afterAuth(row.userId, actorId);

  const sessionToken = await createSession(row.userId);
  const user = await getUserById(row.userId);
  return { token: sessionToken, user: publicUser(user) };
}

export async function destroyOtherSessions(userId, keepToken) {
  await ensureAuthSchema();
  if (!userId) return { revoked: 0 };
  if (!keepToken) {
    const [result] = await db.query(`DELETE FROM app_sessions WHERE user_id = ?`, [userId]);
    return { revoked: result.affectedRows || 0 };
  }
  const [result] = await db.query(
    `DELETE FROM app_sessions WHERE user_id = ? AND token_hash != ?`,
    [userId, hashToken(keepToken)]
  );
  return { revoked: result.affectedRows || 0 };
}

export async function changePassword(userId, { currentPassword, newPassword, keepToken = null }) {
  await ensureAuthSchema();
  assertPasswordStrength(newPassword);
  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('Paydalanıwshı tabılmadı');
    err.statusCode = 404;
    throw err;
  }

  if (user.password_hash) {
    if (!verifyPassword(currentPassword, user.password_hash)) {
      const err = new Error('Házirgi qupıya sóz qáte');
      err.statusCode = 400;
      throw err;
    }
  }

  const hash = hashPassword(newPassword);
  await db.query(`UPDATE app_users SET password_hash = ? WHERE id = ?`, [hash, userId]);
  await destroyOtherSessions(userId, keepToken);
  return { user: publicUser(await getUserById(userId)) };
}

export function authConfig() {
  const googleClientId = getPrimaryGoogleClientId();
  const features = authFeatures();
  return {
    googleClientId,
    googleEnabled: isGoogleSignInConfigured(),
    passwordResetEnabled: true,
    socialProviders: isGoogleSignInConfigured() ? ['google'] : [],
    features,
    googlePeopleScopes: GOOGLE_PEOPLE_SCOPES,
    /** Hamma narsa tayyor, lekin pullik/SMS default off */
    prepNote:
      'Google People, TOTP 2FA hám telefon login sxeması tayyar. SMS/People AUTH_* flaglar menen yoqıladı.',
  };
}

/** Begin TOTP enrollment — returns otpauth URI (Authenticator). */
export async function beginTotpSetup(userId) {
  requireFeature('totp2fa');
  await ensureAuthSchema();
  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('Paydalanıwshı tabılmadı');
    err.statusCode = 404;
    throw err;
  }
  const secret = generateTotpSecret();
  await db.query(`UPDATE app_users SET totp_pending_secret = ? WHERE id = ?`, [secret, userId]);
  const account = user.email || user.display_name || `user-${userId}`;
  return {
    secret,
    otpauthUrl: totpUri({ secret, accountName: account }),
  };
}

export async function confirmTotpSetup(userId, code) {
  requireFeature('totp2fa');
  await ensureAuthSchema();
  const user = await getUserById(userId);
  if (!user?.totp_pending_secret) {
    const err = new Error('Aldın TOTP ornatıwdı baslań');
    err.statusCode = 400;
    throw err;
  }
  if (!verifyTotp(user.totp_pending_secret, code)) {
    const err = new Error('Authenticator kodı qáte');
    err.statusCode = 400;
    throw err;
  }
  await db.query(
    `UPDATE app_users SET totp_secret = ?, totp_enabled = 1, totp_pending_secret = NULL WHERE id = ?`,
    [user.totp_pending_secret, userId]
  );
  return { user: publicUser(await getUserById(userId)) };
}

export async function disableTotp(userId, code) {
  requireFeature('totp2fa');
  await ensureAuthSchema();
  const user = await getUserById(userId);
  if (!user?.totp_enabled || !user.totp_secret) {
    return { user: publicUser(user) };
  }
  if (!verifyTotp(user.totp_secret, code)) {
    const err = new Error('Authenticator kodı qáte');
    err.statusCode = 400;
    throw err;
  }
  await db.query(
    `UPDATE app_users SET totp_secret = NULL, totp_enabled = 0, totp_pending_secret = NULL WHERE id = ?`,
    [userId]
  );
  return { user: publicUser(await getUserById(userId)) };
}

/** Apply Google People profile fields onto user (access token from GIS). */
export async function syncGooglePeople(userId, accessToken) {
  requireFeature('googlePeopleSync');
  await ensureAuthSchema();
  const mapped = await fetchGooglePeopleProfile(accessToken);
  const fields = [];
  const vals = [];
  if (mapped.displayName) {
    fields.push('display_name = COALESCE(NULLIF(display_name, ""), ?)');
    vals.push(mapped.displayName);
  }
  if (mapped.location) {
    fields.push('location = COALESCE(NULLIF(location, ""), ?)');
    vals.push(mapped.location);
  }
  if (mapped.phone) {
    fields.push('phone = COALESCE(NULLIF(phone, ""), ?)');
    vals.push(mapped.phone);
  }
  if (mapped.birthday) {
    fields.push('birthday = COALESCE(birthday, ?)');
    vals.push(mapped.birthday);
  }
  if (mapped.avatarUrl) {
    fields.push('avatar_url = COALESCE(avatar_url, ?)');
    vals.push(mapped.avatarUrl);
  }
  fields.push('google_access_meta = ?');
  vals.push(JSON.stringify({ syncedAt: new Date().toISOString(), raw: mapped.raw }));
  vals.push(userId);
  if (fields.length) {
    await db.query(`UPDATE app_users SET ${fields.join(', ')} WHERE id = ?`, vals);
  }
  return {
    user: publicUser(await getUserById(userId)),
    imported: mapped.raw,
  };
}

export async function markPhoneVerified(userId, phoneE164) {
  await ensureAuthSchema();
  await db.query(
    `UPDATE app_users SET phone = ?, phone_verified_at = NOW() WHERE id = ?`,
    [phoneE164, userId]
  );
  return { user: publicUser(await getUserById(userId)) };
}

/**
 * Soft phone login — faqat phone_verified_at bar akkaunt.
 * Yangi akkaunt yaratmaydı (verify Profile orqalı).
 */
export async function loginWithPhone({ phoneE164, actorId }) {
  await ensureAuthSchema();
  const phone = String(phoneE164 || '').trim();
  const [rows] = await db.query(
    `SELECT * FROM app_users
     WHERE phone = ? AND phone_verified_at IS NOT NULL
     LIMIT 1`,
    [phone]
  );
  const row = rows[0];
  if (!row) {
    const err = new Error('Bul nomer menen tastıyıqlanǵan akkaunt joq');
    err.statusCode = 404;
    err.code = 'PHONE_NOT_LINKED';
    throw err;
  }
  return maybeRequireTotp(row, actorId);
}

export { publicUser };
