import crypto from 'crypto';
import {
  KARAKALPAK_STOPWORDS,
  searchFold,
  sourceWords,
  splitSentences,
  tokenFrequency,
  tokenize,
} from '../utils/textTokens.js';
import { clozeWordInSentence } from '../utils/clozeWord.js';
import {
  gradeGlossProduceSubmission,
  gradeProduceSubmission,
} from '../utils/produceGrade.js';
import { buildTutorGlossAccepted } from './tutorService.js';

export const READING_ENGINE = 'local-reading-v4';

function hashNumber(value) {
  const digest = crypto.createHash('sha256').update(String(value)).digest();
  return digest.readUInt32BE(0);
}

function seededOrder(values, seed) {
  return [...values].sort((a, b) => {
    const aHash = hashNumber(`${seed}:${JSON.stringify(a)}`);
    const bHash = hashNumber(`${seed}:${JSON.stringify(b)}`);
    return aHash - bHash;
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractiveSummary(sentences, seed, limit = 3) {
  if (sentences.length <= limit) return sentences;
  const frequencies = tokenFrequency(sentences.join(' '));
  const scored = sentences.map((sentence, index) => {
    const tokens = tokenize(sentence);
    const score = tokens.reduce((sum, token) => sum + (frequencies.get(token) || 0), 0);
    return {
      sentence,
      index,
      score: tokens.length ? score / Math.sqrt(tokens.length) : 0,
      tie: hashNumber(`${seed}:summary:${sentence}`),
    };
  });
  return scored
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

function normalizeDictionaryEntry(entry) {
  const title = String(entry?.title || entry?.soz || '').trim();
  const description = String(entry?.description || entry?.definition || '').trim();
  const example = String(entry?.example || '').trim();
  return title && description
    ? {
        id: entry.id || null,
        word: title,
        description,
        ...(example ? { example } : {}),
      }
    : null;
}

/** Token yamasa folded title sentence ishinde bar ma. */
function vocabInSentence(sentence, word) {
  const foldedWord = searchFold(word);
  if (!foldedWord) return false;
  const sentenceTokens = tokenize(sentence, { includeStopwords: true, minLength: 1 });
  if (sentenceTokens.includes(foldedWord)) return true;
  const titleTokens = tokenize(word, { includeStopwords: true, minLength: 1 });
  if (!titleTokens.length) return false;
  return titleTokens.every((token) =>
    sentenceTokens.some(
      (sourceToken) =>
        sourceToken === token || (token.length >= 5 && sourceToken.startsWith(token))
    )
  );
}

function selectVocabulary(text, dictionaryEntries, seed, limit = 6) {
  const sourceTokenSet = new Set(tokenize(text, { includeStopwords: true, minLength: 1 }));
  const matched = dictionaryEntries
    .map(normalizeDictionaryEntry)
    .filter(Boolean)
    .filter((entry) => searchFold(entry.word).length >= 3)
    .filter((entry) => {
      const titleTokens = tokenize(entry.word, { includeStopwords: true, minLength: 1 });
      return (
        titleTokens.length > 0 &&
        titleTokens.every((token) =>
          [...sourceTokenSet].some(
            (sourceToken) =>
              sourceToken === token || (token.length >= 5 && sourceToken.startsWith(token))
          )
        )
      );
    });
  const byWord = new Map();
  for (const item of seededOrder(matched, `${seed}:vocabulary`)) {
    const key = searchFold(item.word);
    if (!byWord.has(key)) byWord.set(key, item);
  }
  return [...byWord.values()].slice(0, limit);
}

function shortDesc(text, max = 110) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Dict-linked dars: vocab cloze + dual-direction sense
 * (anıqlama → sóz typed, sóz → anıqlama typed; MCQ fallback).
 * Unlinked random cloze joq — vocab bolsa tek sózlik sózleri.
 */
function makeQuestions({ sentences, vocabulary, seed, count = 4 }) {
  const questions = [];
  const usedVocab = new Set();
  const coveredSense = new Set();
  const usableSentences = seededOrder(
    sentences.filter((sentence) => sourceWords(sentence).length >= 3),
    `${seed}:questions`
  );

  // 1) Vocab cloze — tek sózlikke baylanǵan sózler
  for (const sentence of usableSentences) {
    if (questions.length >= count) break;
    const hit = vocabulary.find(
      (item) => !usedVocab.has(searchFold(item.word)) && vocabInSentence(sentence, item.word)
    );
    if (!hit) continue;
    const prompt = clozeWordInSentence(sentence, hit.word);
    if (prompt === sentence) continue;
    usedVocab.add(searchFold(hit.word));
    questions.push({
      id: `q${questions.length + 1}`,
      type: 'cloze',
      prompt,
      meta: {
        answer: hit.word,
        accepted: unique([hit.word, searchFold(hit.word)]),
        dictTitleId: hit.id || null,
        sourceSentence: sentence,
      },
    });
  }

  // 2) Bir typed sense (anıqlama → lemma) — orın bolsa
  const sensePool = seededOrder(
    vocabulary.filter((item) => item.description && !usedVocab.has(searchFold(item.word))),
    `${seed}:sense`
  );
  if (sensePool.length && questions.length < count) {
    const entry = sensePool[0];
    usedVocab.add(searchFold(entry.word));
    coveredSense.add(searchFold(entry.word));
    questions.push({
      id: `q${questions.length + 1}`,
      type: 'sense',
      prompt: shortDesc(entry.description),
      meta: {
        answer: entry.word,
        accepted: unique([entry.word, searchFold(entry.word)]),
        dictTitleId: entry.id || null,
        sourceSentence: null,
      },
    });
  }

  // 3) Reverse — lemma → gloss typed (produce_reverse); gloss yaramasa sense_pick
  const described = vocabulary.filter((item) => item.description);
  if (described.length >= 2) {
    const pickPool = seededOrder(described, `${seed}:sense_pick`);
    for (const entry of pickPool) {
      if (questions.length >= count) break;
      const fold = searchFold(entry.word);
      if (coveredSense.has(fold)) continue;

      const glossAccepted = buildTutorGlossAccepted(entry.description);
      if (glossAccepted.length) {
        coveredSense.add(fold);
        questions.push({
          id: `q${questions.length + 1}`,
          type: 'produce_reverse',
          prompt: entry.word,
          meta: {
            answer: entry.word,
            accepted: glossAccepted,
            revealAnswer: glossAccepted[0],
            dictTitleId: entry.id || null,
            sourceSentence: null,
          },
        });
        break;
      }

      const correct = shortDesc(entry.description);
      const distractors = seededOrder(
        described.filter((v) => searchFold(v.word) !== fold),
        `${seed}:sense_pick_d:${fold}`
      )
        .map((v) => shortDesc(v.description))
        .filter((d) => d && searchFold(d) !== searchFold(correct));
      const uniqueDistractors = [];
      for (const d of distractors) {
        if (uniqueDistractors.some((x) => searchFold(x) === searchFold(d))) continue;
        uniqueDistractors.push(d);
        if (uniqueDistractors.length >= 3) break;
      }
      if (!uniqueDistractors.length) continue;
      const options = seededOrder(
        [correct, ...uniqueDistractors],
        `${seed}:sense_pick_o:${fold}`
      );
      coveredSense.add(fold);
      questions.push({
        id: `q${questions.length + 1}`,
        type: 'sense_pick',
        prompt: entry.word,
        options,
        meta: {
          answerIndex: options.indexOf(correct),
          answer: entry.word,
          dictTitleId: entry.id || null,
          sourceSentence: null,
        },
      });
      break;
    }
  }

  // 4) Qosımsha typed sense — qalǵan orın
  if (questions.length < count) {
    for (const entry of seededOrder(vocabulary, `${seed}:sense2`)) {
      if (questions.length >= count) break;
      if (!entry.description) continue;
      const fold = searchFold(entry.word);
      if (coveredSense.has(fold)) continue;
      coveredSense.add(fold);
      questions.push({
        id: `q${questions.length + 1}`,
        type: 'sense',
        prompt: shortDesc(entry.description),
        meta: {
          answer: entry.word,
          accepted: unique([entry.word, searchFold(entry.word)]),
          dictTitleId: entry.id || null,
          sourceSentence: null,
        },
      });
    }
  }

  // 5) Vocab joq / jetkiliksiz — gáp saylaw (comprehension), unlinked cloze JOQ
  if (questions.length < count && sentences.length >= 2) {
    const answerSentence = seededOrder(sentences, `${seed}:focus`)[0];
    const distractors = seededOrder(
      sentences.filter((sentence) => sentence !== answerSentence),
      `${seed}:distractors`
    ).slice(0, 3);
    if (distractors.length) {
      const options = seededOrder([answerSentence, ...distractors], `${seed}:options`);
      questions.push({
        id: `q${questions.length + 1}`,
        type: 'choice',
        prompt: 'Bólimde tuwrıdan-tuwrı berilgen gápti saylań.',
        options,
        meta: {
          answerIndex: options.indexOf(answerSentence),
          sourceSentence: answerSentence,
        },
      });
    }
  }

  return questions.slice(0, count);
}

function extractWriterContext(writer, seed) {
  if (!writer) return null;
  const bio = String(writer.bio || writer.biography || '').trim();
  const bioSentences = splitSentences(bio);
  return {
    name: String(writer.name || writer.fullName || '').trim(),
    bio: extractiveSummary(bioSentences, `${seed}:writer`, 2),
    source: bio ? 'imported-biography' : 'imported-writer-record',
  };
}

export function stripLessonSecrets(value) {
  if (Array.isArray(value)) return value.map(stripLessonSecrets);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'meta' || key === 'answer' || key === 'answerIndex' || key === 'accepted' || key === 'revealAnswer') continue;
    clean[key] = stripLessonSecrets(child);
  }
  return clean;
}

export function buildReadingLesson({
  bookId,
  sectionIndex = 0,
  sectionTitle = '',
  paragraphs = [],
  dictionaryEntries = [],
  writer = null,
  questionCount = 4,
  seed,
}) {
  const sourceText = (Array.isArray(paragraphs) ? paragraphs : [paragraphs])
    .map((paragraph) => String(paragraph || '').trim())
    .filter(Boolean)
    .join('\n');
  const sentences = splitSentences(sourceText);
  if (!sentences.length) {
    throw Object.assign(new Error('Bólim tekstinde dars dúziwge jetkilikli gápler joq'), {
      statusCode: 422,
    });
  }

  const lessonSeed = seed || `${bookId}:${sectionIndex}:${sourceText}`;
  const summary = extractiveSummary(sentences, lessonSeed, 3);
  const vocabulary = selectVocabulary(sourceText, dictionaryEntries, lessonSeed, 6);
  const focusPhrases = seededOrder(
    unique(sourceWords(sourceText).filter((word) => word.length >= 4)),
    `${lessonSeed}:focus-phrases`
  ).slice(0, 5);
  const questions = makeQuestions({
    sentences,
    vocabulary,
    seed: lessonSeed,
    count: questionCount,
  });

  return {
    engine: READING_ENGINE,
    source: { bookId: String(bookId), sectionIndex: Number(sectionIndex), sectionTitle },
    summary,
    vocabulary,
    lowVocab: vocabulary.length < 2,
    writerContext: extractWriterContext(writer, lessonSeed),
    explanation: summary[0] || '',
    focusPhrases,
    questions,
  };
}

export function gradeReadingAnswer(question, submitted) {
  return gradeReadingSubmission(question, submitted).correct;
}

/** Soft detail — nearMiss flag ushın. */
export function gradeReadingSubmission(question, submitted) {
  if (!question?.meta) return { correct: false, nearMiss: false };
  if (question.type === 'choice' || question.type === 'sense_pick') {
    const correct =
      Number.isInteger(Number(submitted)) &&
      Number(submitted) === Number(question.meta.answerIndex);
    return { correct, nearMiss: false };
  }
  const accepted = Array.isArray(question.meta.accepted) ? question.meta.accepted : [];
  if (!accepted.length) return { correct: false, nearMiss: false };
  if (question.type === 'produce_reverse') {
    return gradeGlossProduceSubmission(accepted, submitted);
  }
  // cloze + sense production
  return gradeProduceSubmission(accepted, submitted);
}
