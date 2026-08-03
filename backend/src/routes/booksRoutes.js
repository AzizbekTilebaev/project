import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import { requireActor } from '../middleware/actor.js';
import { bookUpload, verifyUploadedBookFile } from '../middleware/bookUpload.js';
import * as ctrl from '../controllers/booksController.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Kiriw limiti. Keyinirek urınıń.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Júklew limiti. Keyinirek urınıń.' },
});

function handleMulter(req, res, next) {
  bookUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Fayl júdá úlken. Maksimum shegara asıldı.',
        });
      }
      return res.status(err.statusCode || 400).json({
        success: false,
        error: err.message || 'Fayldı júklew qáteligi',
      });
    }
    if (!req.file?.path) return next();
    try {
      const kind = verifyUploadedBookFile(req.file.path);
      const claimExt = path.extname(req.file.originalname || req.file.filename || '').toLowerCase();
      if (!kind) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: 'Fayl mazmunı jaramlı emes (PDF/DOC/DOCX)' });
      }
      if (claimExt && claimExt !== kind.ext) {
        const ok =
          (claimExt === '.pdf' && kind.ext === '.pdf') ||
          (claimExt === '.doc' && kind.ext === '.doc') ||
          (claimExt === '.docx' && kind.ext === '.docx');
        if (!ok) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            error: 'Fayl keńeytmesi mazmunına tuwra kelmeydi',
          });
        }
      }
      req.file.mimetype = kind.mime;
      return next();
    } catch {
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return res.status(400).json({ success: false, error: 'Fayl tekseriw qáteligi' });
    }
  });
}

router.post('/admin/login', loginLimiter, ctrl.adminLogin);

const canManageBooks = requirePermission(PERMISSIONS.MANAGE_BOOKS);
router.get('/admin/list', canManageBooks, ctrl.adminList);
router.get('/admin/:id', canManageBooks, ctrl.adminGetOne);

router.get('/', ctrl.list);
router.get('/progress/me', requireActor, ctrl.listMyProgress);
router.get('/:id', ctrl.getOne);
router.get('/:id/file', ctrl.streamFile);
router.get('/:id/progress', requireActor, ctrl.getProgress);
router.put('/:id/progress', requireActor, ctrl.saveProgress);

router.post('/', canManageBooks, uploadLimiter, handleMulter, ctrl.create);
router.put('/:id', canManageBooks, uploadLimiter, handleMulter, ctrl.update);
router.post('/:id/hide', canManageBooks, ctrl.hide);
router.post('/:id/restore', canManageBooks, ctrl.restore);
router.post('/:id/writers', canManageBooks, ctrl.linkWriter);
router.delete('/:id/writers/:writerId', canManageBooks, ctrl.unlinkWriter);
router.delete('/:id', canManageBooks, uploadLimiter, ctrl.remove);

export default router;
