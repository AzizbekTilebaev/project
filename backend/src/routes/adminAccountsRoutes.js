import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  loginLegacyOrAccount,
  listAdmins,
  ensureSeedAdmins,
  createAdminAccount,
  updateAdminAccount,
  resetAdminPassword,
  changeOwnPassword,
} from '../services/adminAccountsService.js';
import {
  requirePermission,
  requireOwner,
  requireAnyRole,
  resolveAdmin,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../middleware/rbac.js';
import {
  usersOverview,
  listUsers,
  listQuizAttemptsAdmin,
  getUserDetail,
  deleteUser,
  setUserStatus,
} from '../services/usersAdminService.js';
import { getAttemptReviewForAdmin, forceExpireAttemptAdmin, voidAttemptAdmin } from '../services/quizService.js';
import {
  clearAppErrors,
  deleteAppError,
  getAdminDashboard,
  listAppErrors,
} from '../services/adminDashboardService.js';
import { listExitFeedback } from '../services/statsService.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Login limiti' },
});

// ---------- Auth ----------

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const result = await loginLegacyOrAccount(req.body || {});
    res.json({ success: true, ...result, expiresInHours: 8 });
  } catch (err) {
    next(err);
  }
});

/** Joriy admin profili + ruxsatlari (frontend menyu qurish uchun). */
router.get('/me', (req, res) => {
  const admin = resolveAdmin(req);
  if (!admin) return res.status(401).json({ success: false, error: 'Admin ruxsatı kerek' });
  const permissions = [...(ROLE_PERMISSIONS[admin.role] || [])];
  res.json({
    success: true,
    admin: { id: admin.sub || null, email: admin.email || null, role: admin.role },
    permissions,
  });
});

router.post('/me/password', requireAnyRole, async (req, res, next) => {
  try {
    if (!req.admin.sub) {
      return res.status(400).json({ success: false, error: 'Legacy token — akkaunt kerek' });
    }
    const result = await changeOwnPassword(
      req.admin.sub,
      req.body?.oldPassword,
      req.body?.newPassword
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------- Oraylıq basqarıw paneli ----------

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.VIEW_STATS),
  async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const dashboard = await getAdminDashboard();
      res.json({ success: true, dashboard });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/feedback/exit',
  requirePermission(PERMISSIONS.VIEW_STATS),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const data = await listExitFeedback({
        helpful: req.query.helpful ?? '',
        page: req.query.page,
        limit: req.query.limit,
        days: req.query.days,
      });
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/logs',
  requirePermission(PERMISSIONS.VIEW_LOGS),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const result = await listAppErrors({
        page: req.query?.page,
        limit: req.query?.limit,
        level: req.query?.level,
        search: req.query?.search,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/logs/:id',
  requirePermission(PERMISSIONS.MANAGE_LOGS),
  async (req, res, next) => {
    try {
      const result = await deleteAppError(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/logs/cleanup',
  requirePermission(PERMISSIONS.MANAGE_LOGS),
  async (req, res, next) => {
    try {
      const result = await clearAppErrors({ olderThanDays: req.body?.olderThanDays });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------- Admin akkauntlar (faqat owner) ----------

router.post('/seed', requireOwner, async (req, res, next) => {
  try {
    const result = await ensureSeedAdmins();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/accounts', requireOwner, async (req, res, next) => {
  try {
    const accounts = await listAdmins();
    res.json({ success: true, accounts });
  } catch (err) {
    next(err);
  }
});

router.post('/accounts', requireOwner, async (req, res, next) => {
  try {
    const account = await createAdminAccount(req.body || {}, req.admin.sub || null);
    res.status(201).json({ success: true, account });
  } catch (err) {
    next(err);
  }
});

router.put('/accounts/:id', requireOwner, async (req, res, next) => {
  try {
    const account = await updateAdminAccount(
      req.params.id,
      { role: req.body?.role, active: req.body?.active },
      req.admin.sub || null
    );
    res.json({ success: true, account });
  } catch (err) {
    next(err);
  }
});

router.post('/accounts/:id/reset-password', requireOwner, async (req, res, next) => {
  try {
    const result = await resetAdminPassword(req.params.id, req.body?.newPassword);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------- Foydalanuvchilar boshqaruvi ----------

router.get(
  '/users/overview',
  requirePermission(PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const overview = await usersOverview();
      res.json({ success: true, ...overview });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/users',
  requirePermission(PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const result = await listUsers({
        page: req.query?.page,
        limit: req.query?.limit,
        activeDays: req.query?.activeDays,
        sort: req.query?.sort,
        q: req.query?.q,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/users/:id',
  requirePermission(PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const detail = await getUserDetail(req.params.id);
      res.json({ success: true, ...detail });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/users/:id',
  requirePermission(PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      const result = await deleteUser(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

/** Bloklash — faqat owner (eng xavfli amal) */
router.put('/users/:id/status', requireOwner, async (req, res, next) => {
  try {
    const result = await setUserStatus(req.params.id, { active: req.body?.active });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

/** Global quiz urinishlari (status / quiz / actor filtrlari). */
router.get(
  '/quiz-attempts',
  requirePermission(PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const result = await listQuizAttemptsAdmin({
        page: req.query?.page,
        limit: req.query?.limit,
        status: req.query?.status,
        quizId: req.query?.quizId,
        actorId: req.query?.actorId,
        q: req.query?.q,
        from: req.query?.from,
        to: req.query?.to,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

/** Test urinishidagi barcha javoblarni ko‘rish (admin, ball sarfisiz). */
router.get(
  '/quiz-attempts/:attemptId/review',
  requirePermission(PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const review = await getAttemptReviewForAdmin(req.params.attemptId);
      if (!review) return res.status(404).json({ success: false, error: 'Urınıw tabılmadı' });
      res.json({ success: true, ...review });
    } catch (err) {
      next(err);
    }
  }
);

/** Stuck in_progress → expired (ball yo‘q). */
router.post(
  '/quiz-attempts/:attemptId/force-expire',
  requirePermission(PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const attempt = await forceExpireAttemptAdmin(req.params.attemptId);
      res.json({ success: true, attempt });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
);

/** completed|partial → voided + ball clawback. */
router.post(
  '/quiz-attempts/:attemptId/void',
  requirePermission(PERMISSIONS.MANAGE_USERS),
  async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      const result = await voidAttemptAdmin(req.params.attemptId, {
        reason: req.body?.reason,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      next(err);
    }
  }
);

export default router;
