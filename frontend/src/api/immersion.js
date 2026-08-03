import { getAnonymousId } from '../lib/anonymousId';
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from './admin';

export { getAdminToken, setAdminToken, clearAdminToken };

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
    ...options.headers,
  };
  const res = await fetch(`/api/immersion${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Server qáteligi: ${res.status}`);
  return data;
}

async function adminRequest(path, options = {}) {
  const token = getAdminToken();
  try {
    return await request(path, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (err) {
    if (err?.status === 401 || /401|Kiriw|ruxsat/i.test(String(err.message || ''))) {
      clearAdminToken();
    }
    throw err;
  }
}

export async function fetchWordImmersion(titleId) {
  return request(`/word/${encodeURIComponent(titleId)}`);
}

export async function fetchReadyImmersion({
  limit = 40,
  offset = 0,
  q = '',
  letter = '',
  kind = '',
} = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (q) params.set('q', String(q).trim().slice(0, 80));
  if (letter) params.set('letter', String(letter).trim().slice(0, 8));
  if (kind) params.set('kind', String(kind).trim());
  return request(`/ready?${params}`);
}

/** Authed: tıńlaw → server SRS introduce (guest — soft fail). */
export function seedImmersionListen(titleId, { prompt } = {}) {
  return request('/listen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titleId,
      ...(prompt != null ? { prompt } : {}),
    }),
  });
}

/** Authed: tıńlawdan keyin typed produce (guest — soft fail). */
export function submitImmersionProduce(titleId, { answer, prompt } = {}) {
  return request('/produce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titleId,
      answer,
      ...(prompt != null ? { prompt } : {}),
    }),
  });
}

export async function adminListImmersion({ q = '', orphansOnly = false } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (orphansOnly) params.set('orphans', '1');
  const qs = params.toString();
  return adminRequest(`/admin/list${qs ? `?${qs}` : ''}`);
}

export async function adminUploadImmersion({ titleId, role = 'primary', file }) {
  const fd = new FormData();
  fd.append('file', file);
  if (titleId) fd.append('titleId', titleId);
  fd.append('role', role);
  return adminRequest('/admin', { method: 'POST', body: fd });
}

export async function adminReattachImmersion(id, { titleId, role } = {}) {
  const body = {};
  if (titleId != null) body.titleId = titleId;
  if (role != null) body.role = role;
  return adminRequest(`/admin/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function adminDeleteImmersion(id) {
  return adminRequest(`/admin/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
