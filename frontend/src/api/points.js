import { apiHeaders } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

async function request(path, options = {}) {
  const res = await fetch(`/api/points${path}`, {
    ...options,
    headers: apiHeaders({
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw makeApiError(data, res.status);
  }
  return data;
}

export async function fetchMyPoints() {
  return request('/me');
}

export async function fetchPointsHistory(limit = 50) {
  return request(`/me/history?limit=${encodeURIComponent(limit)}`);
}

export async function fetchLeaderboard(limit = 20) {
  return request(`/leaderboard?limit=${encodeURIComponent(limit)}`);
}

export async function saveLeaderboardProfile({ nickname, optIn }) {
  return request('/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname, optIn }),
  });
}
