/**
 * Tutor production recall + dual-direction sense MCQ.
 * Run: node --test --test-force-exit test/tutorProduce.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProduceAccepted,
  buildTutorExampleCloze,
  buildTutorGlossAccepted,
  buildTutorSenseMcq,
  gradeTutorGlossSubmission,
  gradeTutorProduceAnswer,
  gradeTutorSenseMcqAnswer,
  mistakeBankTouchFromTutorItem,
  preferTutorProduceOverQuiz,
  shouldTutorExampleCloze,
  shouldTutorListenProduce,
  shouldTutorProduceReverse,
  shouldTutorTypedReverse,
} from '../src/services/tutorService.js';
import { clozeWordInSentence } from '../src/utils/clozeWord.js';
import { glossSoftMaxDistance } from '../src/utils/produceGrade.js';

describe('buildProduceAccepted', () => {
  it('word + fold', () => {
    const got = buildProduceAccepted('Mektep');
    assert.ok(got.includes('Mektep'));
    assert.ok(got.length >= 1);
  });

  it('bos — []', () => {
    assert.deepEqual(buildProduceAccepted(''), []);
    assert.deepEqual(buildProduceAccepted(null), []);
  });
});

describe('gradeTutorProduceAnswer', () => {
  it('latin / cyrillic fold match', () => {
    const accepted = buildProduceAccepted('mektep');
    assert.equal(gradeTutorProduceAnswer(accepted, 'mektep'), true);
    assert.equal(gradeTutorProduceAnswer(accepted, 'MEKTEP'), true);
    assert.equal(gradeTutorProduceAnswer(accepted, '  mektep  '), true);
  });

  it('qáte juwap', () => {
    const accepted = buildProduceAccepted('kitap');
    assert.equal(gradeTutorProduceAnswer(accepted, 'mektep'), false);
    assert.equal(gradeTutorProduceAnswer(accepted, ''), false);
    assert.equal(gradeTutorProduceAnswer(accepted, null), false);
  });
});

describe('shouldTutorProduceReverse', () => {
  it('wrongCount ≥3 — reverse', () => {
    assert.equal(shouldTutorProduceReverse({ mistakeId: 'a', wrongCount: 3 }), true);
    assert.equal(shouldTutorProduceReverse({ mistakeId: 'a', wrongCount: 5 }), true);
  });

  it('id boyınsha alternate — deterministik', () => {
    const a = shouldTutorProduceReverse({ mistakeId: 'id-even-test', wrongCount: 1 });
    const b = shouldTutorProduceReverse({ mistakeId: 'id-even-test', wrongCount: 1 });
    assert.equal(a, b);
    const flips = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'].map((id) =>
      shouldTutorProduceReverse({ mistakeId: id, wrongCount: 1 })
    );
    assert.ok(flips.some(Boolean) && flips.some((v) => !v));
  });
});

describe('preferTutorProduceOverQuiz', () => {
  it('lemma + anıqlama — produce', () => {
    assert.equal(
      preferTutorProduceOverQuiz({ word: 'mektep', definition: 'Oqıw ornı.' }),
      true
    );
  });

  it('joq / bos — quiz MCQ qaladı', () => {
    assert.equal(preferTutorProduceOverQuiz({ word: '', definition: 'x' }), false);
    assert.equal(preferTutorProduceOverQuiz({ word: 'a', definition: '  ' }), false);
    assert.equal(preferTutorProduceOverQuiz({}), false);
  });
});

describe('clozeWordInSentence + example cloze', () => {
  it('birinshi token → _____', () => {
    assert.equal(
      clozeWordInSentence('Balalar mektepke baradı.', 'mektepke'),
      'Balalar _____ baradı.'
    );
    assert.equal(clozeWordInSentence('Joq.', 'mektep'), 'Joq.');
  });

  it('buildTutorExampleCloze — usable mısal', () => {
    const got = buildTutorExampleCloze({
      example: 'Balalar mektepke erte baradı.',
      word: 'mektepke',
    });
    assert.ok(got);
    assert.ok(got.prompt.includes('_____'));
    assert.ok(!got.prompt.toLowerCase().includes('mektepke'));
    assert.equal(gradeTutorProduceAnswer(got.accepted, 'mektepke'), true);
  });

  it('lemma mısalda joq — null', () => {
    assert.equal(
      buildTutorExampleCloze({
        example: 'Bul gápte basqa sózler bar.',
        word: 'mektep',
      }),
      null
    );
  });

  it('shouldTutorExampleCloze — leech + mısal', () => {
    assert.equal(
      shouldTutorExampleCloze({
        wrongCount: 3,
        example: 'Olar mektepke baradı házir.',
        word: 'mektepke',
      }),
      true
    );
    assert.equal(
      shouldTutorExampleCloze({
        wrongCount: 1,
        example: 'Olar mektepke baradı házir.',
        word: 'mektepke',
      }),
      false
    );
  });
});

describe('shouldTutorListenProduce', () => {
  it('immersion + audio', () => {
    assert.equal(shouldTutorListenProduce({ source: 'immersion', hasAudio: true }), true);
    assert.equal(shouldTutorListenProduce({ source: 'immersion', hasAudio: false }), false);
    assert.equal(shouldTutorListenProduce({ source: 'quiz', hasAudio: true }), false);
  });
});

describe('buildTutorGlossAccepted + typed reverse', () => {
  it('qısqa gloss — typed reverse OK', () => {
    const def = 'Balalar bilim alatuǵın oqıw ornı.';
    assert.equal(shouldTutorTypedReverse({ definition: def }), true);
    const accepted = buildTutorGlossAccepted(def);
    assert.ok(accepted.length >= 1);
    assert.equal(gradeTutorGlossSubmission(accepted, def).correct, true);
    assert.equal(gradeTutorGlossSubmission(accepted, def).nearMiss, false);
  });

  it('juda qısqa — typed emes (MCQ fallback)', () => {
    assert.equal(shouldTutorTypedReverse({ definition: 'Orın.' }), false);
    assert.deepEqual(buildTutorGlossAccepted('Orın.'), []);
  });

  it('gloss soft nearMiss (uzın)', () => {
    const def = 'Balalar bilim alatuǵın oqıw ornı.';
    const accepted = buildTutorGlossAccepted(def);
    const typo = 'Balalar bilim alatuǵın oqıw orna.';
    const g = gradeTutorGlossSubmission(accepted, typo);
    assert.equal(g.correct, true);
    assert.equal(g.nearMiss, true);
    assert.ok(glossSoftMaxDistance(20) >= 2);
  });
});

describe('buildTutorSenseMcq + grade', () => {
  const distractors = [
    'Balalar bilim alatuǵın oqıw ornı emes — basqa 1.',
    'Úlken suw keńisligi — teńiz haqqında.',
    'Baspa yamasa jazba shıǵarma — kitap.',
    'Qosımsha distractor tórtinshi.',
  ];

  it('4 variant + seed shuffle', () => {
    const mcq = buildTutorSenseMcq({
      definition: 'Balalar bilim alatuǵın oqıw ornı.',
      distractorDefs: distractors,
      seed: 'm1',
    });
    assert.ok(mcq);
    assert.equal(mcq.options.length, 4);
    assert.equal(mcq.order.length, 4);
    assert.ok(mcq.options.includes(mcq.correctAnswer));
    const again = buildTutorSenseMcq({
      definition: 'Balalar bilim alatuǵın oqıw ornı.',
      distractorDefs: distractors,
      seed: 'm1',
    });
    assert.deepEqual(mcq.options, again.options);
  });

  it('jetkiliksiz distractor — null', () => {
    assert.equal(
      buildTutorSenseMcq({
        definition: 'Tek bir.',
        distractorDefs: ['A', 'B'],
        seed: 'x',
      }),
      null
    );
  });

  it('grade — durıs / qáte index', () => {
    const mcq = buildTutorSenseMcq({
      definition: 'Balalar bilim alatuǵın oqıw ornı.',
      distractorDefs: distractors,
      seed: 'grade-1',
    });
    const meta = {
      order: mcq.order,
      options: mcq.pool,
      correctAnswer: mcq.correctAnswer,
    };
    const correctIdx = mcq.options.indexOf(mcq.correctAnswer);
    assert.equal(gradeTutorSenseMcqAnswer(meta, correctIdx), true);
    assert.equal(gradeTutorSenseMcqAnswer(meta, (correctIdx + 1) % 4), false);
    assert.equal(gradeTutorSenseMcqAnswer(meta, -1), false);
  });
});

describe('produce touch source fidelity', () => {
  it('produce item — asıl source saqlanadı', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'produce',
        dictTitleId: 't1',
        source: 'reading',
        prompt: 'Anıqlama…',
      },
      { correct: true }
    );
    assert.equal(touch.op, 'correct');
    assert.equal(touch.args.source, 'reading');
    assert.equal(touch.args.dictTitleId, 't1');
  });

  it('quiz-bridged produce — questionId saqlanadı', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'produce',
        questionId: 42,
        dictTitleId: 't9',
        source: 'quiz',
        prompt: '…',
      },
      { correct: true }
    );
    assert.equal(touch.args.questionId, 42);
    assert.equal(touch.args.dictTitleId, 't9');
    assert.equal(touch.args.source, 'quiz');
  });

  it('example_cloze qáte — upsert + source', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'example_cloze',
        dictTitleId: 't3',
        source: 'quiz',
        prompt: '_____ baradı.',
      },
      { correct: false }
    );
    assert.equal(touch.op, 'upsert');
    assert.equal(touch.args.source, 'quiz');
    assert.equal(touch.args.dictTitleId, 't3');
  });

  it('produce_reverse qáte — upsert + source', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'produce_reverse',
        dictTitleId: 't8',
        source: 'dict_game',
        prompt: 'Mektep',
      },
      { correct: false }
    );
    assert.equal(touch.op, 'upsert');
    assert.equal(touch.args.source, 'dict_game');
    assert.equal(touch.args.dictTitleId, 't8');
  });

  it('sense_mcq qáte — upsert + source', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'sense_mcq',
        dictTitleId: 't2',
        source: 'crossword',
        prompt: 'Mektep',
      },
      { correct: false }
    );
    assert.equal(touch.op, 'upsert');
    assert.equal(touch.args.source, 'crossword');
  });

  it('produce qáte — upsert + source', () => {
    const touch = mistakeBankTouchFromTutorItem(
      {
        kind: 'produce',
        dictTitleId: 't2',
        source: 'crossword',
        prompt: '…',
      },
      { correct: false }
    );
    assert.equal(touch.op, 'upsert');
    assert.equal(touch.args.source, 'crossword');
  });
});
