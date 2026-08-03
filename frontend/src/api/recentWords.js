import { getAnonymousId } from '../lib/anonymousId';
import { getStoredAuthToken } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/recent-words${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}

export async function fetchRecentWords() {
  return request('/');
}

export async function syncRecentWords(items) {
  return request('/sync', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function addRecentWord(entry) {
  return request('/', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function clearRecentWords() {
  return request('/', { method: 'DELETE' });
}

