import { isValidAnonymousId, hashAnonymousId } from '../utils/actorHash.js';
import { ensureActor } from '../services/actorService.js';
import { noteAnonymousIdFromIp } from './actorAbuseGuard.js';

/**
 * X-Anonymous-Id (UUID) → HMAC actor_key → DB actor row.
 * requireActor=true bo‘lsa header majburiy.
 * Eslatma: UUID faqat identifikator — spoof mumkin; actorWriteLimiter + UTC claim himoya.
 */
export function withActor({ requireActor = true } = {}) {
  return async (req, res, next) => {
    try {
      const raw = req.headers['x-anonymous-id'];
      if (!raw) {
        if (requireActor) {
          return res.status(400).json({
            success: false,
            error: 'missing_anonymous_id',
            message: 'X-Anonymous-Id headeri kerek',
          });
        }
        req.actor = null;
        return next();
      }
      if (!isValidAnonymousId(raw)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_anonymous_id',
          message: 'X-Anonymous-Id UUID formatında bolıwı kerek',
        });
      }
      const trimmed = raw.trim();
      noteAnonymousIdFromIp(req.ip || req.socket?.remoteAddress || '', trimmed);
      const actorKey = hashAnonymousId(trimmed);
      const actor = await ensureActor(actorKey);
      if (Number(actor.isBlocked)) {
        return res.status(403).json({
          success: false,
          error: 'actor_blocked',
          message: 'Akkaunt bloklangan',
        });
      }
      req.actor = {
        id: actor.id,
        key: actorKey,
        ageYears: actor.ageYears ?? null,
        ageConsent: Boolean(actor.ageConsent),
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireActor = withActor({ requireActor: true });
export const optionalActor = withActor({ requireActor: false });
