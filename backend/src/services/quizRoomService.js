import crypto from 'crypto';
import { pools } from '../config/db.js';
import * as rooms from './gameRoomService.js';
import {
  loadQuestions,
  getAttemptState,
  answerQuestion,
  finalizeAttempt,
  shuffleForSeed,
} from './quizService.js';
import { recordEvent } from './actorService.js';

const db = pools.quiz;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function loadQuizMeta(quizId) {
  const [[quiz]] = await db.query(
    `SELECT id, title, description, level, category,
            time_mode AS timeMode, time_limit_seconds AS timeLimitSeconds
     FROM quizzes WHERE id = ?`,
    [quizId]
  );
  return quiz || null;
}

function questionSeconds(quiz, questions, index) {
  if (quiz.timeMode !== 'timed') return null;
  const q = questions[index];
  return q?.timeLimitSeconds || quiz.timeLimitSeconds || 30;
}

/**
 * Host starts a quiz room: one shared instance, one attempt per member.
 */
export async function startQuizRoom(code, actorId) {
  const roomRow = await db
    .query(`SELECT * FROM game_rooms WHERE code = ? LIMIT 1`, [String(code || '').toUpperCase()])
    .then(([rows]) => rows[0]);
  if (!roomRow) throw httpError('Xona tabılmadı', 404);
  if (roomRow.game_type !== 'quiz') throw httpError('Bul quiz xonası emes', 400);
  await rooms.assertHost(roomRow, actorId);

  const pub = await rooms.getRoomPublic(roomRow.code, actorId);
  if (!(await rooms.canStart(pub))) {
    throw httpError('Hámmesi tayyar bolǵanınsha bastaw múmkin emes', 409);
  }

  const quizId = roomRow.content_id;
  const quiz = await loadQuizMeta(quizId);
  if (!quiz) throw httpError('Test tabılmadı', 404);
  const questions = await loadQuestions(quizId);
  if (!questions.length) throw httpError('Testte soraw joq');

  const seed = crypto.randomBytes(16).toString('hex');
  const { questionOrder, optionOrders } = shuffleForSeed(questions, seed);
  const instanceId = crypto.randomUUID();
  const [memberRows] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL ORDER BY joined_at`,
    [roomRow.id]
  );

  const q0 = questions.find((q) => q.id === questionOrder[0]);
  const perQ = questionSeconds(quiz, questions, 0);
  const syncDeadline =
    roomRow.mode === 'sync' && quiz.timeMode === 'timed' && perQ
      ? new Date(Date.now() + perQ * 1000)
      : roomRow.mode === 'sync'
        ? new Date(Date.now() + (q0?.timeLimitSeconds || 45) * 1000)
        : null;

  const sharedState = {
    instanceId,
    mode: roomRow.mode,
    currentIndex: 0,
    totalQuestions: questionOrder.length,
    questionDeadlineAt: syncDeadline ? syncDeadline.toISOString() : null,
    serverNow: new Date().toISOString(),
  };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO quiz_instances (id, quiz_id, question_order, option_orders, seed)
       VALUES (?, ?, ?, ?, ?)`,
      [instanceId, quizId, JSON.stringify(questionOrder), JSON.stringify(optionOrders), seed]
    );

    for (const m of memberRows) {
      const attemptId = crypto.randomUUID();
      const totalDeadline =
        quiz.timeMode === 'timed' && quiz.timeLimitSeconds
          ? new Date(Date.now() + quiz.timeLimitSeconds * 1000)
          : null;

      await conn.query(
        `INSERT INTO quiz_attempts
         (id, instance_id, quiz_id, actor_id, room_id, play_mode, status, current_index,
          age_years, age_consent, total, total_deadline_at)
         VALUES (?, ?, ?, ?, ?, ?, 'in_progress', 0, NULL, 0, ?, ?)`,
        [
          attemptId,
          instanceId,
          quizId,
          m.actor_id,
          roomRow.id,
          roomRow.mode,
          questions.length,
          totalDeadline,
        ]
      );

      for (let pos = 0; pos < questionOrder.length; pos++) {
        const qid = questionOrder[pos];
        const q = questions.find((x) => x.id === qid);
        let qStarted = null;
        let qDeadline = null;
        if (pos === 0) {
          qStarted = new Date();
          if (roomRow.mode === 'sync' && syncDeadline) {
            qDeadline = syncDeadline;
          } else if (quiz.timeMode === 'timed' && q.timeLimitSeconds) {
            qDeadline = new Date(Date.now() + q.timeLimitSeconds * 1000);
          }
        }
        await conn.query(
          `INSERT INTO quiz_attempt_questions
           (attempt_id, question_id, position, viewed, question_started_at, question_deadline_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [attemptId, Number(qid), pos, pos === 0 ? 1 : 0, qStarted, qDeadline]
        );
      }

      await conn.query(
        `UPDATE game_room_members SET attempt_id = ?, score = 0, progress_json = ?
         WHERE id = ?`,
        [
          attemptId,
          JSON.stringify({ answered: 0, currentIndex: 0, finished: false }),
          m.id,
        ]
      );

      await recordEvent(m.actor_id, 'quiz_started', {
        quizId,
        attemptId,
        payload: { mode: roomRow.mode },
      });
    }

    await conn.query(
      `UPDATE game_rooms
       SET status = 'in_progress',
           started_at = CURRENT_TIMESTAMP,
           shared_state_json = ?
       WHERE id = ?`,
      [JSON.stringify(sharedState), roomRow.id]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return rooms.getRoomPublic(roomRow.code, actorId);
}

export async function getMyRoomAttempt(code, actorId) {
  const pub = await rooms.getRoomPublic(code, actorId);
  if (!pub) throw httpError('Xona tabılmadı', 404);
  const member = await rooms.findMemberByActor(pub.id, actorId);
  if (!member?.attempt_id) throw httpError('Urınıw tabılmadı', 404);
  const state = await getAttemptState(member.attempt_id, actorId);
  return { room: pub, attempt: state };
}

async function countAnswered(attemptId) {
  const [[{ n }]] = await db.query(
    `SELECT COUNT(*) AS n FROM quiz_attempt_questions
     WHERE attempt_id = ? AND selected_option_index IS NOT NULL`,
    [attemptId]
  );
  return Number(n || 0);
}

export async function answerInRoom(code, actorId, payload) {
  const pub = await rooms.getRoomPublic(code, actorId);
  if (!pub) throw httpError('Xona tabılmadı', 404);
  if (pub.status !== 'in_progress') throw httpError('Oyın faol emes', 409);
  const member = await rooms.findMemberByActor(pub.id, actorId);
  if (!member?.attempt_id) throw httpError('Urınıw tabılmadı', 404);

  if (pub.mode === 'sync' && pub.sharedState?.questionDeadlineAt) {
    if (new Date(pub.sharedState.questionDeadlineAt).getTime() <= Date.now()) {
      throw httpError('Soraw waqtı tamam', 409);
    }
    // Sync: only allow answering current shared index
    const state = await getAttemptState(member.attempt_id, actorId);
    const qid = state.questions[pub.sharedState.currentIndex]?.id;
    if (qid && String(payload.questionId) !== String(qid)) {
      throw httpError('Házirgi soraw emes', 409);
    }
  }

  const state = await answerQuestion(member.attempt_id, actorId, payload);
  const answered = await countAnswered(member.attempt_id);
  const finished = answered >= state.total;

  let score = 0;
  if (finished || pub.mode === 'race') {
    const [[{ s }]] = await db.query(
      `SELECT COALESCE(SUM(is_correct = 1), 0) AS s
       FROM quiz_attempt_questions WHERE attempt_id = ?`,
      [member.attempt_id]
    );
    score = Number(s || 0);
  }

  await rooms.updateMemberProgress({
    roomId: pub.id,
    actorId,
    attemptId: member.attempt_id,
    score: finished || pub.mode === 'race' ? score : answered,
    progress: {
      answered,
      currentIndex: state.currentIndex,
      finished,
    },
    finished,
  });

  if (finished) {
    await finalizeAttempt(member.attempt_id, actorId, { partial: false }).catch(() => null);
  }

  if (pub.mode === 'sync') {
    await maybeAdvanceSync(pub);
  } else {
    await maybeFinishRace(pub);
  }

  return {
    room: await rooms.getRoomPublic(code, actorId),
    attempt: await getAttemptState(member.attempt_id, actorId),
  };
}

async function maybeAdvanceSync(pub) {
  const [members] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL`,
    [pub.id]
  );
  const idx = pub.sharedState?.currentIndex ?? 0;
  const total = pub.sharedState?.totalQuestions ?? 0;

  const allAnsweredCurrent = await Promise.all(
    members.map(async (m) => {
      if (!m.attempt_id) return false;
      const [[row]] = await db.query(
        `SELECT selected_option_index AS sel FROM quiz_attempt_questions
         WHERE attempt_id = ? AND position = ? LIMIT 1`,
        [m.attempt_id, idx]
      );
      return row && row.sel != null;
    })
  );

  const deadlinePassed =
    pub.sharedState?.questionDeadlineAt &&
    new Date(pub.sharedState.questionDeadlineAt).getTime() <= Date.now();

  if (!allAnsweredCurrent.every(Boolean) && !deadlinePassed) return;

  if (idx + 1 >= total) {
    await finishAll(pub, members);
    return;
  }

  const next = idx + 1;
  const quiz = await loadQuizMeta(pub.contentId);
  const questions = await loadQuestions(pub.contentId);
  const [[inst]] = await db.query(
    `SELECT question_order AS questionOrder FROM quiz_instances WHERE id = ?`,
    [pub.sharedState.instanceId]
  );
  const order =
    typeof inst.questionOrder === 'string' ? JSON.parse(inst.questionOrder) : inst.questionOrder;
  const qid = order[next];
  const q = questions.find((x) => x.id === qid);
  const secs =
    quiz.timeMode === 'timed'
      ? q?.timeLimitSeconds || quiz.timeLimitSeconds || 30
      : q?.timeLimitSeconds || 45;
  const deadline = new Date(Date.now() + secs * 1000);

  for (const m of members) {
    if (!m.attempt_id) continue;
    await db.query(
      `UPDATE quiz_attempt_questions
       SET viewed = 1, question_started_at = COALESCE(question_started_at, CURRENT_TIMESTAMP),
           question_deadline_at = ?
       WHERE attempt_id = ? AND position = ?`,
      [deadline, m.attempt_id, next]
    );
    await db.query(`UPDATE quiz_attempts SET current_index = ? WHERE id = ?`, [next, m.attempt_id]);
  }

  const sharedState = {
    ...pub.sharedState,
    currentIndex: next,
    questionDeadlineAt: deadline.toISOString(),
    serverNow: new Date().toISOString(),
  };
  await rooms.updateSharedState(pub.id, sharedState);
}

async function maybeFinishRace(pub) {
  const [members] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL`,
    [pub.id]
  );
  if (members.every((m) => m.finished_at)) {
    await rooms.markRoomFinished(pub.id, {
      ...(pub.sharedState || {}),
      standings: buildStandings(members),
    });
  }
}

async function finishAll(pub, members) {
  for (const m of members) {
    if (!m.attempt_id) continue;
    try {
      await finalizeAttempt(m.attempt_id, m.actor_id, { partial: true, force: true });
    } catch {
      /* ignore */
    }
    const [[{ s }]] = await db.query(
      `SELECT COALESCE(SUM(is_correct = 1), 0) AS s
       FROM quiz_attempt_questions WHERE attempt_id = ?`,
      [m.attempt_id]
    );
    await rooms.updateMemberProgress({
      roomId: pub.id,
      actorId: m.actor_id,
      score: Number(s || 0),
      progress: { finished: true },
      finished: true,
    });
  }
  const [fresh] = await db.query(
    `SELECT * FROM game_room_members WHERE room_id = ? AND left_at IS NULL`,
    [pub.id]
  );
  await rooms.markRoomFinished(pub.id, {
    ...(pub.sharedState || {}),
    standings: buildStandings(fresh),
  });
}

function buildStandings(members) {
  return [...members]
    .map((m) => ({
      memberId: m.id,
      displayName: m.display_name,
      score: m.score != null ? Number(m.score) : 0,
      finishedAt: m.finished_at,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.finishedAt && b.finishedAt) {
        return new Date(a.finishedAt) - new Date(b.finishedAt);
      }
      if (a.finishedAt) return -1;
      if (b.finishedAt) return 1;
      return 0;
    });
}

export async function tickSyncRooms() {
  const [rows] = await db.query(
    `SELECT * FROM game_rooms
     WHERE game_type = 'quiz' AND mode = 'sync' AND status = 'in_progress'`
  );
  for (const row of rows) {
    const pub = await rooms.getRoomPublic(row.code);
    if (!pub?.sharedState?.questionDeadlineAt) continue;
    if (new Date(pub.sharedState.questionDeadlineAt).getTime() <= Date.now()) {
      await maybeAdvanceSync(pub);
    }
  }
}
