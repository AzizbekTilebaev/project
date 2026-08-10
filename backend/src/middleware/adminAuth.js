import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getAdminSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || '';
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

export function createAdminToken(ttlMs = TOKEN_TTL_MS) {
  const secret = getAdminSecret();
  if (!secret || secret.length < 24) {
    const err = new Error('Admin session sazlanbaǵan');
    err.statusCode = 503;
    throw err;
  }
  const payload = {
    role: 'admin',
    exp: Date.now() + ttlMs,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const secret = getAdminSecret();
  if (!secret || secret.length < 24) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body));
    if (payload.role !== 'admin') return null;
    if (!payload.exp || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function loginAdmin(password) {
  const expected = getAdminPassword();
  if (!expected || expected.length < 8) {
    const err = new Error('Admin kiriw sazlanbaǵan. ADMIN_PASSWORD ni .env ge qoyıń.');
    err.statusCode = 503;
    throw err;
  }
  if (!password || !timingSafeEqual(password, expected)) {
    const err = new Error('Qupıya sóz qáte');
    err.statusCode = 401;
    throw err;
  }
  return createAdminToken();
}

export function requireAdmin(req, res, next) {
  const password = getAdminPassword();
  const secret = getAdminSecret();
  if (!password || password.length < 8 || !secret || secret.length < 24) {
    return res.status(503).json({
      success: false,
      error: 'Admin API óshirilgen. ADMIN_PASSWORD / ADMIN_SESSION_SECRET sazlawların kirgiziń.',
    });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Admin ruxsatı kerek' });
  }
  req.admin = payload;
  next();
}
