import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import tusindirmeRoutes from './routes/tusindirmeRoutes.js';
import seoRoutes from './routes/seoRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import booksRoutes from './routes/booksRoutes.js';
import gameRoomRoutes from './routes/gameRoomRoutes.js';
import crosswordRoutes from './routes/crosswordRoutes.js';
import tutorRoutes from './routes/tutorRoutes.js';
import immersionRoutes from './routes/immersionRoutes.js';
import publicApiRoutes from './routes/publicApiRoutes.js';
import adminAccountsRoutes from './routes/adminAccountsRoutes.js';
import literatureRoutes from './routes/literatureRoutes.js';
import jumbaqRoutes from './routes/jumbaqRoutes.js';
import readingRoutes from './routes/readingRoutes.js';
import morphologyRoutes from './routes/morphologyRoutes.js';
import dictsRoutes from './routes/dictsRoutes.js';
import pointsRoutes from './routes/pointsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import favoritesRoutes from './routes/favoritesRoutes.js';
import recentWordsRoutes from './routes/recentWordsRoutes.js';
import quotasRoutes from './routes/quotasRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import { apiLimiter } from './middleware/security.js';
import { ensureUploadsDir } from './middleware/bookUpload.js';
import { ensureWriterPhotosDir } from './middleware/writerPhotoUpload.js';
import { ensureAvatarsDir } from './middleware/avatarUpload.js';
import { attachGameSocket } from './realtime/gameSocket.js';
import { pools, DB } from './config/db.js';
import { logAppError } from './utils/errorLogger.js';

dotenv.config();

