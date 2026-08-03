/**
 * Google Sign-In (OAuth 2.0 / OpenID Connect) ID token verification.
 * Uses Google's tokeninfo endpoint (signature checked by Google).
 */

function parseClientIds() {
  const raw = [
    process.env.GOOGLE_CLIENT_ID || '',
    ...(String(process.env.GOOGLE_CLIENT_IDS || '').split(',')),
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
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const err = new Error('Google token tekshiruwden ótpedi');
      err.statusCode = 401;
      err.code = 'GOOGLE_TOKEN_INVALID';
      throw err;
    }
    payload = await res.json();
  } catch (e) {
    if (e.statusCode) throw e;
    const err = new Error('Google token tekshirile almadi');
    err.statusCode = 503;
    err.code = 'GOOGLE_TOKEN_UNREACHABLE';
    throw err;
  }

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
