import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalActor } from '../middleware/actor.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  authConfig,
  beginTotpSetup,
  changePassword,
  checkUsernameAvailable,
  completeTotpLogin,
  confirmTotpSetup,
  destroyOtherSessions,
  destroySession,
  disableTotp,
  getUserById,
  linkGoogleAccount,
  loginEmail,
  loginGoogle,
  markPhoneVerified,
  loginWithPhone,
  registerEmail,
  requestPasswordReset,
  resetPasswordWithToken,
  setUserAvatar,
  syncGooglePeople,
  unlinkGoogleAccount,
  updateUserProfile,
} from '../services/authService.js';
import { requestPhoneOtp, verifyPhoneOtp } from '../services/phoneAuthService.js';
import { authFeatures } from '../config/authFeatures.js';
import {
  deleteStoredAvatar,
  handleAvatarMulter,
  publicAvatarUrl,
} from '../middleware/avatarUpload.js';

function clientMeta(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  const ip = fwd || req.ip || req.socket?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;
  return {
    ip: ip ? String(ip).slice(0, 45) : null,
    userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
  };
}

const router = Router();

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Júdá kóp urınıw. Keyinirek qayta kóriń.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Júdá kóp kiriw urınıwı. 15 minutdan keyin qayta kóriń.' },
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Tiklew limiti. Keyinirek urınıń.' },
});

router.get('/config', (_req, res) => {
  res.json({ success: true, ...authConfig() });
});

router.get('/me', optionalAuth, optionalActor, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Kiriw kerek' });
    }
    if (req.actor?.id) {
      const { resolveActorScope } = await import('../services/quotaService.js');
      await resolveActorScope(req.actor.id, req.user.id);
    }
    res.json({ success: true, user: req.user });
  } catch (err) {
    next(err);
  }
});

router.get('/username-available', async (req, res, next) => {
  try {
    const result = await checkUsernameAvailable(req.query?.u || req.query?.username);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/register', authWriteLimiter, optionalActor, optionalAuth, async (req, res, next) => {
  try {
    const result = await registerEmail({
      email: req.body?.email,
      password: req.body?.password,
      displayName: req.body?.displayName,
      username: req.body?.username,
      actorId: req.actor?.id || null,
      meta: clientMeta(req),
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message, code: err.code });
    }
    next(err);
  }
});

router.post('/login', loginLimiter, optionalActor, async (req, res, next) => {
  try {
    const result = await loginEmail({
      email: req.body?.email,
      login: req.body?.login || req.body?.username,
      password: req.body?.password,
      actorId: req.actor?.id || null,
      meta: clientMeta(req),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/login/totp', loginLimiter, optionalActor, async (req, res, next) => {
  try {
    const result = await completeTotpLogin({
      challengeToken: req.body?.challengeToken,
      code: req.body?.code,
      actorId: req.actor?.id || null,
      meta: clientMeta(req),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

router.post('/google', loginLimiter, optionalActor, async (req, res, next) => {
  try {
    const result = await loginGoogle({
      credential: req.body?.credential,
      nonce: req.body?.nonce,
      actorId: req.actor?.id || null,
      meta: clientMeta(req),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

router.post('/google/link', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const result = await linkGoogleAccount(req.user.id, {
      credential: req.body?.credential,
      nonce: req.body?.nonce,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

router.post('/google/unlink', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const result = await unlinkGoogleAccount(req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    next(err);
  }
});

router.post('/forgot-password', resetLimiter, async (req, res, next) => {
  try {
    const result = await requestPasswordReset(req.body?.email);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/reset-password', resetLimiter, optionalActor, async (req, res, next) => {
  try {
    const result = await resetPasswordWithToken({
      token: req.body?.token,
      newPassword: req.body?.newPassword || req.body?.password,
      actorId: req.actor?.id || null,
      meta: clientMeta(req),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/change-password', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const result = await changePassword(req.user.id, {
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword || req.body?.password,
      keepToken: req.authToken || null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const user = await updateUserProfile(req.user.id, req.body || {});
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.post('/avatar', requireAuth, handleAvatarMulter, async (req, res, next) => {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ success: false, message: 'Rásim faylı kerek' });
    }
    const url = publicAvatarUrl(req.file.filename);
    const { user, previousUrl } = await setUserAvatar(req.user.id, url);
    deleteStoredAvatar(previousUrl);
    res.json({ success: true, user, avatarUrl: url });
  } catch (err) {
    next(err);
  }
});

router.delete('/avatar', requireAuth, async (req, res, next) => {
  try {
    const prev = await getUserById(req.user.id);
    const { user } = await setUserAvatar(req.user.id, null);
    deleteStoredAvatar(prev?.avatar_url);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', optionalAuth, async (req, res, next) => {
  try {
    await destroySession(req.authToken);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/others', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const result = await destroyOtherSessions(req.user.id, req.authToken || null);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

function featureError(res, err, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      feature: err.feature,
    });
  }
  return next(err);
}

/** Prep endpoints — 503 FEATURE_DISABLED until AUTH_* flags are on. */
router.get('/security/status', optionalAuth, (_req, res) => {
  res.json({ success: true, features: authFeatures() });
});

router.post('/security/totp/begin', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const data = await beginTotpSetup(req.user.id);
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

router.post('/security/totp/confirm', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const data = await confirmTotpSetup(req.user.id, req.body?.code);
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

router.post('/security/totp/disable', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const data = await disableTotp(req.user.id, req.body?.code);
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

router.post('/security/google-people/sync', requireAuth, authWriteLimiter, async (req, res, next) => {
  try {
    const data = await syncGooglePeople(req.user.id, req.body?.accessToken);
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

router.post('/security/phone/request-otp', requireAuth, resetLimiter, async (req, res, next) => {
  try {
    const data = await requestPhoneOtp({
      phone: req.body?.phone,
      purpose: 'verify',
      userId: req.user.id,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

router.post('/security/phone/verify-otp', requireAuth, resetLimiter, async (req, res, next) => {
  try {
    const verified = await verifyPhoneOtp({
      phone: req.body?.phone,
      code: req.body?.code,
      purpose: 'verify',
      userId: req.user.id,
    });
    const data = await markPhoneVerified(req.user.id, verified.phone);
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

/** Public soft phone login — AUTH_PHONE_LOGIN=1 */
router.post('/phone/request-otp', loginLimiter, async (req, res, next) => {
  try {
    const data = await requestPhoneOtp({
      phone: req.body?.phone,
      purpose: 'login',
      userId: null,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

router.post('/phone/verify-otp', loginLimiter, optionalActor, async (req, res, next) => {
  try {
    const verified = await verifyPhoneOtp({
      phone: req.body?.phone,
      code: req.body?.code,
      purpose: 'login',
      userId: null,
    });
    const data = await loginWithPhone({
      phoneE164: verified.phone,
      actorId: req.actor?.id || null,
      meta: clientMeta(req),
    });
    res.json({ success: true, ...data });
  } catch (err) {
    featureError(res, err, next);
  }
});

export default router;
