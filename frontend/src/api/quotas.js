import { getAnonymousId } from '../lib/anonymousId';
import { getStoredAuthToken } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/quotas${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}

export async function fetchMyQuotas() {
  return request('/me');
}

export async function recordWordView(wordId) {
  return request('/word-view', {
    method: 'POST',
    body: JSON.stringify({ wordId }),
  });
}
