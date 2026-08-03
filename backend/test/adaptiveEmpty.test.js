/**
 * Adaptive empty-bank remediation payload.
 * Run: node --test --test-force-exit test/adaptiveEmpty.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdaptiveEmptyPayload,
  buildAdaptiveBankExhaustedMeta,
} from '../src/services/adaptiveQuizService.js';

describe('buildAdaptiveEmptyPayload', () => {
  it('seed — primary quiz', () => {
    const p = buildAdaptiveEmptyPayload({ hasMistakes: false });
    assert.equal(p.reason, 'empty_bank');
    assert.equal(p.code, 'ADAPTIVE_EMPTY_BANK');
    assert.equal(p.remediation, 'seed');
    assert.equal(p.practiceLinks.primary, '/quiz');
    assert.ok(p.practiceLinks.tutor);
    assert.ok(p.practiceLinks.mistakes);
  });

  it('mistakes — primary produce-first Tutor', () => {
    const p = buildAdaptiveEmptyPayload({ hasMistakes: true });
    assert.equal(p.remediation, 'mistakes');
    assert.equal(p.practiceLinks.primary, '/tutor');
    assert.equal(p.practiceLinks.mistakes, '/tutor');
    assert.equal(p.practiceLinks.practice, '/tutor/practice?from=quiz');
  });
});

describe('buildAdaptiveBankExhaustedMeta', () => {
  it('earlyEnd + bank_exhausted', () => {
    const m = buildAdaptiveBankExhaustedMeta();
    assert.equal(m.earlyEnd, true);
    assert.equal(m.reason, 'bank_exhausted');
    assert.ok(m.practiceLinks.quiz);
  });
});
