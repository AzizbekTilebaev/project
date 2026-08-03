import { Router } from 'express';
import { requirePermission, PERMISSIONS } from '../middleware/rbac.js';
import {
  getWorkPieces,
  getWriterBySlug,
  listWorks,
  listWriters,
} from '../services/literatureService.js';
import {
  addWriterPhoto,
  createWriterAdmin,
  deleteCreativeWorkAdmin,
  deleteWriterAdmin,
  deleteWriterPhoto,
  getWriterAdmin,
  listWriterPhotos,
  listWritersAdmin,
  saveCreativeWorkAdmin,
  updateWriterAdmin,
  updateWriterPhoto,
  listPiecesAdmin,
  getPieceAdmin,
  savePieceAdmin,
  hidePieceAdmin,
  restorePieceAdmin,
  deletePieceAdmin,
} from '../services/literatureAdminService.js';
import { handleWriterPhotoMulter } from '../middleware/writerPhotoUpload.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const canManageWriters = requirePermission(PERMISSIONS.MANAGE_WRITERS);
const canManageBooks = requirePermission(PERMISSIONS.MANAGE_BOOKS);
const photoUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rasm júklew limiti asıldı — birazdan keyin qayta urınıń' },
});

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
  '/admin/writers',
  canManageWriters,
  endpoint(async (req, res) => {
    const data = await listWritersAdmin({
      q: req.query.q,
      status: req.query.status || '',
      geocode: req.query.geocode || req.query.geocode_status || '',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...data });
  })
);

router.get(
  '/admin/writers/:id',
  canManageWriters,
  endpoint(async (req, res) => {
    const writer = await getWriterAdmin(req.params.id);
    res.json({ success: true, writer });
  })
);

router.post(
  '/admin/writers',
  canManageWriters,
  endpoint(async (req, res) => {
    const writer = await createWriterAdmin(req.body || {});
    res.status(201).json({ success: true, writer });
  })
);

router.put(
  '/admin/writers/:id',
  canManageWriters,
  endpoint(async (req, res) => {
    const writer = await updateWriterAdmin(req.params.id, req.body || {});
    res.json({ success: true, writer });
  })
);

router.delete(
  '/admin/writers/:id',
  canManageWriters,
  endpoint(async (req, res) => {
    const result = await deleteWriterAdmin(req.params.id);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/admin/writers/:id/works',
  canManageWriters,
  endpoint(async (req, res) => {
    const work = await saveCreativeWorkAdmin(req.params.id, req.body || {});
    res.status(201).json({ success: true, work });
  })
);

router.put(
  '/admin/writers/:id/works/:workId',
  canManageWriters,
  endpoint(async (req, res) => {
    const work = await saveCreativeWorkAdmin(req.params.id, {
      ...(req.body || {}),
      id: req.params.workId,
    });
    res.json({ success: true, work });
  })
);

router.delete(
  '/admin/writers/:id/works/:workId',
  canManageWriters,
  endpoint(async (req, res) => {
    const result = await deleteCreativeWorkAdmin(req.params.id, req.params.workId);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/admin/writers/:id/photos',
  canManageWriters,
  endpoint(async (req, res) => {
    const photos = await listWriterPhotos(req.params.id, { script: 'latin' });
    res.json({ success: true, photos });
  })
);

router.post(
  '/admin/writers/:id/photos',
  canManageWriters,
  photoUploadLimiter,
  handleWriterPhotoMulter,
  endpoint(async (req, res) => {
    const photo = await addWriterPhoto(req.params.id, req.body || {}, req.file || null);
    res.status(201).json({ success: true, photo });
  })
);

router.put(
  '/admin/writers/:id/photos/:photoId',
  canManageWriters,
  endpoint(async (req, res) => {
    const photo = await updateWriterPhoto(req.params.id, req.params.photoId, req.body || {});
    res.json({ success: true, photo });
  })
);

router.delete(
  '/admin/writers/:id/photos/:photoId',
  canManageWriters,
  endpoint(async (req, res) => {
    const result = await deleteWriterPhoto(req.params.id, req.params.photoId);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/admin/pieces',
  canManageBooks,
  endpoint(async (req, res) => {
    const data = await listPiecesAdmin({
      q: req.query.q,
      bookId: req.query.bookId || req.query.book_id,
      writerId: req.query.writerId || req.query.writer_id,
      status: req.query.status || '',
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...data });
  })
);

router.get(
  '/admin/pieces/:id',
  canManageBooks,
  endpoint(async (req, res) => {
    const piece = await getPieceAdmin(req.params.id);
    res.json({ success: true, piece });
  })
);

router.post(
  '/admin/pieces',
  canManageBooks,
  endpoint(async (req, res) => {
    const piece = await savePieceAdmin(req.body || {});
    res.status(201).json({ success: true, piece });
  })
);

router.put(
  '/admin/pieces/:id',
  canManageBooks,
  endpoint(async (req, res) => {
    const piece = await savePieceAdmin({ ...(req.body || {}), id: req.params.id });
    res.json({ success: true, piece });
  })
);

router.post(
  '/admin/pieces/:id/hide',
  canManageBooks,
  endpoint(async (req, res) => {
    const piece = await hidePieceAdmin(req.params.id);
    res.json({ success: true, piece });
  })
);

router.post(
  '/admin/pieces/:id/restore',
  canManageBooks,
  endpoint(async (req, res) => {
    const piece = await restorePieceAdmin(req.params.id);
    res.json({ success: true, piece });
  })
);

router.delete(
  '/admin/pieces/:id',
  canManageBooks,
  endpoint(async (req, res) => {
    const result = await deletePieceAdmin(req.params.id);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/writers',
  endpoint(async (req, res) => {
    const data = await listWriters({
      q: req.query.q,
      letter: req.query.letter,
      works: req.query.works,
      century: req.query.century,
      script: req.query.script,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...data });
  }, { cache: true })
);

router.get(
  '/writers/:slug',
  endpoint(async (req, res) => {
    const data = await getWriterBySlug(req.params.slug, {
      script: req.query.script,
    });
    res.json({ success: true, ...data });
  }, { cache: true })
);

router.get(
  '/works',
  endpoint(async (req, res) => {
    const data = await listWorks({
      q: req.query.q,
      writer: req.query.writer,
      writerId: req.query.writerId,
      bookId: req.query.bookId,
      script: req.query.script,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...data });
  }, { cache: true })
);

router.get(
  '/works/:id/pieces',
  endpoint(async (req, res) => {
    const data = await getWorkPieces(req.params.id, {
      script: req.query.script,
    });
    res.json({ success: true, ...data });
  }, { cache: true })
);

export default router;
