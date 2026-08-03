/**
 * Quiz → lugʻat bridge: kandidatlar, lookup, uniqueKey.
 * Run: node --test --test-force-exit test/quizDictBridge.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractQuizWordCandidates,
  resolveDictTitleIdFromQuiz,
  buildQuizPracticePayload,
} from '../src/services/quizDictBridge.js';
import { uniqueKey } from '../src/services/mistakeBankService.js';

describe('extractQuizWordCandidates', () => {
  it('correct_answer ni birinshi kandidat qıladı', () => {
    assert.deepEqual(
      extractQuizWordCandidates({
        correctAnswer: 'Berdaq',
        question: 'Kim belgili shayır?',
      }),
      ['Berdaq']
    );
  });

  it('sorawdaǵı «sóz» ni qosadı', () => {
    const got = extractQuizWordCandidates({
      correctAnswer: 'Almastırma',
      question: '«Men» sózi qaysı sóz túrkumine mısal?',
    });
    assert.deepEqual(got, ['Almastırma', 'Men']);
  });

  it('san hám bos kandidatlardı ótkerip jiberedi', () => {
    assert.deepEqual(
      extractQuizWordCandidates({ correctAnswer: '9', question: 'Neshe dawıslı?' }),
      []
    );
    assert.deepEqual(extractQuizWordCandidates({}), []);
  });
});

describe('resolveDictTitleIdFromQuiz', () => {
  it('lookup orqalı birinshi tabılǵan id qaytaradı', async () => {
    const map = { Men: 'title-men', Almastırma: null };
    const id = await resolveDictTitleIdFromQuiz(
      {
        correctAnswer: 'Almastırma',
        question: '«Men» sózi qaysı?',
      },
      async (word) => map[word] || null
    );
    assert.equal(id, 'title-men');
  });

  it('hesh bir match bolmasa null', async () => {
    const id = await resolveDictTitleIdFromQuiz(
      { correctAnswer: 'XYZ-not-a-word', question: 'test' },
      async () => null
    );
    assert.equal(id, null);
  });
});

describe('mistakeBank uniqueKey', () => {
  it('questionId bar bolsa dictTitleId keyge kirmeydi', () => {
    assert.equal(
      uniqueKey({ actorId: 1, source: 'quiz', questionId: 42, dictTitleId: 'abc' }),
      '1|quiz|42|'
    );
    assert.equal(
      uniqueKey({ actorId: 1, source: 'quiz', questionId: 42 }),
      '1|quiz|42|'
    );
  });

  it('dict-only qátelikler title id menen kalitlenedi', () => {
    assert.equal(
      uniqueKey({ actorId: 2, source: 'dict_game', dictTitleId: 't1' }),
      '2|dict_game||t1'
    );
  });
});

describe('buildQuizPracticePayload', () => {
  it('qáte juwaplar missedIds; barlıq linked titleIds', async () => {
    const map = { Men: 'id-men', Kitap: 'id-kitap', Mektep: 'id-mektep' };
    const practice = await buildQuizPracticePayload(
      [
        { correct: false, correctAnswer: 'Men', question: '«Men»?' },
        { correct: true, correctAnswer: 'Kitap', question: 'Kitap?' },
        { correct: false, correctAnswer: 'Mektep', question: 'Mektep?' },
        { correct: false, correctAnswer: 'XYZ', question: 'unknown' },
      ],
      async (word) => map[word] || null
    );
    assert.deepEqual(practice.missedIds, ['id-men', 'id-mektep']);
    assert.deepEqual(practice.titleIds, ['id-men', 'id-mektep', 'id-kitap']);
  });

  it('bos yamasa bridge joq — bos payload', async () => {
    const practice = await buildQuizPracticePayload(
      [{ correct: false, correctAnswer: '??', question: 'x' }],
      async () => null
    );
    assert.deepEqual(practice, { missedIds: [], titleIds: [] });
  });
});
