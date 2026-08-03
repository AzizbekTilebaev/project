import { getAnonymousId } from '../lib/anonymousId';
import { getAdminToken } from './books';

const API_BASE = '/api/reading';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `Server qáteligi: ${response.status}`);
  }
  return data;
}

function json(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  };
}

export function fetchReadingLesson(bookId, sectionIndex) {
  return request(
    `/books/${encodeURIComponent(bookId)}/sections/${Number(sectionIndex)}/lesson`
  );
}

export function startReadingSession(bookId, sectionIndex) {
  return request('/sessions', json('POST', { bookId, sectionIndex }));
}

export function fetchReadingSession(sessionId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}`);
}

export function answerReadingQuestion(sessionId, questionId, answer) {
  return request(
    `/sessions/${encodeURIComponent(sessionId)}/answer`,
    json('POST', { questionId, answer })
  );
}

export function completeReadingSession(sessionId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/complete`, json('POST'));
}

export function fetchReadingProgress() {
  return request('/progress/me');
}

export function fetchReadingLessonSrs() {
  return request('/srs/me');
}

export function fetchAdminReadingLessons() {
  return request('/admin/lessons', {
    headers: { Authorization: `Bearer ${getAdminToken()}` },
  });
}

export function saveAdminReadingLesson(payload) {
  const id = payload?.id;
  const path = id ? `/admin/lessons/${encodeURIComponent(id)}` : '/admin/lessons';
  return request(path, {
    ...json(id ? 'PUT' : 'POST', payload),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken()}`,
    },
  });
}

export function deleteAdminReadingLesson(id) {
  return request(`/admin/lessons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getAdminToken()}` },
  });
}
