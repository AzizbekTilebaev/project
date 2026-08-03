import crypto from 'crypto';
import { pools } from '../config/db.js';

const db = pools.quiz;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const LOBBY_IDLE_MS = 45 * 60 * 1000;

export const GAME_TYPES = new Set(['quiz', 'crossword']);
export const QUIZ_MODES = new Set(['sync', 'race']);
export const CROSSWORD_MODES = new Set(['coop', 'competitive']);

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeDisplayName(raw) {
  const name = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 24);
  if (!name) return 'Oyınshı';
  return name;
}

function generateCode(len = 6) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function publicMember(row) {
  return {
    memberId: row.id,
    displayName: row.display_name,
    role: row.role,
    ready: Boolean(row.ready),
    connected: Boolean(row.connected),
    score: row.score != null ? Number(row.score) : null,
    finishedAt: row.finished_at || null,
    attemptId: row.attempt_id || null,
    progress: row.progress_json
      ? typeof row.progress_json === 'string'
        ? JSON.parse(row.progress_json)
        : row.progress_json
      : null,
  };
}

function publicRoom(row, members = [], viewerActorId = null) {
  const mapped = members.map(publicMember);
  const you =
    viewerActorId != null
      ? members.find((m) => Number(m.actor_id) === Number(viewerActorId))
      : null;
  return {
    id: row.id,
    code: row.code,
    gameType: row.game_type,
    mode: row.mode,
    contentId: row.content_id,
    status: row.status,
    maxPlayers: Number(row.max_players),
    minPlayers: Number(row.min_players),
    hostMemberId: mapped.find((m) => m.role === 'host')?.memberId || null,
    youMemberId: you ? you.id : null,
    sharedState: row.shared_state_json
      ? typeof row.shared_state_json === 'string'
        ? JSON.parse(row.shared_state_json)
        : row.shared_state_json
      : null,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    expiresAt: row.expires_at,
    members: mapped,
  };
}

export async function loadMembers(roomId) {
  const [rows] = await db.query(
    `SELECT id, room_id, actor_id, display_name, role, ready, connected,
            attempt_id, score, progress_json, finished_at, joined_at, left_at
     FROM game_room_members
     WHERE room_id = ? AND left_at IS NULL
     ORDER BY joined_at ASC`,
    [roomId]
  );
  return rows;
}

async function loadRoomRow(codeOrId, { byId = false } = {}) {
  const [rows] = await db.query(
    byId
      ? `SELECT * FROM game_rooms WHERE id = ? LIMIT 1`
      : `SELECT * FROM game_rooms WHERE code = ? LIMIT 1`,
    [codeOrId]
  );
  return rows[0] || null;
}

export async function getRoomPublic(code, viewerActorId = null) {
  const room = await loadRoomRow(String(code || '').toUpperCase());
  if (!room) return null;
  if (room.expires_at && new Date(room.expires_at).getTime() < Date.now()) {
    if (room.status === 'lobby') {
      await db.query(`UPDATE game_rooms SET status = 'cancelled' WHERE id = ?`, [room.id]);
      room.status = 'cancelled';
    }
  }
  const members = await loadMembers(room.id);
  return publicRoom(room, members, viewerActorId);
}

export async function getRoomById(roomId) {
  const room = await loadRoomRow(roomId, { byId: true });
  if (!room) return null;
  const members = await loadMembers(room.id);
  return { row: room, members, public: publicRoom(room, members) };
}

