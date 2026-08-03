import { Server } from 'socket.io';
import { isValidAnonymousId, hashAnonymousId } from '../utils/actorHash.js';
import { ensureActor } from '../services/actorService.js';
import * as rooms from '../services/gameRoomService.js';
import { tickSyncRooms } from '../services/quizRoomService.js';
import { pools } from '../config/db.js';

const db = pools.quiz;

/** @type {import('socket.io').Server | null} */
let io = null;

const actionBuckets = new Map();

function rateOk(key, max = 40, windowMs = 60_000) {
  const now = Date.now();
  let bucket = actionBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    actionBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= max;
}

async function actorFromHandshake(socket) {
  const raw =
    socket.handshake.auth?.anonymousId ||
    socket.handshake.headers['x-anonymous-id'] ||
    null;
  if (!raw || !isValidAnonymousId(String(raw))) {
    throw Object.assign(new Error('X-Anonymous-Id kerek'), { statusCode: 400 });
  }
  const actorKey = hashAnonymousId(String(raw).trim());
  const actor = await ensureActor(actorKey);
  return { id: actor.id, key: actorKey };
}

export function getIo() {
  return io;
}

export async function broadcastRoom(code) {
  if (!io) return null;
  const upper = String(code || '').toUpperCase();
  const sockets = await io.in(`room:${upper}`).fetchSockets();
  if (!sockets.length) {
    return rooms.getRoomPublic(upper);
  }
  let last = null;
  for (const s of sockets) {
    const actorId = s.data.actor?.id || null;
    const state = await rooms.getRoomPublic(upper, actorId);
    if (state) {
      s.emit('room:state', state);
      last = state;
    }
  }
  return last;
}

export function attachGameSocket(httpServer, { allowedOrigins = [] } = {}) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error('CORS'));
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      socket.data.actor = await actorFromHandshake(socket);
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const actorId = socket.data.actor.id;

    socket.on('room:subscribe', async (payload, ack) => {
      try {
        if (!rateOk(`sub:${actorId}`)) throw new Error('Júdá kóp soraw');
        const code = String(payload?.code || '').toUpperCase();
        const state = await rooms.getRoomPublic(code, actorId);
        if (!state) throw new Error('Xona tabılmadı');
        const member = await rooms.findMemberByActor(state.id, actorId);
        if (!member) throw new Error('Aldın xonaǵa qosılıń');
        socket.data.roomCode = code;
        socket.join(`room:${code}`);
        await rooms.setConnected({ roomId: state.id, actorId, connected: true });
        await broadcastRoom(code);
        const fresh = await rooms.getRoomPublic(code, actorId);
        if (typeof ack === 'function') ack({ ok: true, room: fresh });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('room:ready', async (payload, ack) => {
      try {
        if (!rateOk(`ready:${actorId}`)) throw new Error('Júdá kóp soraw');
        const code = String(payload?.code || socket.data.roomCode || '').toUpperCase();
        const fresh = await rooms.setReady({
          code,
          actorId,
          ready: Boolean(payload?.ready),
        });
        await broadcastRoom(code);
        const personalized = await rooms.getRoomPublic(code, actorId);
        if (typeof ack === 'function') ack({ ok: true, room: personalized || fresh });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('room:unsubscribe', async (payload, ack) => {
      try {
        const code = String(payload?.code || socket.data.roomCode || '').toUpperCase();
        if (code) {
          socket.leave(`room:${code}`);
          if (socket.data.roomCode === code) socket.data.roomCode = null;
        }
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('room:leave', async (payload, ack) => {
      try {
        const code = String(payload?.code || socket.data.roomCode || '').toUpperCase();
        const fresh = await rooms.leaveRoom({ code, actorId });
        socket.leave(`room:${code}`);
        socket.data.roomCode = null;
        if (fresh) await broadcastRoom(code);
        else io.to(`room:${code}`).emit('room:closed', { code });
        if (typeof ack === 'function') ack({ ok: true, room: fresh });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const code = socket.data.roomCode;
        if (!code) return;
        const state = await rooms.getRoomPublic(code);
        if (!state) return;
        await rooms.setConnected({ roomId: state.id, actorId, connected: false });
        await broadcastRoom(code);
      } catch {
        /* ignore */
      }
    });
  });

  const timer = setInterval(() => {
    rooms.cleanupExpiredRooms().catch(() => {});
  }, 5 * 60 * 1000);
  timer.unref?.();

  const syncTimer = setInterval(() => {
    tickSyncRooms()
      .then(async () => {
        const [rows] = await db.query(
          `SELECT code FROM game_rooms WHERE game_type='quiz' AND mode='sync' AND status='in_progress'`
        );
        for (const r of rows) await broadcastRoom(r.code);
      })
      .catch(() => {});
  }, 2000);
  syncTimer.unref?.();

  return io;
}
