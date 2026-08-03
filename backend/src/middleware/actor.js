import { isValidAnonymousId, hashAnonymousId } from '../utils/actorHash.js';
import { ensureActor } from '../services/actorService.js';

/**
 * X-Anonymous-Id (UUID) → HMAC actor_key → DB actor row.
 * requireActor=true bo‘lsa header majburiy.
 */
export function withActor({ requireActor = true } = {}) {
  return async (req, res, next) => {
    try {
      const raw = req.headers['x-anonymous-id'];
      if (!raw) {
        if (requireActor) {
          return res.status(400).json({
            success: false,
            message: 'X-Anonymous-Id headeri kerek',
          });
        }
        req.actor = null;
        return next();
      }
      if (!isValidAnonymousId(raw)) {
        return res.status(400).json({
          success: false,
          message: 'X-Anonymous-Id UUID formatında bolıwı kerek',
        });
      }
      const actorKey = hashAnonymousId(raw.trim());
      const actor = await ensureActor(actorKey);
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
