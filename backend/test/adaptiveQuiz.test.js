import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:5000';

function anon() {
  return crypto.randomUUID();
}

async function api(path, { method = 'GET', body, anonymousId } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Anonymous-Id': anonymousId || anon(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

describe('adaptive quiz live', () => {
  let healthy = false;
  before(async () => {
    try {
      const res = await fetch(`${BASE}/api/health`);
      healthy = res.ok;
    } catch {
      healthy = false;
    }
  });

  it('starts adaptive attempt without leaking answers', async (t) => {
    if (!healthy) {
      t.skip('server not running');
      return;
    }
    const id = anon();
    const started = await api('/api/quizzes/adaptive/start', {
      method: 'POST',
      anonymousId: id,
      body: { skill: 'global', maxItems: 3 },
    });
    assert.equal(started.res.status, 201);
    assert.ok(started.data.attempt?.question?.options?.length);
    assert.equal(started.data.attempt.question.correctAnswer, undefined);
    assert.equal(started.data.attempt.question.correct, undefined);

    const answered = await api(
      `/api/quizzes/adaptive/${started.data.attempt.attemptId}/answer`,
      {
        method: 'POST',
        anonymousId: id,
        body: {
          questionId: started.data.attempt.question.id,
          optionIndex: 0,
        },
      }
    );
    assert.equal(answered.res.status, 200);
    assert.equal(typeof answered.data.correct, 'boolean');
    assert.equal(answered.data.correctAnswer, undefined);
    assert.equal(answered.data.correctIndex, undefined);
    assert.equal(typeof answered.data.thetaDelta, 'number');
    if (answered.data.done) {
      assert.equal(typeof answered.data.sessionThetaDelta, 'number');
    } else {
      assert.ok(['easier', 'similar', 'harder'].includes(answered.data.nextDifficultyHint));
      assert.equal(answered.data.question?.correctAnswer, undefined);
    }

    const ability = await api('/api/quizzes/ability', { anonymousId: id });
    assert.equal(ability.res.status, 200);
    assert.ok(ability.data.ability);
  });
});
