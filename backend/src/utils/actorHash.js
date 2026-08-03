import crypto from 'crypto';

/** Pseudonymous actor key: raw UUID hech qachon DB ga yozilmaydi. */
export function hashAnonymousId(rawId) {
  const secret =
    process.env.ACTOR_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    'dev-actor-hmac-change-me';
  return crypto.createHmac('sha256', secret).update(String(rawId)).digest('hex');
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAnonymousId(rawId) {
  return typeof rawId === 'string' && UUID_RE.test(rawId.trim());
}
