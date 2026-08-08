import express from 'express';
import {
  listQuizzes,
  getQuizPublic,
  startAttempt,
  resumeAttempt,
  viewQuestion,
  answerQuestion,
  finalizeAttempt,
  getAttemptResult,
  findActiveAttempt,
  listAttemptsForActor,
  listAttemptsForActorDetailed,
  getQuizStatistics,
  getAttemptReviewStatus,
  unlockAttemptReview,
  getAttemptReview,
} from '../services/quizService.js';
import { requireActor, optionalActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import { assertCanStartQuiz } from '../services/quotaService.js';
import { setAgeConsent, deleteActorData, cleanupOldEvents, recordEvent } from '../services/actorService.js';
import { requireImportKey } from '../middleware/security.js';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import {
  listQuizzesAdmin,
  getQuizAdmin,
  createQuizAdmin,
  updateQuizAdmin,
  deleteQuizAdmin,
} from '../services/quizAdminService.js';
import {
  startAdaptiveAttempt,
  answerAdaptive,
  abandonAdaptiveAttempt,
  getAbility,
  getAdaptiveInProgressId,
} from '../services/adaptiveQuizService.js';

const router = express.Router();

// ---------- Admin: test yaratish/tahrirlash ----------
const canManageQuizzes = requirePermission(PERMISSIONS.MANAGE_QUIZZES);

function adminEndpoint(handler) {
  return async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      await handler(req, res);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  };
}

router.get(
  '/admin/list',
  canManageQuizzes,
  adminEndpoint(async (req, res) => {
    const data = await listQuizzesAdmin({
      q: req.query.q || '',
      level: req.query.level || '',
      category: req.query.category || '',
      published: req.query.published ?? '',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, quizzes: data.items, ...data });
  })
);

router.get(
  '/admin/:id',
  canManageQuizzes,
  adminEndpoint(async (req, res) => {
    const quiz = await getQuizAdmin(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Test tabılmadı' });
    res.json({ success: true, quiz });
  })
);

router.post(
  '/admin',
  canManageQuizzes,
  adminEndpoint(async (req, res) => {
    const quiz = await createQuizAdmin(req.body || {});
    res.status(201).json({ success: true, quiz });
  })
);

router.put(
  '/admin/:id',
  canManageQuizzes,
  adminEndpoint(async (req, res) => {
    const quiz = await updateQuizAdmin(req.params.id, req.body || {});
    res.json({ success: true, quiz });
  })
);

router.delete(
  '/admin/:id',
  canManageQuizzes,
  adminEndpoint(async (req, res) => {
    const result = await deleteQuizAdmin(req.params.id);
    res.json({ success: true, ...result });
  })
);

router.get('/', async (req, res, next) => {
  try {
    const quizzes = await listQuizzes();
    res.json({ success: true, quizzes });
  } catch (err) {
    next(err);
  }
});

router.post('/adaptive/start', requireActor, optionalAuth, async (req, res, next) => {
  try {
    const skill = req.body?.skill || 'global';
    const forceNew = Boolean(req.body?.forceNew);
    const inProgressId = await getAdaptiveInProgressId(req.actor.id, skill);
    if (!inProgressId || forceNew) {
      await assertCanStartQuiz(req.actor.id, { isAuthenticated: Boolean(req.user) });
    }
    res.set('Cache-Control', 'no-store');
    const attempt = await startAdaptiveAttempt(req.actor, {
      skill,
      maxItems: req.body?.maxItems,
      forceNew,
    });
    res.status(attempt?.resumed ? 200 : 201).json({ success: true, attempt });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
        reason: err.reason || null,
        remediation: err.remediation || null,
        practiceLinks: err.practiceLinks || null,
      });
    }
    next(err);
  }
});

router.post('/adaptive/:attemptId/abandon', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const result = await abandonAdaptiveAttempt(req.params.attemptId, req.actor.id);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/adaptive/:attemptId/answer', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const result = await answerAdaptive(req.params.attemptId, req.actor.id, {
      questionId: req.body?.questionId,
      optionIndex: req.body?.optionIndex,
      timeSpentMs: req.body?.timeSpentMs,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.get('/ability', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const ability = await getAbility(req.actor.id, req.query?.skill || 'global');
    res.json({ success: true, ability });
  } catch (err) {
    next(err);
  }
});

router.get('/statistics/me', requireActor, optionalAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { resolveActorScope } = await import('../services/quotaService.js');
    const scope = await resolveActorScope(req.actor.id, req.user?.id || null);
    const statistics = await getQuizStatistics(scope);
    res.json({ success: true, statistics });
  } catch (err) {
    next(err);
  }
});

