import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listQuizzes,
  getQuizPublic,
  submitQuiz,
} from '../src/services/quizService.js';

describe('quiz service', () => {
  it('listQuizzes questionCount > 0', async () => {
    const quizzes = await listQuizzes();
    assert.ok(Array.isArray(quizzes));
    assert.ok(quizzes.length >= 1);
    assert.ok(quizzes.every((q) => Number(q.questionCount) > 0));
  });

  it('getQuizPublic da correctAnswer yo\'q', async () => {
    const quizzes = await listQuizzes();
    const quiz = await getQuizPublic(quizzes[0].id);
    assert.ok(quiz.questions.length >= 1);
    for (const q of quiz.questions) {
      assert.equal(q.correctAnswer, undefined);
      assert.ok(Array.isArray(q.options));
    }
  });

  it('submitQuiz skor hisoblaydi (indeks)', async () => {
    const quizzes = await listQuizzes();
    const quiz = await getQuizPublic(quizzes[0].id);
    const answers = {};
    for (const q of quiz.questions) answers[q.id] = 0;
    const result = await submitQuiz(quiz.id, answers);
    assert.equal(typeof result.score, 'number');
    assert.equal(result.total, quiz.questions.length);
    assert.ok(result.results[0].correctAnswer);
    assert.equal(result.results[0].givenIndex, 0);
  });
});
