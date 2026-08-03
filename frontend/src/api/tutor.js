import { getAnonymousId } from '../lib/anonymousId';
import { syncTutorContinueFromReminder } from '../lib/tutorProgress';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const res = await fetch(`/api/tutor${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Server qáteligi: ${res.status}`);
  }
  return data;
}

function tzOffset() {
  return -new Date().getTimezoneOffset();
}

export async function fetchDailyTutor({ force = false } = {}) {
  const q = new URLSearchParams({
    tzOffset: String(tzOffset()),
    ...(force ? { force: '1' } : {}),
  });
  return request(`/daily?${q}`);
}

export async function answerDailyTutor({ sessionId, mistakeId, optionIndex, answer }) {
  return request('/daily/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, mistakeId, optionIndex, answer }),
  });
}

export async function updateDailyTutorPlan({
  sessionId,
  orderedMistakeIds,
  scheduledTime,
  scheduledDays,
}) {
  return request('/daily/plan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, orderedMistakeIds, scheduledTime, scheduledDays }),
  });
}

export async function updateDailyTutorSchedule({ scheduledTime, scheduledDays }) {
  return request('/daily/schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledTime, scheduledDays }),
  });
}

export async function fetchMistakes() {
  return request('/mistakes');
}

export async function fetchTutorReminder() {
  const q = new URLSearchParams({ tzOffset: String(tzOffset()) });
  const data = await request(`/reminder?${q}`);
  syncTutorContinueFromReminder(data?.reminder || null);
  return data;
}
