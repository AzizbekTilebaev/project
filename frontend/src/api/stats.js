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

  const res = await fetch(`/api/stats${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}

export async function fetchMyActivity({ days = 90, period = 'week' } = {}) {
  return request(`/me/activity?days=${encodeURIComponent(days)}&period=${encodeURIComponent(period)}`);
}

export async function fetchSiteStats({ period = 'week' } = {}) {
  return request(`/site?period=${encodeURIComponent(period)}`);
}

export async function postHeartbeat({ surface = 'app', durationMs = 30000 } = {}) {
  return request('/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ surface, durationMs }),
  });
}
