import { Router } from 'express';
import { requireActor } from '../middleware/actor.js';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import {
  createJumbaqAdmin,
  deleteJumbaqAdmin,
  getDailyJumbaq,
  getJumbaqById,
  getProgressMap,
  getRandomJumbaq,
  guessJumbaq,
  listCategories,
  listJumbaqlar,
  listJumbaqlarAdmin,
  revealJumbaq,
  updateJumbaqAdmin,
  upsertProgress,
} from '../services/jumbaqService.js';

const router = Router();
const canManageJumbaqlar = requirePermission(PERMISSIONS.MANAGE_JUMBAQLAR);

function endpoint(handler, { cache = false } = {}) {
  return async (req, res, next) => {
    try {
      res.set('Cache-Control', cache ? 'public, max-age=60' : 'no-store');
      await handler(req, res);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  };
}

router.get(
  '/',
  endpoint(async (req, res) => {
    const data = await listJumbaqlar({
      q: req.query.q,
      topar: req.query.topar,
      utopar: req.query.utopar,
      script: req.query.script,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...data });
  }, { cache: true })
);

router.get(
  '/categories',
  endpoint(async (req, res) => {
    const data = await listCategories({ script: req.query.script });
    res.json({ success: true, ...data });
  }, { cache: true })
);

router.get(
  '/random',
  endpoint(async (req, res) => {
    const jumbaq = await getRandomJumbaq({
      script: req.query.script,
      topar: req.query.topar,
      utopar: req.query.utopar,
    });
    res.json({ success: true, jumbaq, item: jumbaq });
  })
);

router.get(
  '/daily',
  endpoint(async (req, res) => {
    const jumbaq = await getDailyJumbaq({
      script: req.query.script,
      date: req.query.date,
    });
    res.json({ success: true, jumbaq, item: jumbaq });
  }, { cache: true })
);

router.get(
  '/progress/me',
  requireActor,
  endpoint(async (req, res) => {
    const data = await getProgressMap(req.actor.id);
    res.json({ success: true, ...data });
  })
);

router.get(
  '/admin/list',
  canManageJumbaqlar,
  endpoint(async (req, res) => {
    const data = await listJumbaqlarAdmin({
      q: req.query.q,
      status: req.query.status || '',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...data });
  })
);

router.post(
  '/admin',
  canManageJumbaqlar,
  endpoint(async (req, res) => {
    const jumbaq = await createJumbaqAdmin(req.body || {});
    res.status(201).json({ success: true, jumbaq });
  })
);

router.put(
  '/admin/:id',
  canManageJumbaqlar,
  endpoint(async (req, res) => {
    const jumbaq = await updateJumbaqAdmin(req.params.id, req.body || {});
    res.json({ success: true, jumbaq });
  })
);

router.delete(
  '/admin/:id',
  canManageJumbaqlar,
  endpoint(async (req, res) => {
    const result = await deleteJumbaqAdmin(req.params.id);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/:id',
  endpoint(async (req, res) => {
    const jumbaq = await getJumbaqById(req.params.id, {
      script: req.query.script,
    });
    res.json({ success: true, jumbaq, item: jumbaq });
  }, { cache: true })
);

router.put(
  '/:id/progress',
  requireActor,
  endpoint(async (req, res) => {
    const progress = await upsertProgress(req.actor.id, req.params.id, req.body || {});
    res.json({ success: true, progress });
  })
);

router.post(
  '/:id/guess',
  requireActor,
  endpoint(async (req, res) => {
    const result = await guessJumbaq(req.actor.id, req.params.id, {
      answer: req.body?.answer,
      script: req.body?.script ?? req.query?.script,
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  '/:id/reveal',
  requireActor,
  endpoint(async (req, res) => {
    const result = await revealJumbaq(req.actor.id, req.params.id, {
      script: req.body?.script ?? req.query?.script,
    });
    res.json({ success: true, ...result });
  })
);

export default router;
