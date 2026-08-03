import { apiHeaders } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

async function request(path, options = {}) {
  const headers = apiHeaders(options.headers || {});
  const res = await fetch(`/api/quizzes${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw makeApiError(data, res.status);
  }
  return data;
}

export async function fetchQuizzes() {
  return request('');
}

export async function fetchQuizById(id) {
  return request(`/${encodeURIComponent(id)}`);
}

export async function submitQuiz(id, answers) {
  return request(`/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
}

export async function startQuizAttempt(id, { ageConsent = false, ageYears = null } = {}) {
  return request(`/${encodeURIComponent(id)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ageConsent, ageYears }),
  });
}

export async function fetchActiveAttempt(quizId) {
  return request(`/${encodeURIComponent(quizId)}/active`);
}

export async function fetchAttempt(attemptId) {
  return request(`/attempts/${encodeURIComponent(attemptId)}`);
}

export async function fetchMyAttempts(limit = 30, { detailed = false } = {}) {
  const q = detailed ? '&detailed=1' : '';
  return request(`/attempts?limit=${encodeURIComponent(limit)}${q}`);
}

export async function fetchQuizStatistics() {
  return request('/statistics/me');
}

export async function deleteMyData() {
  return request('/privacy/me', { method: 'DELETE' });
}

export async function viewAttemptQuestion(attemptId, position) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

export async function answerAttemptQuestion(attemptId, { questionId, optionIndex, timeSpentMs }) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, optionIndex, timeSpentMs }),
  });
}

export async function finalizeAttempt(attemptId, { partial = false } = {}) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partial }),
  });
}

export async function fetchAttemptResult(attemptId) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/result`);
}

export async function saveAgeConsent({ consent, ageYears }) {
  return request('/privacy/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent, ageYears }),
  });
}

export async function startAdaptiveQuiz({ skill = 'global', maxItems = 10, forceNew = false } = {}) {
  return request('/adaptive/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill, maxItems, forceNew: Boolean(forceNew) }),
  });
}

export async function answerAdaptiveQuiz(attemptId, { questionId, optionIndex, timeSpentMs }) {
  return request(`/adaptive/${encodeURIComponent(attemptId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, optionIndex, timeSpentMs }),
  });
}

export async function abandonAdaptiveQuiz(attemptId) {
  return request(`/adaptive/${encodeURIComponent(attemptId)}/abandon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function fetchAbility(skill = 'global') {
  return request(`/ability?skill=${encodeURIComponent(skill)}`);
}

export async function joinAnswerReviewWaitlist(attemptId = null) {
  return request('/products/answer-review/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attemptId }),
  });
}

export async function fetchReviewStatus(attemptId) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/review-status`);
}

export async function unlockAnswerReview(attemptId) {
  return request(`/attempts/${encodeURIComponent(attemptId)}/unlock-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export async function fetchAnswerReview(attemptId, { scope = 'full' } = {}) {
  const q = scope === 'mistakes' ? '?scope=mistakes' : '';
  return request(`/attempts/${encodeURIComponent(attemptId)}/review${q}`);
}
