import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

/** Query limit/page ni xavfsiz diapazonga siqish */
export function clampInt(value, { min = 1, max = 100, fallback = 20 } = {}) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Import endpointi: faqat serverdagi IMPORT_API_KEY bilan */
export function requireImportKey(req, res, next) {
  const expected = process.env.IMPORT_API_KEY;
  if (!expected || expected.length < 24) {
    return res.status(503).json({
      success: false,
      error: 'Import API óshirilgen. CLI arqalı import etiń.',
    });
  }

  const provided =
    req.headers['x-import-key'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!provided || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ success: false, error: 'Ruxsat joq' });
  }
  next();
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const isProd = process.env.NODE_ENV === 'production';

/** Umumiy API rate limit — productionda qattiqroq */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 900 : 5000,
  skip: () => !isProd,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Júdá kóp soraw. Keyinirek urınıń.' },
});

/** Qidiruv / scrape qarshi — productionda qattiq */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 60 : 300,
  skip: () => !isProd,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Izlew limiti. Bir minutdan keyin urınıń.' },
});

/** Ro‘yxat / random / letter — scrape sekinlashtirish */
export const dictBrowseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 90 : 400,
  skip: () => !isProd,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Sózlik limiti. Bir minutdan keyin urınıń.' },
});

/** Import uchun juda qattiq limit */
export const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Import limiti. Keyinirek urınıń.' },
});

/** Crowdsourcing taklif / ovoz */
export const suggestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Usınıs shegi tawsıldı. Keyinirek urınıń.' },
});

export const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Dawıs limiti. Keyinirek urınıń.' },
});
