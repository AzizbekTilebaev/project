import { getAnonymousId } from '../lib/anonymousId';
import { isSafeMediaUrl } from '../lib/safeUrl';
import {
  clearAdminToken as clearSharedAdminToken,
  getAdminToken as getSharedAdminToken,
  setAdminToken as setSharedAdminToken,
} from './admin';

const API_BASE = '/api/books';

export function getAdminToken() {
  return getSharedAdminToken() || (() => {
    try {
      return sessionStorage.getItem('books:adminToken') || '';
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
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `Server qáteligi: ${res.status}`);
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
    if (String(err.message || '').includes('Admin ruxsat') || String(err.message || '').includes('401')) {
      clearAdminToken();
    }
    throw err;
  }
}

export async function fetchBooks() {
  return request('');
}

export async function fetchBookById(id) {
  return request(`/${encodeURIComponent(id)}`);
}

export async function adminListBooks({
  q = '',
  orphansOnly = false,
  hiddenOnly = false,
  importStatus = '',
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (orphansOnly) params.set('orphans', '1');
  if (hiddenOnly) params.set('hidden', '1');
  if (importStatus) params.set('importStatus', importStatus);
  const qs = params.toString();
  return adminRequest(`/admin/list${qs ? `?${qs}` : ''}`);
}

export async function adminFetchBook(id) {
  return adminRequest(`/admin/${encodeURIComponent(id)}`);
}

export function bookFileUrl(id, { download = false, fileAccess = null } = {}) {
  if (fileAccess?.url && isSafeMediaUrl(fileAccess.url)) {
    const join = fileAccess.url.includes('?') ? '&' : '?';
    return download ? `${fileAccess.url}${join}download=1` : fileAccess.url;
  }
  const q = download ? '?download=1' : '';
  return `${API_BASE}/${encodeURIComponent(id)}/file${q}`;
}

export async function fetchMyBookProgress() {
  return request('/progress/me');
}

export async function saveBookProgress(id, progress) {
  return request(`/${encodeURIComponent(id)}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  });
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

export async function adminCreateBook(payload, file) {
  if (file) {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'sections') fd.append(k, JSON.stringify(v));
      else fd.append(k, String(v));
    });
    fd.append('file', file);
    return adminRequest('', { method: 'POST', body: fd });
  }
  return adminRequest('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateBook(id, payload, file) {
  if (file) {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'sections') fd.append(k, JSON.stringify(v));
      else fd.append(k, String(v));
    });
    fd.append('file', file);
    return adminRequest(`/${encodeURIComponent(id)}`, { method: 'PUT', body: fd });
  }
  return adminRequest(`/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminHideBook(id) {
  return adminRequest(`/${encodeURIComponent(id)}/hide`, { method: 'POST' });
}

export async function adminRestoreBook(id) {
  return adminRequest(`/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

export async function adminLinkBookWriter(bookId, { writerId, role = 'author' } = {}) {
  return adminRequest(`/${encodeURIComponent(bookId)}/writers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writerId, role }),
  });
}

export async function adminUnlinkBookWriter(bookId, writerId) {
  return adminRequest(
    `/${encodeURIComponent(bookId)}/writers/${encodeURIComponent(writerId)}`,
    { method: 'DELETE' }
  );
}

export async function adminDeleteBook(id) {
  return adminRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
