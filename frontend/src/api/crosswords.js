import { getAnonymousId } from '../lib/anonymousId';
import { apiHeaders } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';
import {
  clearAdminToken as clearSharedAdminToken,
  getAdminToken as getSharedAdminToken,
  setAdminToken as setSharedAdminToken,
} from './admin';

const API_BASE = '/api/crosswords';

export function getAdminToken() {
  return getSharedAdminToken() || (() => {
    try {
      return sessionStorage.getItem('crosswords:adminToken') || '';
    } catch {
      return '';
    }
  })();
}

export function setAdminToken(token) {
  setSharedAdminToken(token);
}

export function clearAdminToken() {
  clearSharedAdminToken();
}

async function request(path, options = {}) {
  const headers = apiHeaders({
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  });
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

async function adminRequest(path, options = {}) {
  const token = getAdminToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  try {
    return await request(path, { ...options, headers });
  } catch (err) {
    if (String(err.message || '').includes('401') || String(err.message || '').includes('Admin')) {
      clearAdminToken();
    }
    throw err;
  }
}

export async function fetchCrosswords() {
  return request('');
}

export async function fetchCrosswordById(id) {
  return request(`/${encodeURIComponent(id)}`);
}

export async function guessCrossword(id, { wordIndex, answer }) {
  return request(`/${encodeURIComponent(id)}/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wordIndex, answer }),
  });
}

export async function completeCrossword(id, { seconds, score } = {}) {
  return request(`/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seconds, score }),
  });
}

export async function fetchMyCrosswordStats(limit = 20) {
  return request(`/stats/me?limit=${encodeURIComponent(limit)}`);
}

export async function adminLogin({ email, password } = {}) {
  const body = email ? { email, password } : { password };
  const data = await request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (data.token) setAdminToken(data.token);
  return data;
}

export async function adminListCrosswords({
  q = '',
  difficulty = '',
  published = '',
  page = 1,
  limit = 40,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (difficulty) params.set('difficulty', difficulty);
  if (published !== '' && published != null) params.set('published', String(published));
  params.set('page', String(page));
  params.set('limit', String(limit));
  return adminRequest(`/admin/list?${params.toString()}`);
}

export async function adminGetCrossword(id) {
  return adminRequest(`/admin/${encodeURIComponent(id)}`);
}

export async function adminCreateCrossword(payload) {
  return adminRequest('/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateCrossword(id, payload) {
  return adminRequest(`/admin/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteCrossword(id) {
  return adminRequest(`/admin/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
