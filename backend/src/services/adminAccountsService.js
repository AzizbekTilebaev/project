import crypto from 'crypto';
import { pools } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/passwordHash.js';

const db = pools.users;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function ensureSeedAdmins() {
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM admin_accounts`);
  if (n > 0) return { seeded: false, count: n };

  const ownerPass = process.env.ADMIN_OWNER_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!ownerPass || ownerPass.length < 8) {
    return { seeded: false, count: 0, reason: 'no_password' };
  }

  const accounts = [
    { email: process.env.ADMIN_OWNER_EMAIL || 'owner@local', role: 'owner', pass: ownerPass },
  ];

  // Editor/uploader faqat alohida kuchli parol berilganda — ownerPass-editor kabi bashorat yo‘q
  const editorPass = process.env.ADMIN_EDITOR_PASSWORD;
  if (editorPass && editorPass.length >= 8 && editorPass !== ownerPass) {
    accounts.push({
      email: process.env.ADMIN_EDITOR_EMAIL || 'editor@local',
      role: 'editor',
      pass: editorPass,
    });
  }
  const uploaderPass = process.env.ADMIN_UPLOADER_PASSWORD;
  if (uploaderPass && uploaderPass.length >= 8 && uploaderPass !== ownerPass) {
    accounts.push({
      email: process.env.ADMIN_UPLOADER_EMAIL || 'uploader@local',
      role: 'uploader',
      pass: uploaderPass,
    });
  }

  for (const a of accounts) {
    const hash = await hashPassword(a.pass);
    await db.query(
      `INSERT INTO admin_accounts (id, email, password_hash, role, active)
       VALUES (?, ?, ?, ?, 1)`,
      [crypto.randomUUID(), a.email, hash, a.role]
    );
  }
  return { seeded: true, count: accounts.length };
}

export async function loginAdminAccount(email, password) {
  await ensureSeedAdmins();
  const [[row]] = await db.query(
    `SELECT id, email, password_hash AS passwordHash, role, active
     FROM admin_accounts WHERE email = ? LIMIT 1`,
    [String(email || '').trim().toLowerCase()]
  );
  if (!row || !row.active) throw httpError('Login qáte', 401);
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) throw httpError('Login qáte', 401);

  await db
    .query(`UPDATE admin_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id])
    .catch(() => {});

  // Prefer account-scoped token; fall back to legacy shared token shape with extras
  const token = createScopedAdminToken({
    sub: row.id,
    email: row.email,
    role: row.role,
  });
  return { token, admin: { id: row.id, email: row.email, role: row.role } };
}

