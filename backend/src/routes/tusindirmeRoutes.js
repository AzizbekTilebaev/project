import express from 'express';
import TusindirmeController from '../controllers/tusindirmeController.js';
import {
  requireImportKey,
  searchLimiter,
  dictBrowseLimiter,
  importLimiter,
  suggestLimiter,
  voteLimiter,
  actorWriteLimiter,
} from '../middleware/security.js';
import { requireActor, optionalActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  assertCanViewWord,
  incrementWordViews,
  buildQuotaStatus,
  getActorQuotaRow,
} from '../services/quotaService.js';
import { recordEvent } from '../services/actorService.js';
import { resolveAdmin, roleHasPermission, PERMISSIONS } from '../middleware/rbac.js';

const router = express.Router();
const controller = new TusindirmeController();

/** Moderatsiya: admin (moderator/editor/owner roli) YOKI import kaliti. */
function requireModerator(req, res, next) {
  const admin = resolveAdmin(req);
  if (admin && roleHasPermission(admin.role, PERMISSIONS.MODERATE_COMMUNITY)) {
    req.admin = admin;
    return next();
  }
  return requireImportKey(req, res, next);
}
const cacheFor = (seconds) => (_req, res, next) => {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
  next();
};

/** Mehmon so‘z limiti — kontentdan OLDIN. Auth bo‘lsa cheksiz. */
async function enforceWordQuota(req, res, next) {
  try {
    const isAuthenticated = Boolean(req.user);
    await assertCanViewWord(req.actor.id, { isAuthenticated });
    if (!isAuthenticated) {
      req.wordQuota = await incrementWordViews(req.actor.id);
      await recordEvent(req.actor.id, 'word_viewed', {
        payload: { product: 'dictionary' },
      }).catch(() => {});
    } else {
      const row = await getActorQuotaRow(req.actor.id);
      req.wordQuota = buildQuotaStatus(row, { isAuthenticated: true });
    }
    next();
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code || 'GUEST_WORD_LIMIT',
      });
    }
    next(err);
  }
}

router.get('/sozler', dictBrowseLimiter, controller.getAllSozler);
router.get('/curated', cacheFor(300), controller.getCurated);
router.get('/search', searchLimiter, controller.searchSoz);
router.get('/letter/:letter', dictBrowseLimiter, controller.getSozlerByLetter);
router.get('/soz/:id', requireActor, optionalAuth, enforceWordQuota, controller.getSozById);
router.get('/alphabet', cacheFor(60), controller.getAlphabet);
router.get('/pos', cacheFor(300), controller.getPosList);
router.get('/themes', cacheFor(300), controller.getThemeList);
router.get('/dashboard', cacheFor(60), controller.getDashboard);
router.get('/random', dictBrowseLimiter, controller.getRandomSoz);
router.get('/word-of-day', cacheFor(3600), controller.getWordOfDay);
router.get('/word-of-day/checkin', requireActor, optionalAuth, controller.getWordOfDayCheckin);
router.post(
  '/word-of-day/checkin',
  requireActor,
  optionalAuth,
  actorWriteLimiter,
  controller.claimWordOfDayCheckin
);
router.post(
  '/word-of-day/chest/claim',
  requireActor,
  actorWriteLimiter,
  controller.claimComboChest
);
router.get('/quiz', requireActor, controller.getQuiz);
router.post('/quiz/start', requireActor, controller.startDictQuiz);
router.get('/quiz/history', requireActor, controller.dictQuizHistory);
router.post('/quiz/:roundId/check', requireActor, controller.checkDictQuiz);
router.post('/quiz/:roundId/answer', requireActor, controller.answerDictQuiz);
router.get('/top', cacheFor(60), controller.getTopSozler);

router.get('/suggestions', optionalActor, controller.listSuggestions);
router.get('/suggestions/mine', requireActor, controller.listMySuggestions);
router.get(
  '/suggestions/moderation',
  requireModerator,
  controller.listModeratorSuggestions
);
router.post(
  '/suggestions',
  suggestLimiter,
  actorWriteLimiter,
  requireActor,
  controller.createSuggestion
);
router.post(
  '/suggestions/:id/vote',
  voteLimiter,
  actorWriteLimiter,
  requireActor,
  controller.voteSuggestion
);
router.post(
  '/suggestions/:id/moderate',
  importLimiter,
  requireModerator,
  controller.moderateSuggestion
);

router.get('/ghost-titles', requireModerator, controller.listGhostTitles);
router.post(
  '/ghost-titles/activate',
  importLimiter,
  requireModerator,
  controller.activateGhostTitles
);
router.patch(
  '/description/:id',
  importLimiter,
  requireModerator,
  controller.updateDescription
);
router.delete(
  '/description/:id',
  importLimiter,
  requireModerator,
  controller.deleteDescription
);
router.post(
  '/title/:id/descriptions',
  importLimiter,
  requireModerator,
  controller.createDescription
);
router.post(
  '/titles',
  importLimiter,
  requireModerator,
  controller.createTitle
);
router.patch(
  '/title/:id',
  importLimiter,
  requireModerator,
  controller.renameTitle
);
router.delete(
  '/title/:id',
  importLimiter,
  requireModerator,
  controller.deactivateTitle
);
router.post(
  '/title/:id/activate',
  importLimiter,
  requireModerator,
  controller.reactivateTitle
);
router.patch(
  '/example/:id',
  importLimiter,
  requireModerator,
  controller.updateExample
);
router.delete(
  '/example/:id',
  importLimiter,
  requireModerator,
  controller.deleteExample
);
router.post(
  '/description/:id/examples',
  importLimiter,
  requireModerator,
  controller.createExample
);
router.patch(
  '/idiom/:id',
  importLimiter,
  requireModerator,
  controller.updateIdiom
);
router.delete(
  '/idiom/:id',
  importLimiter,
  requireModerator,
  controller.deleteIdiom
);
router.post(
  '/description/:id/idioms',
  importLimiter,
  requireModerator,
  controller.createIdiom
);
router.patch(
  '/idiom-desc/:id',
  importLimiter,
  requireModerator,
  controller.updateIdiomDesc
);

router.post('/relations/sense/synonym', importLimiter, requireModerator, controller.addSenseSynonym);
router.delete(
  '/relations/sense/synonym',
  importLimiter,
  requireModerator,
  controller.removeSenseSynonym
);
router.post('/relations/sense/antonym', importLimiter, requireModerator, controller.addSenseAntonym);
router.delete(
  '/relations/sense/antonym',
  importLimiter,
  requireModerator,
  controller.removeSenseAntonym
);
router.post('/compounds', importLimiter, requireModerator, controller.addCompound);
router.delete('/compounds/:id', importLimiter, requireModerator, controller.removeCompound);
router.post('/relations/word', importLimiter, requireModerator, controller.addWordRelation);
router.delete('/relations/word/:id', importLimiter, requireModerator, controller.removeWordRelation);

// Yozish: faqat IMPORT_API_KEY + rate limit (oddiy CLI prefer qilinadi)
router.post('/import-nested', importLimiter, requireImportKey, controller.importNested);

export default router;
