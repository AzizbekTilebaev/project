import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildReadingLesson,
  gradeReadingAnswer,
  gradeReadingSubmission,
  READING_ENGINE,
  stripLessonSecrets,
} from '../src/services/readingLessonEngine.js';
import { searchFold, splitSentences } from '../src/utils/textTokens.js';

const input = {
  bookId: 'book-1',
  sectionIndex: 2,
  sectionTitle: 'Sáher',
  paragraphs: [
    'Sáherde awıl ústine jaqtılıq taraldı. Jas bala kitap alıp mektepke ketti.',
    'Ol jol boyında úlken tereklerdi kórdi. Mektepte ustaz jańa temanı túsindirdi.',
  ],
  dictionaryEntries: [
    {
      id: 10,
      title: 'mektep',
      description: 'Balalar bilim alatuǵın oqıw ornı.',
      example: 'Mektep awıldıń ortasında jaylasqan.',
    },
    {
      id: 12,
      title: 'kitap',
      description: 'Baspa yamasa jazba shıǵarma.',
      example: 'Kitaptı oqıw — paydalı.',
    },
    { id: 11, title: 'teńiz', description: 'Úlken suw keńisligi.' },
  ],
  writer: {
    name: 'Import etilgen avtor',
    bio: 'Avtor Qaraqalpaqstanda tuwılǵan. Bul gápler import etilgen biografiyadan alınǵan.',
  },
  seed: 'stable-seed',
};