if (!process.env.DB_NAME && !process.env.DATABASE_TUSINDIRME) {
  console.error('❌ DB ulanishi uchun DB_NAME yoki DATABASE_TUSINDIRME kerak.');
  console.error('Run: npm run ensure-env && npm run setup');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET || '';
if (isProd && (!jwtSecret || jwtSecret.length < 32)) {
  console.error('❌ Productionda JWT_SECRET (≥32 belgi) májburiy.');
  process.exit(1);
}
if (jwtSecret && jwtSecret.length < 32) {
  console.warn('⚠️  JWT_SECRET juda qisqa — kamida 32 belgi tavsiya etiladi.');
}

if (isProd && process.env.AUTH_EXPOSE_RESET_URL === '1') {
  console.error('❌ Productionda AUTH_EXPOSE_RESET_URL=1 qabıl etilmeydi.');
  process.exit(1);
}
if (isProd && process.env.AUTH_EXPOSE_OTP === '1') {
  console.error('❌ Productionda AUTH_EXPOSE_OTP=1 qabıl etilmeydi.');
  process.exit(1);
}

const actorSecret = process.env.ACTOR_HMAC_SECRET || '';
const insecureActorDefaults = new Set([
  '',
  'dev-actor-hmac-change-me',
  'change-me',
  'change-me-actor-hmac',
]);
if (isProd && (!actorSecret || insecureActorDefaults.has(actorSecret) || actorSecret.length < 32)) {
  console.error('❌ Productionda ACTOR_HMAC_SECRET (≥32, default emes) májburiy.');
  process.exit(1);
}
if (!actorSecret || insecureActorDefaults.has(actorSecret)) {
  console.warn('⚠️  ACTOR_HMAC_SECRET default/bo‘sh — productionda o‘zgartiriń.');
}

const insecureAdminPasswords = new Set([
  '',
  'change-me',
  'change-me-admin-password',
  'admin',
  'password',
  '12345678',
]);
const adminPassword = process.env.ADMIN_PASSWORD || '';
if (isProd && insecureAdminPasswords.has(adminPassword)) {
  console.error('❌ Productionda kúshli ADMIN_PASSWORD májburiy (default emes).');
  process.exit(1);
}
if (insecureAdminPasswords.has(adminPassword)) {
  console.warn('⚠️  ADMIN_PASSWORD default/zaif — productionda o‘zgartiriń.');
}
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || '';
if (isProd && (!adminSessionSecret || adminSessionSecret.length < 32)) {
  console.error('❌ Productionda ADMIN_SESSION_SECRET (≥32) májburiy.');
  process.exit(1);
}

const distPath = path.join(process.cwd(), '..', 'frontend', 'dist');
if (isProd && !fs.existsSync(path.join(distPath, 'index.html'))) {
  console.error('❌ Productionda frontend/dist topılmadı. Avval: npm run build:frontend');
  process.exit(1);
}

// Reverse proxy (Nginx) orqasida rate-limit / req.ip to'g'ri ishlashi uchun
if (isProd || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.some((o) => o === '*' || o === 'null')) {
  console.error('❌ FRONTEND_ORIGIN da wildcard (*) yoki null ruxsat etilmaydi.');
  process.exit(1);
}
if (isProd && allowedOrigins.some((o) => /localhost|127\.0\.0\.1/i.test(o))) {
  console.warn('⚠️  Productionda FRONTEND_ORIGIN ichida localhost bor — tekshiriń.');
}

// Server versiyasi — mijoz headeri ixtiyoriy; yo‘qligi yoki boshqa qiymat rad etilmaydi
app.use('/api', (req, res, next) => {
  res.setHeader('X-API-Version', '1');
  const clientVer = req.get('x-api-version');
  if (clientVer != null && String(clientVer).trim() !== '' && String(clientVer).trim() !== '1') {
    console.info(
      `[api-version] client=${String(clientVer).slice(0, 32)} ${req.method} ${req.originalUrl || req.url}`
    );
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            'default-src': ["'self'"],
            'script-src': [
              "'self'",
              'https://accounts.google.com',
              'https://apis.google.com',
            ],
            'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
            'img-src': [
              "'self'",
              'data:',
              'blob:',
              'https://*.googleusercontent.com',
              'https://*.gstatic.com',
            ],
            'connect-src': [
              "'self'",
              ...allowedOrigins,
              'https://accounts.google.com',
              'https://oauth2.googleapis.com',
              'https://www.googleapis.com',
              'https://gstatic.com',
              'https://*.gstatic.com',
            ],
            'frame-src': ["'self'", 'blob:', 'https://accounts.google.com'],
            'object-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
          },
        }
      : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Google Identity Services (popup / One Tap) uchun
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS: origin ruxsat etilmagan'));
    },
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.get('/', (req, res) => {
  if (isProd) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  res.json({
    message: 'Qaraqalpaq Til Platforması API',
    version: '1.0.0',
    endpoints: {
      Tusindirme: '/api/tusindirme',
      Quizzes: '/api/quizzes',
      Books: '/api/books',
      Literature: '/api/literature',
      Jumbaqlar: '/api/jumbaqlar',
      ReadingTutor: '/api/reading',
      Rooms: '/api/rooms',
      Crosswords: '/api/crosswords',
      Health: '/api/health',
    },
  });
});

// Health — rate-limit oldida (uptime probe byudjetni yemasin); barcha kk_* pool
app.get('/api/health', async (req, res) => {
  const withTimeout = (p, ms = 2000) =>
    Promise.race([
      p,
      new Promise((_, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        t.unref?.();
      }),
    ]);

  const checks = {};
  await Promise.all(
    Object.entries(pools).map(async ([key, pool]) => {
      try {
        await withTimeout(pool.query('SELECT 1'));
        checks[key] = true;
      } catch {
        checks[key] = false;
      }
    })
  );
  // Legacy alias (eski monitoring)
  checks.dictionary = Boolean(checks.tusindirme);
  checks.quiz = Boolean(checks.quiz);
  const coreOk = Object.keys(DB).every((k) => checks[k]);
  res.status(coreOk ? 200 : 503).json({
    success: coreOk,
    status: coreOk ? 'ok' : 'degraded',
    checks,
    uptime: process.uptime(),
  });
});

try {
  ensureUploadsDir();
  ensureWriterPhotosDir();
  ensureAvatarsDir();
} catch (err) {
  console.warn('⚠️  uploads papkası yaratılmadı:', err.message);
}

app.use('/api', apiLimiter);
app.use('/api/tusindirme', tusindirmeRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/rooms', gameRoomRoutes);
app.use('/api/crosswords', crosswordRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/immersion', immersionRoutes);
app.use('/api/literature', literatureRoutes);
app.use('/api/jumbaqlar', jumbaqRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/morphology', morphologyRoutes);
app.use('/api/dicts', dictsRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/recent-words', recentWordsRoutes);
app.use('/api/quotas', quotasRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminAccountsRoutes);
app.use('/api/v1', publicApiRoutes);
app.use('/', seoRoutes);

// Faqat jamoatchilik rasmlari — books/immersion signed/auth API orqali
// UPLOADS_ROOT: restore-drill izolyatsiyasi (asl public/uploads ni buzmaslik)
const publicUploadsRoot = process.env.UPLOADS_ROOT
  ? path.resolve(process.env.UPLOADS_ROOT)
  : path.join(process.cwd(), 'public', 'uploads');
app.use(
  '/uploads/avatars',
  express.static(path.join(publicUploadsRoot, 'avatars'), { maxAge: '1d' })
);
app.use(
  '/uploads/writers',
  express.static(path.join(publicUploadsRoot, 'writers'), { maxAge: '1d' })
);
app.use('/uploads/books', (_req, res) => {
  res.status(403).json({ success: false, error: 'Kitap faylları tek imzolangan URL arqalı' });
});
app.use('/uploads/immersion', (_req, res) => {
  res.status(403).json({ success: false, error: 'Immersion faylları tek API arqalı' });
});

if (isProd) {
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // hashed chunks — uzoq cache
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith(`${path.sep}index.html`) || filePath.endsWith('index.html')) {
          // entry HTML — yangi deploy dan keyin eski chunk hash qolmasin
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    // Yo‘q /assets/* ga index.html bermaslik — "failed to fetch dynamically imported module" oldini oladi
    if (req.path.startsWith('/assets/')) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tabılmadı' });
});

app.use((err, req, res, _next) => {
  if (err?.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Origin ruxsat etilmegen' });
  }

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    console.error('Unhandled error:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
    // kk_logs ga yozamiz (fire-and-forget, so‘rovni bloklamaydi)
    logAppError({
      level: 'error',
      source: 'http',
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      message: err.message,
      stack: err.stack,
    });
  }

  const errorMessage =
    statusCode < 500 || process.env.NODE_ENV === 'development'
      ? err.message || 'Server qáteligi'
      : 'Server qáteligi';

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

const server = http.createServer(app);
attachGameSocket(server, { allowedOrigins });

server.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
  console.log('🔌 Socket.IO: /socket.io');
  if (!process.env.IMPORT_API_KEY) {
    console.warn('⚠️  IMPORT_API_KEY yo‘q — HTTP import o‘chirilgan (CLI ishlaydi).');
  }
});

async function shutdown(signal) {
  console.log(`\n${signal} — server to‘xtatilmoqda...`);
  server.close(async () => {
    try {
      await Promise.all(Object.values(pools).map((p) => p.end().catch(() => {})));
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
