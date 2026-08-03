import crypto from 'crypto';
import { pools, DB } from '../config/db.js';
import * as rooms from './gameRoomService.js';
import { getCrosswordInternal, validateGuess } from './crosswordService.js';

const db = pools.quiz;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function emptyBoard() {
  return {};
}

function applyWord(board, word, answer) {
  const letters = String(answer).toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    const x = word.direction === 'across' ? word.x + i : word.x;
    const y = word.direction === 'across' ? word.y : word.y + i;
    board[`${x}-${y}`] = letters[i];
  }
  return board;
}

function solvedCount(words, board) {
  let n = 0;
  for (const word of words) {
    let ok = true;
    const expected = String(word.answer || '');
    for (let i = 0; i < expected.length; i++) {
      const x = word.direction === 'across' ? word.x + i : word.x;
      const y = word.direction === 'across' ? word.y : word.y + i;
      const cell = String(board[`${x}-${y}`] || '').toUpperCase();
      if (cell !== expected[i].toUpperCase()) {
        ok = false;
        break;
      }
    }
    if (ok) n += 1;
  }
  return n;
}

export async function startCrosswordRoom(code, actorId) {
  const [[roomRow]] = await db.query(`SELECT * FROM game_rooms WHERE code = ? LIMIT 1`, [
    String(code || '').toUpperCase(),
  ]);
  if (!roomRow) throw httpError('Xona tabılmadı', 404);
  if (roomRow.game_type !== 'crossword') throw httpError('Bul krossvord xonası emes');
  await rooms.assertHost(roomRow, actorId);

  const pub = await rooms.getRoomPublic(roomRow.code, actorId);
  if (!(await rooms.canStart(pub))) {
    throw httpError('Hámmesi tayyar bolǵanınsha bastaw múmkin emes', 409);
  }

  const puzzle = await getCrosswordInternal(roomRow.content_id);
  if (!puzzle) throw httpError('Krossvord tabılmadı', 404);

  const [memberRows] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL`,
    [roomRow.id]
  );

  const sharedState = {
    mode: roomRow.mode,
    crosswordId: puzzle.id,
    width: puzzle.width,
    height: puzzle.height,
    totalWords: puzzle.words.length,
    board: roomRow.mode === 'coop' ? emptyBoard() : null,
    solved: 0,
  };

  for (const m of memberRows) {
    const progress =
      roomRow.mode === 'competitive'
        ? { board: {}, solved: 0, score: 0 }
        : { solved: 0, score: 0 };
    await db.query(
      `UPDATE game_room_members SET score = 0, progress_json = ? WHERE id = ?`,
      [JSON.stringify(progress), m.id]
    );
  }

  await rooms.markRoomInProgress(roomRow.id, sharedState);
  return rooms.getRoomPublic(roomRow.code, actorId);
}

export async function guessCrosswordInRoom(code, actorId, { wordIndex, answer }) {
  const pub = await rooms.getRoomPublic(code, actorId);
  if (!pub) throw httpError('Xona tabılmadı', 404);
  if (pub.status !== 'in_progress') throw httpError('Oyın faol emes', 409);
  if (pub.gameType !== 'crossword') throw httpError('Bul krossvord emes');

  const member = await rooms.findMemberByActor(pub.id, actorId);
  if (!member) throw httpError('Aǵza tabılmadı', 404);

  const check = await validateGuess(pub.contentId, { wordIndex, answer }, { actorId });
  if (!check.correct) {
    return {
      room: pub,
      correct: false,
      nearMiss: false,
      wordIndex: check.wordIndex,
      dictTitleId: check.dictTitleId || null,
    };
  }

  const puzzle = await getCrosswordInternal(pub.contentId);
  const word = puzzle.words[check.wordIndex];
  const filled = String(check.fillAnswer || answer)
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

  if (pub.mode === 'coop') {
    const board = { ...(pub.sharedState?.board || {}) };
    applyWord(board, word, filled);
    const solved = solvedCount(puzzle.words, board);
    const sharedState = {
      ...pub.sharedState,
      board,
      solved,
    };
    await rooms.updateSharedState(pub.id, sharedState);
    await rooms.updateMemberProgress({
      roomId: pub.id,
      actorId,
      score: solved,
      progress: { solved, lastWordIndex: check.wordIndex },
      finished: solved >= puzzle.words.length,
    });
    if (solved >= puzzle.words.length) {
      await finishCoop(pub, puzzle);
    }
  } else {
    const progress =
      typeof member.progress_json === 'string'
        ? JSON.parse(member.progress_json || '{}')
        : member.progress_json || {};
    const board = { ...(progress.board || {}) };
    applyWord(board, word, filled);
    const solved = solvedCount(puzzle.words, board);
    const score = solved * 10;
    await rooms.updateMemberProgress({
      roomId: pub.id,
      actorId,
      score,
      progress: { board, solved, score },
      finished: solved >= puzzle.words.length,
    });
    if (solved >= puzzle.words.length) {
      await maybeFinishCompetitive(pub);
    }
  }

  return {
    room: await rooms.getRoomPublic(code, actorId),
    correct: true,
    nearMiss: Boolean(check.nearMiss),
    fillAnswer: filled,
    wordIndex: check.wordIndex,
    dictTitleId: check.dictTitleId || null,
  };
}

async function finishCoop(pub, puzzle) {
  const [members] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL`,
    [pub.id]
  );
  for (const m of members) {
    await db.query(
      `INSERT INTO ${DB.krasvord}.crossword_stats
       (id, actor_id, crossword_id, mode, room_id, score, duration_seconds, completed)
       VALUES (?, ?, ?, 'coop', ?, ?, NULL, 1)`,
      [
        crypto.randomUUID(),
        m.actor_id,
        pub.contentId,
        pub.id,
        puzzle.words.length,
      ]
    );
    await rooms.updateMemberProgress({
      roomId: pub.id,
      actorId: m.actor_id,
      finished: true,
      score: puzzle.words.length,
    });
  }
  await rooms.markRoomFinished(pub.id, {
    ...pub.sharedState,
    solved: puzzle.words.length,
  });
}

async function maybeFinishCompetitive(pub) {
  const [members] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL`,
    [pub.id]
  );
  // Jarıs: hár kim óz maydanın sheshsin — xona tek hámmesi tamamlaǵanda jawıladı
  const allDone = members.length > 0 && members.every((m) => m.finished_at);
  if (!allDone) return;

  const winner = [...members]
    .filter((m) => m.finished_at)
    .sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))[0];

  for (const m of members) {
    await db.query(
      `INSERT INTO ${DB.krasvord}.crossword_stats
       (id, actor_id, crossword_id, mode, room_id, score, duration_seconds, completed)
       VALUES (?, ?, ?, 'competitive', ?, ?, NULL, ?)`,
      [
        crypto.randomUUID(),
        m.actor_id,
        pub.contentId,
        pub.id,
        m.score || 0,
        m.finished_at ? 1 : 0,
      ]
    );
  }

  await rooms.markRoomFinished(pub.id, {
    ...(pub.sharedState || {}),
    winnerMemberId: winner?.id || null,
    standings: members
      .map((m) => ({
        memberId: m.id,
        displayName: m.display_name,
        score: Number(m.score || 0),
        finishedAt: m.finished_at,
      }))
      .sort((a, b) => b.score - a.score),
  });
}