function createScopedAdminToken({ sub, email, role }, ttlMs = 24 * 60 * 60 * 1000) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || '';
  if (!secret || secret.length < 24) throw httpError('Admin session sazlanbaǵan', 503);
  const payload = { sub, email, role, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyScopedAdminToken(token) {
  if (!token || !token.includes('.')) return null;
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || '';
  if (!secret || secret.length < 24) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const pad = body.length % 4 === 0 ? '' : '='.repeat(4 - (body.length % 4));
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString(
      'utf8'
    );
    const payload = JSON.parse(json);
    if (!payload.exp || Date.now() > Number(payload.exp)) return null;
    // Scoped token akkauntga bog‘langan (sub) — legacy tokenni bu yerda qabul qilmaymiz
    if (!payload.role || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

const VALID_ROLES = new Set(['owner', 'editor', 'uploader', 'moderator']);

export async function listAdmins() {
  const [rows] = await db.query(
    `SELECT id, email, role, active, created_at AS createdAt, last_login_at AS lastLoginAt
     FROM admin_accounts ORDER BY role, email`
  );
  return rows;
}

export async function createAdminAccount({ email, password, role }, createdBy = null) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) throw httpError('Email nadurıs');
  if (!password || String(password).length < 8) {
    throw httpError('Qupıya sóz keminde 8 belgiden ibarat bolıwı kerek');
  }
  if (!VALID_ROLES.has(role)) throw httpError('Rol nadurıs (owner/editor/uploader/moderator)');

  const [[existing]] = await db.query(
    `SELECT id FROM admin_accounts WHERE email = ? LIMIT 1`,
    [cleanEmail]
  );
  if (existing) throw httpError('Bu email band', 409);

  const id = crypto.randomUUID();
  const hash = await hashPassword(password);
  await db.query(
    `INSERT INTO admin_accounts (id, email, password_hash, role, active, created_by)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [id, cleanEmail, hash, role, createdBy]
  );
  return { id, email: cleanEmail, role, active: 1 };
}

export async function updateAdminAccount(id, { role, active }, actingAdminId = null) {
  const [[row]] = await db.query(
    `SELECT id, email, role, active FROM admin_accounts WHERE id = ? LIMIT 1`,
    [String(id)]
  );
  if (!row) throw httpError('Akkaunt tabılmadı', 404);

  const nextRole = role !== undefined ? role : row.role;
  const nextActive = active !== undefined ? (active ? 1 : 0) : row.active;
  if (!VALID_ROLES.has(nextRole)) throw httpError('Rol nadurıs');

  // Oxirgi faol ownerni o‘chirish/rolini pasaytirishga yo‘l qo‘ymaymiz
  const losesOwner = row.role === 'owner' && (nextRole !== 'owner' || !nextActive);
  if (losesOwner) {
    const [[{ n }]] = await db.query(
      `SELECT COUNT(*) AS n FROM admin_accounts WHERE role = 'owner' AND active = 1 AND id <> ?`,
      [row.id]
    );
    if (n === 0) throw httpError('Sońǵı belsendi ownerdi ózgertiw múmkin emes', 409);
  }
  if (actingAdminId && actingAdminId === row.id && !nextActive) {
    throw httpError('Óz akkauntıńızdı óshire almaysız', 409);
  }

  await db.query(`UPDATE admin_accounts SET role = ?, active = ? WHERE id = ?`, [
    nextRole,
    nextActive,
    row.id,
  ]);
  return { id: row.id, email: row.email, role: nextRole, active: nextActive };
}

export async function resetAdminPassword(id, newPassword) {
  if (!newPassword || String(newPassword).length < 8) {
    throw httpError('Qupıya sóz keminde 8 belgiden ibarat bolıwı kerek');
  }
  const [[row]] = await db.query(`SELECT id FROM admin_accounts WHERE id = ? LIMIT 1`, [
    String(id),
  ]);
  if (!row) throw httpError('Akkaunt tabılmadı', 404);
  const hash = await hashPassword(newPassword);
  await db.query(`UPDATE admin_accounts SET password_hash = ? WHERE id = ?`, [hash, row.id]);
  return { id: row.id, reset: true };
}

/** O‘z parolini almashtirish (eski parol tekshiriladi). */
export async function changeOwnPassword(adminId, oldPassword, newPassword) {
  if (!newPassword || String(newPassword).length < 8) {
    throw httpError('Jańa qupıya sóz keminde 8 belgiden ibarat bolıwı kerek');
  }
  const [[row]] = await db.query(
    `SELECT id, password_hash AS passwordHash FROM admin_accounts WHERE id = ? AND active = 1 LIMIT 1`,
    [String(adminId)]
  );
  if (!row) throw httpError('Akkaunt tabılmadı', 404);
  const ok = await verifyPassword(oldPassword, row.passwordHash);
  if (!ok) throw httpError('Burınǵı qupıya sóz qáte', 401);
  const hash = await hashPassword(newPassword);
  await db.query(`UPDATE admin_accounts SET password_hash = ? WHERE id = ?`, [hash, row.id]);
  return { changed: true };
}

/** Keep legacy password login for books/crosswords during migration */
export async function loginLegacyOrAccount(body) {
  if (body?.email) {
    return loginAdminAccount(body.email, body.password);
  }
  const disableLegacy =
    process.env.NODE_ENV === 'production' || process.env.ADMIN_DISABLE_LEGACY === '1';
  if (disableLegacy) {
    throw httpError('Legacy admin kiriw óshirildi — email menen kiriń', 403);
  }
  // legacy single password
  const { loginAdmin } = await import('../middleware/adminAuth.js');
  const token = loginAdmin(body?.password);
  return { token, admin: { id: null, email: null, role: 'owner', legacy: true } };
}
