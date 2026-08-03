import crypto from 'crypto';

const DEV_FALLBACK = 'dev-file-sign-change-me';

function secret() {
  const s =
    process.env.FILE_SIGNING_SECRET ||
    process.env.ACTOR_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    '';
  if (!s || s === DEV_FALLBACK) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FILE_SIGNING_SECRET / ACTOR_HMAC_SECRET productionda májburiy');
    }
    return DEV_FALLBACK;
  }
  return s;
}

export function signBookFileAccess(bookId, ttlSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${bookId}:${exp}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return { exp, sig, url: `/api/books/${encodeURIComponent(bookId)}/file?exp=${exp}&sig=${sig}` };
}

export function verifyBookFileAccess(bookId, exp, sig) {
  const e = Number(exp);
  if (!e || !sig || Date.now() / 1000 > e) return false;
  let expected;
  try {
    expected = crypto.createHmac('sha256', secret()).update(`${bookId}:${e}`).digest('hex');
  } catch {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(String(sig)), Buffer.from(expected));
  } catch {
    return false;
  }
}
