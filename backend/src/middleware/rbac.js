/**
 * Rolga asoslangan ruxsat nazorati (RBAC).
 *
 * Rollar (kk_users.admin_accounts.role):
 *  - owner     — hamma narsa (admin/foydalanuvchi boshqaruvi ham)
 *  - editor    — kontent: kitob, krossvord, dars, immersion, moderatsiya
 *  - uploader  — faqat yuklash: kitob, immersion
 *  - moderator — jamoat takliflari moderatsiyasi + foydalanuvchilarni ko‘rish
 *
 * Legacy bitta-parol token (adminAuth.loginAdmin) owner sifatida qabul qilinadi
 * (migratsiya davri uchun).
 */
import { verifyScopedAdminToken } from '../services/adminAccountsService.js';
import { verifyAdminToken } from './adminAuth.js';

export const PERMISSIONS = {
  MANAGE_ADMINS: 'manage_admins',
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  MANAGE_BOOKS: 'manage_books',
  MANAGE_CROSSWORDS: 'manage_crosswords',
  MANAGE_LESSONS: 'manage_lessons',
  MANAGE_IMMERSION: 'manage_immersion',
  MODERATE_COMMUNITY: 'moderate_community',
  VIEW_STATS: 'view_stats',
  VIEW_LOGS: 'view_logs',
  MANAGE_LOGS: 'manage_logs',
  MANAGE_QUIZZES: 'manage_quizzes',
  MANAGE_JUMBAQLAR: 'manage_jumbaqlar',
  MANAGE_WRITERS: 'manage_writers',
};

const ALL = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = {
  owner: new Set(ALL),
  editor: new Set([
    PERMISSIONS.MANAGE_BOOKS,
    PERMISSIONS.MANAGE_CROSSWORDS,
    PERMISSIONS.MANAGE_LESSONS,
    PERMISSIONS.MANAGE_IMMERSION,
    PERMISSIONS.MANAGE_QUIZZES,
    PERMISSIONS.MANAGE_JUMBAQLAR,
    PERMISSIONS.MANAGE_WRITERS,
    PERMISSIONS.MODERATE_COMMUNITY,
    PERMISSIONS.VIEW_STATS,
  ]),
  uploader: new Set([PERMISSIONS.MANAGE_BOOKS, PERMISSIONS.MANAGE_IMMERSION]),
  moderator: new Set([
    PERMISSIONS.MODERATE_COMMUNITY,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_STATS,
  ]),
};

export function roleHasPermission(role, permission) {
  const set = ROLE_PERMISSIONS[role];
  return Boolean(set && set.has(permission));
}

/** Authorization headeridan admin payload (scoped yoki legacy) oladi. */
export function resolveAdmin(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;
  const scoped = verifyScopedAdminToken(token);
  if (scoped) return { ...scoped, legacy: false };
  const legacy = verifyAdminToken(token);
  if (legacy) return { ...legacy, role: 'owner', legacy: true };
  return null;
}

/** Berilgan ruxsat(lar)dan kamida bittasini talab qiladi. */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    const admin = resolveAdmin(req);
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Admin ruxsatı kerek' });
    }
    const ok = permissions.some((p) => roleHasPermission(admin.role, p));
    if (!ok) {
      return res.status(403).json({
        success: false,
        error: `Ruxsat jeterli emes (rol: ${admin.role})`,
      });
    }
    req.admin = admin;
    next();
  };
}

export const requireOwner = requirePermission(PERMISSIONS.MANAGE_ADMINS);

/** Istalgan haqiqiy admin token (rolidan qat’i nazar). */
export function requireAnyRole(req, res, next) {
  const admin = resolveAdmin(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Admin ruxsatı kerek' });
  }
  req.admin = admin;
  next();
}
