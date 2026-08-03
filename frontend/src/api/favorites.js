import { getAnonymousId } from '../lib/anonymousId';
import { getStoredAuthToken } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...options.headers,
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/favorites${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}

export async function fetchFavorites() {
  return request('/');
}

export async function syncFavorites(items) {
  return request('/sync', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function addFavorite(entry) {
  return request('/', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function removeFavorite(titleId) {
  return request(`/${encodeURIComponent(titleId)}`, { method: 'DELETE' });
}

export async function clearFavorites() {
  return request('/', { method: 'DELETE' });
}
