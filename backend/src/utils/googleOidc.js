/**
 * Google Sign-In (OAuth 2.0 / OpenID Connect) ID token verification.
 * Prefer local JWKS verify (cached) — tokeninfo har safar Google ga boradi, sekin.
 */

import crypto from 'crypto';

function parseClientIds() {
  const raw = [
    process.env.GOOGLE_CLIENT_ID || '',
    ...String(process.env.GOOGLE_CLIENT_IDS || '').split(','),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(raw)];
}

export function getGoogleClientIds() {
  return parseClientIds();
}

export function getPrimaryGoogleClientId() {
  return parseClientIds()[0] || '';
}

export function isGoogleSignInConfigured() {
  return parseClientIds().length > 0;
}

let jwksCache = null;

function b64urlToBuf(part) {
  const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4));
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function decodeJwtPart(part) {
  return JSON.parse(b64urlToBuf(part).toString('utf8'));
}

async function getGoogleJwks() {
  if (jwksCache && Date.now() < jwksCache.expiresAt) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = new Error('Google JWKS júklenbedi');
    err.statusCode = 503;
    err.code = 'GOOGLE_JWKS_UNREACHABLE';
    throw err;
  }
  const body = await res.json();
  const cc = String(res.headers.get('cache-control') || '');
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.min(Number(maxAgeMatch[1]) || 3600, 86400) : 3600;
  jwksCache = {
    keys: Array.isArray(body.keys) ? body.keys : [],
    expiresAt: Date.now() + Math.max(60, maxAgeSec) * 1000,
  };
  return jwksCache.keys;
}

function validateClaims(payload, opts = {}) {
  const clientIds = parseClientIds();
  const aud = String(payload.aud || '');
  const azp = String(payload.azp || '');
  if (!clientIds.includes(aud) && !clientIds.includes(azp)) {
    const err = new Error('Google client sáykes kelmeydi');
    err.statusCode = 401;
    err.code = 'GOOGLE_AUD_MISMATCH';
    throw err;
  }

  const iss = String(payload.iss || '');
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
    const err = new Error('Google issuer jaramlı emes');
    err.statusCode = 401;
    err.code = 'GOOGLE_ISS_INVALID';
    throw err;
  }

  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() - 30_000) {
    const err = new Error('Google token waqıtı ótken');
    err.statusCode = 401;
    err.code = 'GOOGLE_TOKEN_EXPIRED';
    throw err;
  }

  if (payload.email && String(payload.email_verified) !== 'true' && payload.email_verified !== true) {
    const err = new Error('Google email tastıyıqlanbaǵan');
    err.statusCode = 401;
    err.code = 'GOOGLE_EMAIL_UNVERIFIED';
    throw err;
  }

  if (!payload.sub) {
    const err = new Error('Google token jaramlı emes');
    err.statusCode = 400;
    err.code = 'GOOGLE_SUB_MISSING';
    throw err;
  }

  if (opts.expectedNonce) {
    const nonce = payload.nonce || '';
    if (!nonce || nonce !== opts.expectedNonce) {
      const err = new Error('Google nonce sáykes kelmeydi');
      err.statusCode = 401;
      err.code = 'GOOGLE_NONCE_MISMATCH';
      throw err;
    }
  }

  return payload;
}

async function verifyWithJwks(credential) {
  const parts = String(credential).split('.');
  if (parts.length !== 3) {
    const err = new Error('Google credential jaramlı emes');
    err.statusCode = 400;
    err.code = 'GOOGLE_CREDENTIAL_MISSING';
    throw err;
  }
  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  const keys = await getGoogleJwks();
  const jwk = keys.find((k) => k.kid && k.kid === header.kid) || keys[0];
  if (!jwk) {
    const err = new Error('Google JWKS key tabılmadı');
    err.statusCode = 503;
    err.code = 'GOOGLE_JWKS_EMPTY';
    throw err;
  }
  const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = b64urlToBuf(parts[2]);
  const alg = String(header.alg || 'RS256');
  const verifyAlg = alg === 'RS256' ? 'RSA-SHA256' : alg === 'RS384' ? 'RSA-SHA384' : 'RSA-SHA256';
  const ok = crypto.verify(verifyAlg, data, keyObject, signature);
  if (!ok) {
    const err = new Error('Google token tekshiruwden ótpedi');
    err.statusCode = 401;
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }
  return payload;
}

/** Fallback — tokeninfo (sekinroq, har safar Google). */
async function verifyWithTokeninfo(credential) {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const err = new Error('Google token tekshiruwden ótpedi');
    err.statusCode = 401;
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }
  return res.json();
}

/**
 * @param {string} credential - GIS ID token (JWT)
 * @param {{ expectedNonce?: string | null }} [opts]
 */
export async function verifyGoogleIdToken(credential, opts = {}) {
  const clientIds = parseClientIds();
  if (!clientIds.length) {
    const err = new Error('Google kiriw házirshe sozlanbaǵan');
    err.statusCode = 503;
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }
  if (!credential || typeof credential !== 'string') {
    const err = new Error('Google credential kerek');
    err.statusCode = 400;
    err.code = 'GOOGLE_CREDENTIAL_MISSING';
    throw err;
  }

  let payload;
  try {
    payload = await verifyWithJwks(credential);
  } catch (e) {
    if (e?.code === 'GOOGLE_NOT_CONFIGURED' || e?.code === 'GOOGLE_CREDENTIAL_MISSING') throw e;
    // JWKS fail → tokeninfo fallback
    try {
      payload = await verifyWithTokeninfo(credential);
    } catch (e2) {
      if (e2.statusCode) throw e2;
      const err = new Error('Google token tekshirile almadi');
      err.statusCode = 503;
      err.code = 'GOOGLE_TOKEN_UNREACHABLE';
      throw err;
    }
  }

  return validateClaims(payload, opts);
}