describe('readingLessonEngine v4', () => {
  it('builds deterministic dict-linked lesson', () => {
    const lesson = buildReadingLesson(input);
    const again = buildReadingLesson(input);
    const sourceSentences = splitSentences(input.paragraphs.join(' '));
    const bioSentences = splitSentences(input.writer.bio);

    assert.equal(lesson.engine, READING_ENGINE);
    assert.equal(lesson.engine, 'local-reading-v4');
    assert.deepEqual(lesson, again);
    assert.ok(lesson.summary.length > 0);
    assert.ok(lesson.summary.every((sentence) => sourceSentences.includes(sentence)));
    assert.ok(lesson.vocabulary.map((item) => item.word).includes('mektep'));
    assert.ok(lesson.writerContext.bio.every((sentence) => bioSentences.includes(sentence)));
  });

  it('vocab cloze + dual-direction sense (typed forward + reverse)', () => {
    const lesson = buildReadingLesson(input);
    assert.ok(lesson.questions.length >= 1);
    let senseCount = 0;
    let reverseCount = 0;
    let pickCount = 0;
    for (const q of lesson.questions) {
      if (q.type === 'cloze') {
        assert.ok(q.meta.dictTitleId, 'cloze must be dict-linked');
        assert.ok(
          lesson.vocabulary.some((v) => String(v.id) === String(q.meta.dictTitleId))
        );
      }
      if (q.type === 'sense') {
        senseCount += 1;
        assert.equal(q.options, undefined);
        assert.ok(q.meta.dictTitleId);
        assert.ok(Array.isArray(q.meta.accepted) && q.meta.accepted.length >= 1);
        assert.equal(q.prompt.includes(q.meta.answer), false, 'lemma not in prompt');
        assert.equal(gradeReadingAnswer(q, q.meta.answer), true);
        assert.equal(gradeReadingAnswer(q, 'nadurıs'), false);
      }
      if (q.type === 'produce_reverse') {
        reverseCount += 1;
        assert.equal(q.options, undefined);
        assert.ok(q.meta.dictTitleId);
        assert.ok(Array.isArray(q.meta.accepted) && q.meta.accepted.length >= 1);
        assert.equal(q.prompt, q.meta.answer);
        assert.equal(gradeReadingAnswer(q, q.meta.accepted[0]), true);
        assert.equal(gradeReadingAnswer(q, 'nadurıs anıqlama'), false);
        const publicQ = stripLessonSecrets(q);
        assert.equal(publicQ.meta, undefined);
        assert.equal(publicQ.options, undefined);
        assert.equal(publicQ.accepted, undefined);
      }
      if (q.type === 'sense_pick') {
        pickCount += 1;
        assert.ok(Array.isArray(q.options) && q.options.length >= 2);
        assert.ok(Number.isInteger(q.meta.answerIndex));
        assert.equal(gradeReadingAnswer(q, q.meta.answerIndex), true);
      }
    }
    assert.ok(senseCount >= 1, 'at least one sense production item');
    assert.ok(
      reverseCount + pickCount >= 1,
      'at least one reverse (typed or MCQ fallback) when vocab≥2'
    );
    assert.ok(reverseCount >= 1, 'usable gloss → produce_reverse');
    const linked = lesson.questions.filter((q) => q.meta?.dictTitleId);
    assert.ok(linked.length >= 1);
  });

  it('noisy short gloss — sense_pick fallback', () => {
    const lesson = buildReadingLesson({
      ...input,
      dictionaryEntries: [
        { id: 1, title: 'mektep', description: 'Orın.' },
        { id: 2, title: 'kitap', description: 'Baspa.' },
        { id: 3, title: 'awıl', description: 'Jer.' },
      ],
      seed: 'short-gloss-fallback',
    });
    const reverse = lesson.questions.find((q) => q.type === 'produce_reverse');
    const pick = lesson.questions.find((q) => q.type === 'sense_pick');
    assert.equal(reverse, undefined);
    // distractors may fail if all short — pick optional; at least no typed reverse
    if (pick) {
      assert.ok(Array.isArray(pick.options));
      assert.equal(gradeReadingAnswer(pick, pick.meta.answerIndex), true);
    }
  });

  it('produce_reverse soft nearMiss', () => {
    const lesson = buildReadingLesson(input);
    const rev = lesson.questions.find((q) => q.type === 'produce_reverse');
    assert.ok(rev);
    const target = String(rev.meta.accepted[0] || '');
    assert.ok(target.length >= 8);
    assert.equal(gradeReadingAnswer(rev, target), true);
    const typo = target.replace(/ornı\.?$/i, 'orna.').replace(/орны\.?$/i, 'орна.');
    if (typo !== target) {
      const soft = gradeReadingSubmission(rev, typo);
      assert.equal(soft.correct, true);
      assert.equal(soft.nearMiss, true);
    }
  });

  it('Cyrillic dictionary entry matches Latin text via fold', () => {
    const lesson = buildReadingLesson({
      ...input,
      dictionaryEntries: [
        {
          id: 99,
          title: 'МЕКТЕП',
          description: 'Балалар билим алатуғын оқыў орны.',
        },
        {
          id: 100,
          title: 'КИТАП',
          description: 'Баспа ямаса жазба шығарма.',
        },
      ],
      seed: 'cyr-seed',
    });
    assert.ok(lesson.vocabulary.some((v) => searchFold(v.word) === searchFold('mektep')));
    const sense = lesson.questions.find((q) => q.type === 'sense');
    if (sense) {
      assert.equal(gradeReadingAnswer(sense, 'mektep'), true);
      assert.equal(gradeReadingAnswer(sense, 'МЕКТЕП'), true);
    }
    const rev = lesson.questions.find((q) => q.type === 'produce_reverse');
    if (rev) {
      assert.equal(gradeReadingAnswer(rev, rev.meta.accepted[0]), true);
    }
    const pick = lesson.questions.find((q) => q.type === 'sense_pick');
    if (pick) {
      assert.equal(gradeReadingAnswer(pick, pick.meta.answerIndex), true);
    }
  });

  it('low vocab — comprehension choice, not fake cloze', () => {
    const lesson = buildReadingLesson({
      ...input,
      dictionaryEntries: [],
      seed: 'empty-vocab',
    });
    assert.equal(lesson.vocabulary.length, 0);
    assert.equal(lesson.lowVocab, true);
    assert.ok(lesson.questions.every((q) => q.type === 'choice'));
    assert.ok(lesson.questions.every((q) => !q.meta?.dictTitleId || q.type === 'choice'));
  });

  it('strips all answer metadata from public payloads', () => {
    const privateLesson = buildReadingLesson(input);
    const publicLesson = stripLessonSecrets(privateLesson);
    const serialized = JSON.stringify(publicLesson);

    assert.equal(serialized.includes('"meta"'), false);
    assert.equal(serialized.includes('"answer"'), false);
    assert.equal(serialized.includes('"answerIndex"'), false);
    assert.equal(serialized.includes('"accepted"'), false);
    assert.ok(publicLesson.questions.every((question) => question.prompt));
  });

  it('grades cloze and sense server-side without exposing answers', () => {
    const lesson = buildReadingLesson(input);
    const cloze = lesson.questions.find((question) => question.type === 'cloze');
    if (cloze) {
      assert.equal(gradeReadingAnswer(cloze, cloze.meta.answer), true);
      assert.equal(gradeReadingAnswer(cloze, 'nadurıs juwap'), false);
      const publicQuestion = stripLessonSecrets(cloze);
      assert.equal(publicQuestion.meta, undefined);
      assert.equal(publicQuestion.answer, undefined);
    }
    const sense = lesson.questions.find((question) => question.type === 'sense');
    assert.ok(sense, 'sense production expected with vocab');
    assert.equal(gradeReadingAnswer(sense, sense.meta.answer), true);
    assert.equal(stripLessonSecrets(sense).options, undefined);
    const rev = lesson.questions.find((question) => question.type === 'produce_reverse');
    assert.ok(rev, 'produce_reverse expected with vocab≥2 + usable gloss');
    assert.equal(gradeReadingAnswer(rev, rev.meta.accepted[0]), true);
    assert.equal(stripLessonSecrets(rev).options, undefined);
    assert.equal(stripLessonSecrets(rev).meta, undefined);
  });
});
