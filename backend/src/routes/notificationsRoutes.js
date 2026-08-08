import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '../services/deviceTokenService.js';

const router = express.Router();

const tokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Token limiti. Keyinirek urınıń.' },
});

/**
 * POST /api/notifications/register-token
 * Body: { token, platform: 'fcm'|'apns'|'web', appVersion?, deviceLabel? }
 * Real push yuborish — keyinroq; hozir faqat saqlash.
 */
router.post('/register-token', requireActor, optionalAuth, tokenLimiter, async (req, res, next) => {
  try {
    const result = await registerDeviceToken({
      actorId: req.actor?.id || null,
      userId: req.user?.id || null,
      token: req.body?.token,
      platform: req.body?.platform,
      appVersion: req.body?.appVersion || req.body?.app_version || null,
      deviceLabel: req.body?.deviceLabel || req.body?.device_label || null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.error || 'bad_request',
        message: err.message,
      });
    }
    next(err);
  }
});

router.post('/unregister-token', requireActor, tokenLimiter, async (req, res, next) => {
  try {
    const result = await unregisterDeviceToken(req.body?.token);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.error || 'bad_request',
        message: err.message,
      });
    }
    next(err);
  }
});

export default router;
