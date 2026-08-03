import { getAnonymousId } from '../lib/anonymousId';
import { getStoredAuthToken } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

const API_BASE = '/api/tusindirme';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw makeApiError(data, res.status);
  }
  return data;
}

export async function fetchCurated() {
  return request('/curated');
}

export async function searchWords(q, limit = 24, options = {}) {
  const query = encodeURIComponent(q.trim());
  return request(`/search?q=${query}&limit=${limit}`, options);
}

export async function fetchWordById(id) {
  return request(`/soz/${encodeURIComponent(id)}`);
}

export async function fetchRandomWord() {
  return request('/random');
}

export async function fetchAlphabet() {
  return request('/alphabet');
}

export async function fetchByLetter(letter, page = 1, limit = 40, options = {}) {
  const lit = encodeURIComponent(letter);
  return request(`/letter/${lit}?page=${page}&limit=${limit}`, options);
}

export async function fetchWordOfDay() {
  return request('/word-of-day');
}

function tzOffset() {
  return -new Date().getTimezoneOffset();
}

export async function fetchWordOfDayCheckin() {
  const q = new URLSearchParams({ tzOffset: String(tzOffset()) });
  return request(`/word-of-day/checkin?${q}`);
}

export async function claimWordOfDayCheckin() {
  return request('/word-of-day/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tzOffset: tzOffset() }),
  });
}

export async function claimComboChest(chestId) {
  return request('/word-of-day/chest/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chestId, tzOffset: tzOffset() }),
  });
}

export async function fetchDashboard() {
  return request('/dashboard');
}

export async function fetchQuiz(count = 10, { titleIds, source } = {}) {
  const body = { count };
  if (Array.isArray(titleIds) && titleIds.length) {
    body.titleIds = titleIds.map(String).filter(Boolean).slice(0, 40);
  }
  if (source) body.source = source;
  return request(`/quiz/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function checkDictQuizAnswer(roundId, { questionId, optionIndex, answer }) {
  return request(`/quiz/${encodeURIComponent(roundId)}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionId,
      ...(optionIndex != null ? { optionIndex } : {}),
      ...(answer != null ? { answer } : {}),
    }),
  });
}

export async function finalizeDictQuiz(roundId, answers) {
  return request(`/quiz/${encodeURIComponent(roundId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
}

export async function fetchDictQuizHistory(limit = 20) {
  return request(`/quiz/history?limit=${encodeURIComponent(limit)}`);
}

export async function fetchPosList() {
  return request('/pos');
}

export async function fetchThemeList() {
  return request('/themes');
}

/** Barcha so'zlar — pos yoki theme filter bilan */
export async function fetchAllWords(
  { page = 1, limit = 40, pos, theme } = {},
  options = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (pos) params.set('pos', pos);
  if (theme) params.set('theme', theme);
  return request(`/sozler?${params}`, options);
}

export async function fetchSuggestions({ descriptionId, mainTitleId, limit = 20 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (descriptionId) params.set('descriptionId', descriptionId);
  if (mainTitleId) params.set('mainTitleId', mainTitleId);
  return request(`/suggestions?${params}`);
}

export async function fetchMySuggestions({ status = 'all', limit = 30 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    status: String(status || 'all'),
  });
  return request(`/suggestions/mine?${params}`);
}

export async function createSuggestion(body) {
  return request('/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function voteSuggestion(id, vote) {
  return request(`/suggestions/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vote }),
  });
}
