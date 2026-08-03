import { buildLocalLesson } from '../src/services/localTutorAiService.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('localTutorAiService', () => {
  it('builds lesson without answer fields', () => {
    const lesson = buildLocalLesson({
      prompt: '"Asp" sozi qaysi hayvon?',
      wrongCount: 4,
      source: 'adaptive',
      word: 'Asp',
      definition: 'Jılan túri',
      example: 'Asp shólde jasaydı.',
    });
    assert.equal(lesson.engine, 'local-tutor-v1');
    assert.equal(lesson.focus, 'Asp');
    assert.ok(lesson.tip.includes('Asp'));
    assert.ok(lesson.example.includes('Asp'));
    assert.equal(lesson.correctAnswer, undefined);
    assert.equal(lesson.answer, undefined);
  });

  it('falls back to prompt focus', () => {
    const lesson = buildLocalLesson({ prompt: 'Qaraqalpaq tili', wrongCount: 1 });
    assert.ok(lesson.focus);
    assert.ok(lesson.tip);
  });

  it('produce_reverse mode — anıqlama tip/example da jasırın', () => {
    const lesson = buildLocalLesson({
      mode: 'produce_reverse',
      word: 'Mektep',
      definition: 'Bala oqıytuǵın orın',
      example: 'Mektepke bardım.',
      source: 'reading',
      wrongCount: 2,
    });
    assert.equal(lesson.focus, 'Sóz → anıqlama');
    assert.equal(lesson.example, null);
    assert.equal(lesson.tip.includes('Bala oqıytuǵın'), false);
    assert.ok(lesson.practice.includes('jazıń'));
  });

  it('produce mode — lemma tip/example da jasırın', () => {
    const lesson = buildLocalLesson({
      mode: 'produce',
      word: 'Mektep',
      definition: 'Bala oqıytuǵın orın',
      example: 'Mektepke bardım.',
      source: 'reading',
      wrongCount: 2,
    });
    assert.equal(lesson.focus, 'Anıqlama → sóz');
    assert.ok(lesson.example.includes('Bala'));
    assert.equal(lesson.example.includes('Mektep'), false);
    assert.equal(lesson.tip.includes('Mektep'), false);
    assert.ok(lesson.practice.includes('jazıń'));
  });
});
