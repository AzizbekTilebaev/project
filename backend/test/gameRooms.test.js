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

describe('game rooms', () => {
  let healthy = false;

  before(async () => {
    try {
      const res = await fetch(`${BASE}/api/health`);
      healthy = res.ok;
    } catch {
      healthy = false;
    }
  });

  it('creates and joins a quiz room (2–4)', async (t) => {
    if (!healthy) {
      t.skip('server not running');
      return;
    }

    const host = anon();
    const guest = anon();

    const quizzes = await api('/api/quizzes', { anonymousId: host });
    const quizId = quizzes.data.quizzes?.[0]?.id;
    if (!quizId) {
      t.skip('no quizzes seeded');
      return;
    }

    const created = await api('/api/rooms', {
      method: 'POST',
      anonymousId: host,
      body: {
        gameType: 'quiz',
        mode: 'race',
        contentId: quizId,
        displayName: 'Host',
        maxPlayers: 3,
      },
    });
    assert.equal(created.res.status, 201);
    assert.equal(created.data.room.maxPlayers, 3);
    assert.equal(created.data.room.members.length, 1);
    assert.ok(created.data.room.youMemberId);

    const code = created.data.room.code;
    const joined = await api('/api/rooms/join', {
      method: 'POST',
      anonymousId: guest,
      body: { code, displayName: 'Guest' },
    });
    assert.equal(joined.res.status, 200);
    assert.equal(joined.data.room.members.length, 2);

    await api(`/api/rooms/${code}/ready`, {
      method: 'POST',
      anonymousId: host,
      body: { ready: true },
    });
    await api(`/api/rooms/${code}/ready`, {
      method: 'POST',
      anonymousId: guest,
      body: { ready: true },
    });

    const started = await api(`/api/rooms/${code}/start`, {
      method: 'POST',
      anonymousId: host,
    });
    assert.equal(started.res.status, 200);
    assert.equal(started.data.room.status, 'in_progress');

    const guestStart = await api(`/api/rooms/${code}/start`, {
      method: 'POST',
      anonymousId: guest,
    });
    assert.ok(guestStart.res.status >= 400);

    const quizState = await api(`/api/rooms/${code}/quiz`, { anonymousId: guest });
    assert.equal(quizState.res.status, 200);
    assert.ok(quizState.data.attempt?.questions?.length);
    assert.equal(
      quizState.data.attempt.questions[0].correctAnswer,
      undefined
    );
  });

  it('rejects over-capacity joins', async (t) => {
    if (!healthy) {
      t.skip('server not running');
      return;
    }
    const quizzes = await api('/api/quizzes');
    const quizId = quizzes.data.quizzes?.[0]?.id;
    if (!quizId) {
      t.skip('no quizzes');
      return;
    }
    const a = anon();
    const b = anon();
    const c = anon();
    const created = await api('/api/rooms', {
      method: 'POST',
      anonymousId: a,
      body: {
        gameType: 'quiz',
        mode: 'sync',
        contentId: quizId,
        displayName: 'A',
        maxPlayers: 2,
      },
    });
    const code = created.data.room.code;
    await api('/api/rooms/join', {
      method: 'POST',
      anonymousId: b,
      body: { code, displayName: 'B' },
    });
    const overflow = await api('/api/rooms/join', {
      method: 'POST',
      anonymousId: c,
      body: { code, displayName: 'C' },
    });
    assert.equal(overflow.res.status, 409);
  });

  it('lists open lobbies for discover', async (t) => {
    if (!healthy) {
      t.skip('server not running');
      return;
    }

    const host = anon();
    const quizzes = await api('/api/quizzes', { anonymousId: host });
    const quizId = quizzes.data.quizzes?.[0]?.id;
    if (!quizId) {
      t.skip('no quizzes seeded');
      return;
    }

    const created = await api('/api/rooms', {
      method: 'POST',
      anonymousId: host,
      body: {
        gameType: 'quiz',
        mode: 'race',
        contentId: quizId,
        displayName: 'DiscoverHost',
        maxPlayers: 4,
      },
    });
    assert.equal(created.res.status, 201);
    const code = created.data.room.code;

    const listed = await api('/api/rooms/open?gameType=quiz', { anonymousId: anon() });
    assert.equal(listed.res.status, 200);
    assert.ok(Array.isArray(listed.data.lobbies));
    assert.ok(listed.data.lobbies.some((l) => l.code === code));
  });
});