/** Ashıq lobbylar — discover / bir basım qosılıw. */
export async function listOpenLobbies({ gameType = null, limit = 20 } = {}) {
  await cleanupExpiredRooms().catch(() => {});
  const lim = Math.min(40, Math.max(1, Number(limit) || 20));
  const params = [];
  let typeFilter = '';
  if (gameType && GAME_TYPES.has(String(gameType))) {
    typeFilter = ' AND r.game_type = ?';
    params.push(String(gameType));
  }

  const [rows] = await db.query(
    `SELECT
        r.code,
        r.game_type AS gameType,
        r.mode,
        r.content_id AS contentId,
        r.max_players AS maxPlayers,
        r.min_players AS minPlayers,
        r.created_at AS createdAt,
        (SELECT COUNT(*) FROM game_room_members m
          WHERE m.room_id = r.id AND m.left_at IS NULL) AS memberCount,
        (SELECT m2.display_name FROM game_room_members m2
          WHERE m2.room_id = r.id AND m2.left_at IS NULL AND m2.role = 'host'
          LIMIT 1) AS hostName
     FROM game_rooms r
     WHERE r.status = 'lobby'
       AND (r.expires_at IS NULL OR r.expires_at > CURRENT_TIMESTAMP)
       ${typeFilter}
       AND (
         SELECT COUNT(*) FROM game_room_members m
         WHERE m.room_id = r.id AND m.left_at IS NULL
       ) < r.max_players
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [...params, lim]
  );

  return (rows || []).map((r) => {
    const memberCount = Number(r.memberCount) || 0;
    const maxPlayers = Number(r.maxPlayers) || MAX_PLAYERS;
    return {
      code: r.code,
      gameType: r.gameType,
      mode: r.mode,
      contentId: r.contentId,
      maxPlayers,
      minPlayers: Number(r.minPlayers) || MIN_PLAYERS,
      memberCount,
      seatsLeft: Math.max(0, maxPlayers - memberCount),
      hostName: r.hostName || null,
      createdAt: r.createdAt,
    };
  });
}

export async function createRoom({
  actorId,
  gameType,
  mode,
  contentId,
  displayName,
  maxPlayers = 4,
}) {
  if (!GAME_TYPES.has(gameType)) throw httpError('Oyın túri qáte');
  if (gameType === 'quiz' && !QUIZ_MODES.has(mode)) throw httpError('Quiz rejimi qáte');
  if (gameType === 'crossword' && !CROSSWORD_MODES.has(mode)) {
    throw httpError('Krossvord rejimi qáte');
  }
  const content = String(contentId || '').trim();
  if (!content) throw httpError('Kontent ID kerek');

  const seats = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number(maxPlayers) || 4));
  const name = normalizeDisplayName(displayName);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ROOM_TTL_MS);

  let code = null;
  for (let i = 0; i < 12; i++) {
    const candidate = generateCode(6);
    try {
      await db.query(
        `INSERT INTO game_rooms
         (id, code, game_type, mode, content_id, host_actor_id, status,
          max_players, min_players, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'lobby', ?, ?, ?)`,
        [id, candidate, gameType, mode, content, actorId, seats, MIN_PLAYERS, expiresAt]
      );
      code = candidate;
      break;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
  if (!code) throw httpError('Kod jaratıw múmkin bolmadı', 500);

  const memberId = crypto.randomUUID();
  await db.query(
    `INSERT INTO game_room_members
     (id, room_id, actor_id, display_name, role, ready, connected)
     VALUES (?, ?, ?, ?, 'host', 0, 1)`,
    [memberId, id, actorId, name]
  );

  return getRoomPublic(code, actorId);
}

export async function joinRoom({ code, actorId, displayName }) {
  const room = await loadRoomRow(String(code || '').toUpperCase());
  if (!room) throw httpError('Xona tabılmadı', 404);
  if (room.status !== 'lobby') throw httpError('Xonaǵa qosılıw múmkin emes', 409);
  if (room.expires_at && new Date(room.expires_at).getTime() < Date.now()) {
    throw httpError('Xona muddeti tamam', 410);
  }

  const members = await loadMembers(room.id);
  const existing = members.find((m) => Number(m.actor_id) === Number(actorId));
  if (existing) {
    await db.query(
      `UPDATE game_room_members SET connected = 1, display_name = ?, left_at = NULL
       WHERE id = ?`,
      [normalizeDisplayName(displayName) || existing.display_name, existing.id]
    );
    return getRoomPublic(room.code, actorId);
  }
  if (members.length >= Number(room.max_players)) {
    throw httpError('Xona tolıq (maks 4)', 409);
  }

  const memberId = crypto.randomUUID();
  await db.query(
    `INSERT INTO game_room_members
     (id, room_id, actor_id, display_name, role, ready, connected)
     VALUES (?, ?, ?, ?, 'player', 0, 1)`,
    [memberId, room.id, actorId, normalizeDisplayName(displayName)]
  );
  return getRoomPublic(room.code, actorId);
}

export async function setReady({ code, actorId, ready }) {
  const room = await loadRoomRow(String(code || '').toUpperCase());
  if (!room) throw httpError('Xona tabılmadı', 404);
  if (room.status !== 'lobby') throw httpError('Tek lobbyda tayarlanıw múmkin', 409);
  const [result] = await db.query(
    `UPDATE game_room_members SET ready = ?
     WHERE room_id = ? AND actor_id = ? AND left_at IS NULL`,
    [ready ? 1 : 0, room.id, actorId]
  );
  if (!result.affectedRows) throw httpError('Aǵza tabılmadı', 404);
  return getRoomPublic(room.code, actorId);
}

export async function leaveRoom({ code, actorId }) {
  const room = await loadRoomRow(String(code || '').toUpperCase());
  if (!room) throw httpError('Xona tabılmadı', 404);
  const members = await loadMembers(room.id);
  const me = members.find((m) => Number(m.actor_id) === Number(actorId));
  if (!me) return getRoomPublic(room.code, actorId);

  await db.query(
    `UPDATE game_room_members SET left_at = CURRENT_TIMESTAMP, connected = 0, ready = 0
     WHERE id = ?`,
    [me.id]
  );

  const remaining = members.filter((m) => m.id !== me.id);
  if (!remaining.length) {
    await db.query(`UPDATE game_rooms SET status = 'cancelled' WHERE id = ?`, [room.id]);
    return null;
  }

  if (me.role === 'host') {
    const next = remaining[0];
    await db.query(`UPDATE game_room_members SET role = 'host' WHERE id = ?`, [next.id]);
    await db.query(`UPDATE game_rooms SET host_actor_id = ? WHERE id = ?`, [
      next.actor_id,
      room.id,
    ]);
  }
  return getRoomPublic(room.code, actorId);
}

export async function setConnected({ roomId, actorId, connected }) {
  await db.query(
    `UPDATE game_room_members SET connected = ?
     WHERE room_id = ? AND actor_id = ? AND left_at IS NULL`,
    [connected ? 1 : 0, roomId, actorId]
  );
}

export async function assertHost(room, actorId) {
  if (Number(room.host_actor_id) !== Number(actorId)) {
    throw httpError('Tek xona iyesı baslay aladı', 403);
  }
}

export async function markRoomStarting(roomId) {
  await db.query(
    `UPDATE game_rooms SET status = 'starting', started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
     WHERE id = ? AND status = 'lobby'`,
    [roomId]
  );
}

export async function markRoomInProgress(roomId, sharedState = null) {
  await db.query(
    `UPDATE game_rooms
     SET status = 'in_progress',
         shared_state_json = ?,
         started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
     WHERE id = ?`,
    [sharedState ? JSON.stringify(sharedState) : null, roomId]
  );
}

export async function markRoomFinished(roomId, sharedState = null) {
  await db.query(
    `UPDATE game_rooms
     SET status = 'finished',
         finished_at = CURRENT_TIMESTAMP,
         shared_state_json = COALESCE(?, shared_state_json)
     WHERE id = ?`,
    [sharedState ? JSON.stringify(sharedState) : null, roomId]
  );
}

export async function updateMemberProgress({
  roomId,
  actorId,
  attemptId = null,
  score = null,
  progress = null,
  finished = false,
}) {
  await db.query(
    `UPDATE game_room_members
     SET attempt_id = COALESCE(?, attempt_id),
         score = COALESCE(?, score),
         progress_json = COALESCE(?, progress_json),
         finished_at = CASE WHEN ? = 1 THEN COALESCE(finished_at, CURRENT_TIMESTAMP) ELSE finished_at END
     WHERE room_id = ? AND actor_id = ? AND left_at IS NULL`,
    [
      attemptId,
      score,
      progress ? JSON.stringify(progress) : null,
      finished ? 1 : 0,
      roomId,
      actorId,
    ]
  );
}

export async function updateSharedState(roomId, sharedState) {
  await db.query(`UPDATE game_rooms SET shared_state_json = ? WHERE id = ?`, [
    JSON.stringify(sharedState),
    roomId,
  ]);
}

export async function findMemberByActor(roomId, actorId) {
  const [rows] = await db.query(
    `SELECT * FROM game_room_members
     WHERE room_id = ? AND actor_id = ? AND left_at IS NULL LIMIT 1`,
    [roomId, actorId]
  );
  return rows[0] || null;
}

export async function canStart(roomPublic) {
  if (roomPublic.status !== 'lobby') return false;
  if (roomPublic.members.length < roomPublic.minPlayers) return false;
  if (roomPublic.members.length > roomPublic.maxPlayers) return false;
  return roomPublic.members.every((m) => m.ready);
}

export async function cleanupExpiredRooms() {
  await db.query(
    `UPDATE game_rooms
     SET status = 'cancelled'
     WHERE status = 'lobby' AND expires_at < CURRENT_TIMESTAMP`
  );
  await db.query(
    `UPDATE game_rooms
     SET status = 'finished', finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP)
     WHERE status IN ('starting','in_progress')
       AND started_at IS NOT NULL
       AND started_at < (CURRENT_TIMESTAMP - INTERVAL 3 HOUR)`
  );
}
