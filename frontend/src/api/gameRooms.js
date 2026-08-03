import { apiHeaders } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

async function request(path, options = {}) {
  const headers = {
    ...apiHeaders(),
    ...options.headers,
  };
  const res = await fetch(`/api/rooms${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw makeApiError(data, res.status);
  }
  return data;
}

export async function createRoom({
  gameType,
  mode,
  contentId,
  displayName,
  maxPlayers = 4,
}) {
  return request('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameType, mode, contentId, displayName, maxPlayers }),
  });
}

export async function listOpenRooms({ gameType = '', limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (gameType) params.set('gameType', String(gameType));
  return request(`/open?${params}`);
}

export async function joinRoom({ code, displayName }) {
  return request('/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, displayName }),
  });
}

export async function fetchRoom(code) {
  return request(`/${encodeURIComponent(code)}`);
}

export async function setRoomReady(code, ready) {
  return request(`/${encodeURIComponent(code)}/ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ready }),
  });
}

export async function leaveRoom(code) {
  return request(`/${encodeURIComponent(code)}/leave`, {
    method: 'POST',
  });
}

export async function startRoom(code) {
  return request(`/${encodeURIComponent(code)}/start`, {
    method: 'POST',
  });
}

export async function fetchRoomQuiz(code) {
  return request(`/${encodeURIComponent(code)}/quiz`);
}

export async function answerRoomQuiz(code, { questionId, optionIndex, timeSpentMs }) {
  return request(`/${encodeURIComponent(code)}/quiz/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, optionIndex, timeSpentMs }),
  });
}

export async function guessRoomCrossword(code, { wordIndex, answer }) {
  return request(`/${encodeURIComponent(code)}/crossword/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordIndex, answer }),
  });
}
