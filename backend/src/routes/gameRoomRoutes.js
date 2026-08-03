import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  assertCanPlayCrossword,
  assertCanStartQuiz,
} from '../services/quotaService.js';
import * as rooms from '../services/gameRoomService.js';
import { broadcastRoom } from '../realtime/gameSocket.js';
import { startQuizRoom, answerInRoom, getMyRoomAttempt } from '../services/quizRoomService.js';
import { startCrosswordRoom, guessCrosswordInRoom } from '../services/crosswordRoomService.js';

const router = Router();

const roomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Xona limiti. Keyinirek urınıń.' },
});

router.use(roomLimiter);

function sendRouteError(res, err) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      message: err.message,
      code: err.code,
    });
  }
  return null;
}

async function assertRoomQuota(req, gameType) {
  const auth = { isAuthenticated: Boolean(req.user) };
  if (gameType === 'quiz') {
    await assertCanStartQuiz(req.actor.id, auth);
  } else if (gameType === 'crossword') {
    await assertCanPlayCrossword(req.actor.id, auth);
  }
}

router.post('/', requireActor, optionalAuth, async (req, res, next) => {
  try {
    await assertRoomQuota(req, req.body?.gameType);
    const room = await rooms.createRoom({
      actorId: req.actor.id,
      gameType: req.body?.gameType,
      mode: req.body?.mode,
      contentId: req.body?.contentId,
      displayName: req.body?.displayName,
      maxPlayers: req.body?.maxPlayers,
    });
    res.status(201).json({ success: true, room });
  } catch (err) {
    if (sendRouteError(res, err)) return;
    next(err);
  }
});

router.post('/join', requireActor, optionalAuth, async (req, res, next) => {
  try {
    const preview = await rooms.getRoomPublic(String(req.body?.code || '').toUpperCase());
    if (!preview) return res.status(404).json({ success: false, error: 'Xona tabılmadı' });
    await assertRoomQuota(req, preview.gameType);
    const room = await rooms.joinRoom({
      code: req.body?.code,
      actorId: req.actor.id,
      displayName: req.body?.displayName,
    });
    await broadcastRoom(room.code);
    res.json({ success: true, room });
  } catch (err) {
    if (sendRouteError(res, err)) return;
    next(err);
  }
});

router.get('/open', requireActor, async (req, res, next) => {
  try {
    const lobbies = await rooms.listOpenLobbies({
      gameType: req.query?.gameType || req.query?.type || null,
      limit: req.query?.limit,
    });
    res.json({ success: true, lobbies, count: lobbies.length });
  } catch (err) {
    next(err);
  }
});

router.get('/:code', requireActor, async (req, res, next) => {
  try {
    const room = await rooms.getRoomPublic(req.params.code, req.actor.id);
    if (!room) return res.status(404).json({ success: false, error: 'Xona tabılmadı' });
    res.json({ success: true, room });
  } catch (err) {
    next(err);
  }
});

router.post('/:code/start', requireActor, optionalAuth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    const existing = await rooms.getRoomPublic(code, req.actor.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Xona tabılmadı' });
    await assertRoomQuota(req, existing.gameType);

    let room;
    if (existing.gameType === 'quiz') {
      room = await startQuizRoom(code, req.actor.id);
    } else if (existing.gameType === 'crossword') {
      room = await startCrosswordRoom(code, req.actor.id);
    } else {
      return res.status(400).json({ success: false, error: 'Belgısız oyın' });
    }
    await broadcastRoom(code);
    res.json({ success: true, room });
  } catch (err) {
    if (sendRouteError(res, err)) return;
    next(err);
  }
});

router.get('/:code/quiz', requireActor, async (req, res, next) => {
  try {
    const data = await getMyRoomAttempt(req.params.code, req.actor.id);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

router.post('/:code/quiz/answer', requireActor, async (req, res, next) => {
  try {
    const data = await answerInRoom(req.params.code, req.actor.id, {
      questionId: req.body?.questionId,
      optionIndex: req.body?.optionIndex,
      timeSpentMs: req.body?.timeSpentMs,
    });
    await broadcastRoom(String(req.params.code).toUpperCase());
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

router.post('/:code/crossword/guess', requireActor, optionalAuth, async (req, res, next) => {
  try {
    await assertCanPlayCrossword(req.actor.id, { isAuthenticated: Boolean(req.user) });
    const data = await guessCrosswordInRoom(req.params.code, req.actor.id, req.body || {});
    await broadcastRoom(String(req.params.code).toUpperCase());
    res.json({ success: true, ...data });
  } catch (err) {
    if (sendRouteError(res, err)) return;
    next(err);
  }
});

router.post('/:code/ready', requireActor, async (req, res, next) => {
  try {
    const room = await rooms.setReady({
      code: req.params.code,
      actorId: req.actor.id,
      ready: Boolean(req.body?.ready),
    });
    await broadcastRoom(room.code);
    res.json({ success: true, room });
  } catch (err) {
    next(err);
  }
});

router.post('/:code/leave', requireActor, async (req, res, next) => {
  try {
    const room = await rooms.leaveRoom({
      code: req.params.code,
      actorId: req.actor.id,
    });
    if (room) await broadcastRoom(room.code);
    res.json({ success: true, room });
  } catch (err) {
    next(err);
  }
});

export default router;
