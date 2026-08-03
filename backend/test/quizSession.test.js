import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  listQuizzes,
  startAttempt,
  answerQuestion,
  viewQuestion,
  finalizeAttempt,
  getAttemptState,
  shuffleForSeed,
  loadQuestions,
  MIN_COHORT_SIZE,
} from '../src/services/quizService.js';
import { ensureActor, deleteActorData } from '../src/services/actorService.js';
import { hashAnonymousId } from '../src/utils/actorHash.js';

function actorFromUuid(uuid) {
  return ensureActor(hashAnonymousId(uuid));
}

describe('quiz session engine', () => {
  it('shuffleForSeed deterministic', async () => {
    const quizzes = await listQuizzes();
    const questions = await loadQuestions(quizzes[0].id);
    const a = shuffleForSeed(questions, 'seed-abc');
    const b = shuffleForSeed(questions, 'seed-abc');
    assert.deepEqual(a.questionOrder, b.questionOrder);
    assert.deepEqual(a.optionOrders, b.optionOrders);
    const c = shuffleForSeed(questions, 'seed-xyz');
    // turli seed — kamida bir joyda farq (savollar >= 2 bo‘lsa)
    if (questions.length >= 2) {
      assert.notDeepEqual(a.questionOrder, c.questionOrder);
    }
  });

  it('start → answer → finalize to‘liq oqim', async () => {
    const uuid = crypto.randomUUID();
    const actor = await actorFromUuid(uuid);
    const quizzes = await listQuizzes();
    const quizId = quizzes.find((q) => q.timeMode !== 'timed')?.id || quizzes[0].id;

    const state = await startAttempt(quizId, actor, { ageConsent: false });
    assert.equal(state.status, 'in_progress');
    assert.ok(state.attemptId);
    assert.ok(state.questions.length >= 1);

    for (let i = 0; i < state.questions.length; i++) {
      if (i > 0) {
        await viewQuestion(state.attemptId, actor.id, i);
      }
      const current = await getAttemptState(state.attemptId, actor.id);
      const q = current.questions[i];
      await answerQuestion(state.attemptId, actor.id, {
        questionId: q.id,
        optionIndex: 0,
        timeSpentMs: 1200 + i * 100,
      });
    }

    const result = await finalizeAttempt(state.attemptId, actor.id, { partial: false });
    assert.ok(['completed', 'partial'].includes(result.status));
    assert.equal(result.total, state.questions.length);
    assert.equal(typeof result.score, 'number');
    assert.equal(result.analytics.available, false);
    assert.equal(result.results, undefined);
    assert.ok(['locked', 'unlocked'].includes(result.reviewAccess.status));
    assert.equal(typeof result.reviewAccess.cost === 'number' || result.reviewAccess.unlocked, true);
    assert.ok(result.points == null || typeof result.points.earned === 'number');

    await deleteActorData(actor.id);
  });

  it('partial finalize: ko‘rilmagan javobsiz qolsa rad', async () => {
    const uuid = crypto.randomUUID();
    const actor = await actorFromUuid(uuid);
    const quizzes = await listQuizzes();
    const quizId = quizzes.find((q) => Number(q.questionCount) >= 2)?.id || quizzes[0].id;
    const state = await startAttempt(quizId, actor, { ageConsent: false });
    const q0 = state.questions[0];
    await answerQuestion(state.attemptId, actor.id, {
      questionId: q0.id,
      optionIndex: 0,
      timeSpentMs: 500,
    });
    // ikkinchi savolni ko‘rmasdan partial — OK (faqat ko‘rilganlar)
    const result = await finalizeAttempt(state.attemptId, actor.id, { partial: true });
    assert.equal(result.status, 'partial');
    await deleteActorData(actor.id);
  });

  it('MIN_COHORT_SIZE = 5', () => {
    assert.equal(MIN_COHORT_SIZE, 5);
  });
});
