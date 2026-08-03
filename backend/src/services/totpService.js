/**
 * TOTP (RFC 6238) — Google/Microsoft Authenticator.
 * SMS kerak emas; AUTH_TOTP_2FA=1 bo‘lganda yoqiladi.
 */
import crypto from 'crypto';

const STEP = 30;
const DIGITS = 6;

function base32Encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = String(str || '')
    .toUpperCase()
    .replace(/=+$/, '')
    .replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function totpUri({ secret, accountName, issuer = 'Qaraqalpaq' }) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function verifyTotp(secret, token, { window = 1 } = {}) {
  const code = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const secretBuf = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / STEP);
  for (let w = -window; w <= window; w++) {
    if (hotp(secretBuf, counter + w) === code) return true;
  }
  return false;
}