router.post('/privacy/consent', requireActor, async (req, res, next) => {
  try {
    const result = await setAgeConsent(req.actor.id, {
      consent: Boolean(req.body?.consent),
      ageYears: req.body?.ageYears,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.delete('/privacy/me', requireActor, async (req, res, next) => {
  try {
    await deleteActorData(req.actor.id);
    res.json({ success: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/privacy/cleanup-events', requireImportKey, async (req, res, next) => {
  try {
    const days = Number(req.body?.days) || 180;
    const result = await cleanupOldEvents(days);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/attempts', requireActor, async (req, res, next) => {
  try {
    const detailed = String(req.query?.detailed || '') === '1';
    const attempts = detailed
      ? await listAttemptsForActorDetailed(req.actor.id, req.query?.limit)
      : await listAttemptsForActor(req.actor.id, req.query?.limit);
    res.json({ success: true, attempts });
  } catch (err) {
    next(err);
  }
});

router.get('/attempts/:attemptId', requireActor, async (req, res, next) => {
  try {
    const state = await resumeAttempt(req.params.attemptId, req.actor.id);
    if (!state) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, attempt: state });
  } catch (err) {
    next(err);
  }
});

router.get('/attempts/:attemptId/result', requireActor, async (req, res, next) => {
  try {
    const result = await getAttemptResult(req.params.attemptId, req.actor.id);
    if (!result) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.get('/attempts/:attemptId/review-status', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const status = await getAttemptReviewStatus(req.params.attemptId, req.actor.id);
    if (!status) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, ...status });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/attempts/:attemptId/unlock-review', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const result = await unlockAttemptReview(req.params.attemptId, req.actor.id);
    if (!result) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
        cost: err.cost,
        balance: err.balance,
        needed: err.needed,
      });
    }
    next(err);
  }
});

router.get('/attempts/:attemptId/review', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const scope = String(req.query?.scope || 'full').toLowerCase() === 'mistakes' ? 'mistakes' : 'full';
    const review = await getAttemptReview(req.params.attemptId, req.actor.id, { scope });
    if (!review) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, ...review });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
        cost: err.cost,
        balance: err.balance,
      });
    }
    next(err);
  }
});

router.post('/products/answer-review/waitlist', requireActor, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    await recordEvent(req.actor.id, 'answer_review_waitlist', {
      attemptId: req.body?.attemptId || null,
      payload: { product: 'answer_review' },
    });
    res.status(201).json({
      success: true,
      product: 'answer_review',
      status: 'waitlisted',
      message: 'Kútiw dizimine qosıldı. Tólem ashılǵanda xabar beremiz.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/attempts/:attemptId/view', requireActor, async (req, res, next) => {
  try {
    const state = await viewQuestion(
      req.params.attemptId,
      req.actor.id,
      req.body?.position ?? req.query?.position
    );
    if (!state) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, attempt: state });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/attempts/:attemptId/answer', requireActor, async (req, res, next) => {
  try {
    const state = await answerQuestion(req.params.attemptId, req.actor.id, {
      questionId: req.body?.questionId,
      optionIndex: req.body?.optionIndex,
      timeSpentMs: req.body?.timeSpentMs,
    });
    if (!state) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    const { lastAnswer, ...attempt } = state;
    res.json({ success: true, attempt, lastAnswer: lastAnswer || null });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.post('/attempts/:attemptId/finalize', requireActor, async (req, res, next) => {
  try {
    const result = await finalizeAttempt(req.params.attemptId, req.actor.id, {
      partial: Boolean(req.body?.partial),
    });
    if (!result) return res.status(404).json({ success: false, message: 'Urınıw tabılmadı' });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.get('/:id/active', requireActor, async (req, res, next) => {
  try {
    const attemptId = await findActiveAttempt(req.actor.id, req.params.id);
    if (!attemptId) return res.json({ success: true, attemptId: null });
    const state = await resumeAttempt(attemptId, req.actor.id);
    res.json({ success: true, attemptId, attempt: state });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/start', requireActor, optionalAuth, async (req, res, next) => {
  try {
    await assertCanStartQuiz(req.actor.id, { isAuthenticated: Boolean(req.user) });
    const state = await startAttempt(req.params.id, req.actor, {
      ageConsent: Boolean(req.body?.ageConsent),
      ageYears: req.body?.ageYears,
    });
    if (!state) return res.status(404).json({ success: false, message: 'Test tabılmadı' });
    res.status(201).json({ success: true, attempt: state });
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

router.get('/:id', optionalActor, async (req, res, next) => {
  try {
    const quiz = await getQuizPublic(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Test tabılmadı' });
    res.json({ success: true, quiz });
  } catch (err) {
    next(err);
  }
});

export default router;
