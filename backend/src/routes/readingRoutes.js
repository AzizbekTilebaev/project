import { Router } from 'express';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import { requireActor } from '../middleware/actor.js';
import {
  answerReadingQuestion,
  completeReadingSession,
  createReadingSession,
  deleteAdminLesson,
  generateAdminLesson,
  getLessonPreview,
  getReadingProgress,
  getReadingSession,
  listAdminBookSections,
  listAdminLessons,
  listReadingLessonSrs,
  saveAdminLesson,
} from '../services/readingService.js';

const router = Router();
const canManageLessons = requirePermission(PERMISSIONS.MANAGE_LESSONS);

function endpoint(handler) {
  return async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      await handler(req, res);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  };
}

router.get(
  '/books/:bookId/sections/:sectionIndex/lesson',
  endpoint(async (req, res) => {
    const lesson = await getLessonPreview(req.params.bookId, req.params.sectionIndex);
    res.json({ success: true, lesson });
  })
);

router.post(
  '/sessions',
  requireActor,
  endpoint(async (req, res) => {
    const session = await createReadingSession(req.actor.id, req.body || {});
    res.status(201).json({ success: true, session });
  })
);

router.get(
  '/sessions/:id',
  requireActor,
  endpoint(async (req, res) => {
    const session = await getReadingSession(req.actor.id, req.params.id);
    res.json({ success: true, session });
  })
);

router.post(
  '/sessions/:id/answer',
  requireActor,
  endpoint(async (req, res) => {
    const result = await answerReadingQuestion(req.actor.id, req.params.id, req.body || {});
    res.json({ success: true, ...result });
  })
);

router.post(
  '/sessions/:id/complete',
  requireActor,
  endpoint(async (req, res) => {
    const result = await completeReadingSession(req.actor.id, req.params.id);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/progress/me',
  requireActor,
  endpoint(async (req, res) => {
    const progress = await getReadingProgress(req.actor.id);
    res.json({ success: true, progress });
  })
);

router.get(
  '/srs/me',
  requireActor,
  endpoint(async (req, res) => {
    const entries = await listReadingLessonSrs(req.actor.id);
    res.json({ success: true, entries });
  })
);

router.get(
  '/admin/lessons',
  canManageLessons,
  endpoint(async (_req, res) => {
    const lessons = await listAdminLessons();
    res.json({ success: true, lessons });
  })
);

router.get(
  '/admin/lessons/sections',
  canManageLessons,
  endpoint(async (req, res) => {
    const data = await listAdminBookSections(req.query.bookId || req.query.book_id);
    res.json({ success: true, ...data });
  })
);

router.post(
  '/admin/lessons/generate',
  canManageLessons,
  endpoint(async (req, res) => {
    const lesson = await generateAdminLesson({
      bookId: req.body?.bookId ?? req.body?.book_id,
      sectionIndex: req.body?.sectionIndex ?? req.body?.section_index ?? 0,
      force: req.body?.force === true || req.body?.force === 1 || req.body?.force === '1',
    });
    res.json({ success: true, lesson });
  })
);

router.post(
  '/admin/lessons',
  canManageLessons,
  endpoint(async (req, res) => {
    const lesson = await saveAdminLesson(req.body || {});
    res.status(201).json({ success: true, lesson });
  })
);

router.put(
  '/admin/lessons/:id',
  canManageLessons,
  endpoint(async (req, res) => {
    const lesson = await saveAdminLesson({ ...req.body, id: req.params.id });
    res.json({ success: true, lesson });
  })
);

router.delete(
  '/admin/lessons/:id',
  canManageLessons,
  endpoint(async (req, res) => {
    const lesson = await deleteAdminLesson(req.params.id);
    res.json({ success: true, lesson });
  })
);

export default router;
