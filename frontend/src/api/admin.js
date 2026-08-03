const API_BASE = '/api/admin';
const TOKEN_KEY = 'admin:token';

import { makeApiError } from '../lib/apiErrors';

export function getAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminToken(token) {
  try {
    const keys = [TOKEN_KEY, 'books:adminToken', 'crosswords:adminToken'];
    if (token) keys.forEach((key) => sessionStorage.setItem(key, token));
    else keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

export function clearAdminToken() {
  setAdminToken('');
}

async function requestAbsolute(url, options = {}) {
  const token = getAdminToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearAdminToken();
    throw makeApiError(data, res.status);
  }
  return data;
}

async function request(path, options = {}) {
  return requestAbsolute(`${API_BASE}${path}`, options);
}

/** email + parol (akkaunt) yoki faqat parol (legacy owner). */
export async function adminLogin({ email, password }) {
  const body = email ? { email, password } : { password };
  const data = await request('/login', { method: 'POST', body: JSON.stringify(body) });
  if (data.token) setAdminToken(data.token);
  return data;
}

export async function fetchAdminMe() {
  return request('/me');
}

export async function fetchAdminDashboard() {
  return request('/dashboard');
}

export async function fetchAdminLogs({ page = 1, limit = 25, level = '', search = '' } = {}) {
  const query = new URLSearchParams({ page, limit });
  if (level) query.set('level', level);
  if (search) query.set('search', search);
  return request(`/logs?${query.toString()}`);
}

export async function deleteAdminLog(id) {
  return request(`/logs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function cleanupAdminLogs(olderThanDays = 30) {
  return request('/logs/cleanup', {
    method: 'POST',
    body: JSON.stringify({ olderThanDays }),
  });
}

export async function changeOwnPassword(oldPassword, newPassword) {
  return request('/me/password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// ----- Foydalanuvchilar -----

export async function fetchUsersOverview() {
  return request('/users/overview');
}

export async function fetchUsers({
  page = 1,
  limit = 25,
  activeDays = '',
  sort = 'last_seen',
  q = '',
} = {}) {
  const params = new URLSearchParams({ page, limit, sort });
  if (activeDays) params.set('activeDays', activeDays);
  if (q) params.set('q', q);
  return request(`/users?${params.toString()}`);
}

export async function fetchUserDetail(id) {
  return request(`/users/${encodeURIComponent(id)}`);
}

export async function deleteUserData(id) {
  return request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchAdminQuizAttempts({
  page = 1,
  limit = 25,
  status = '',
  quizId = '',
  actorId = '',
  q = '',
  from = '',
  to = '',
} = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (quizId) params.set('quizId', quizId);
  if (actorId) params.set('actorId', String(actorId));
  if (q) params.set('q', q);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`/quiz-attempts?${params.toString()}`);
}

export async function fetchAttemptReviewAdmin(attemptId) {
  return request(`/quiz-attempts/${encodeURIComponent(attemptId)}/review`);
}

export async function forceExpireAttemptAdmin(attemptId) {
  return request(`/quiz-attempts/${encodeURIComponent(attemptId)}/force-expire`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function voidAttemptAdmin(attemptId, { reason = '' } = {}) {
  return request(`/quiz-attempts/${encodeURIComponent(attemptId)}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ----- Testler (quiz) boshqaruvi -----

export async function fetchAdminQuizzes({
  q = '',
  level = '',
  category = '',
  published = '',
  page = 1,
  limit = 50,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (level) params.set('level', level);
  if (category) params.set('category', category);
  if (published !== '' && published != null) params.set('published', String(published));
  params.set('page', String(page));
  params.set('limit', String(limit));
  return requestAbsolute(`/api/quizzes/admin/list?${params.toString()}`);
}

export async function fetchAdminQuiz(id) {
  return requestAbsolute(`/api/quizzes/admin/${encodeURIComponent(id)}`);
}

export async function createAdminQuiz(payload) {
  return requestAbsolute('/api/quizzes/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminQuiz(id, payload) {
  return requestAbsolute(`/api/quizzes/admin/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminQuiz(id) {
  return requestAbsolute(`/api/quizzes/admin/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ----- Jumbaqlar boshqaruvi -----

export async function fetchAdminJumbaqlar({ q = '', status = '', page = 1, limit = 24 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  params.set('page', page);
  params.set('limit', limit);
  return requestAbsolute(`/api/jumbaqlar/admin/list?${params.toString()}`);
}

export async function createAdminJumbaq(payload) {
  return requestAbsolute('/api/jumbaqlar/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminJumbaq(id, payload) {
  return requestAbsolute(`/api/jumbaqlar/admin/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminJumbaq(id) {
  return requestAbsolute(`/api/jumbaqlar/admin/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ----- Shoirlar (adebiyat) boshqaruvi -----

export async function fetchAdminWriters({
  q = '',
  status = '',
  geocode = '',
  page = 1,
  limit = 24,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (geocode) params.set('geocode', geocode);
  params.set('page', page);
  params.set('limit', limit);
  return requestAbsolute(`/api/literature/admin/writers?${params.toString()}`);
}

export async function fetchAdminWriter(id) {
  return requestAbsolute(`/api/literature/admin/writers/${encodeURIComponent(id)}`);
}

export async function createAdminWriter(payload) {
  return requestAbsolute('/api/literature/admin/writers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminWriter(id, payload) {
  return requestAbsolute(`/api/literature/admin/writers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminWriter(id) {
  return requestAbsolute(`/api/literature/admin/writers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function saveAdminCreativeWork(writerId, payload) {
  const workId = payload?.id;
  const url = workId
    ? `/api/literature/admin/writers/${encodeURIComponent(writerId)}/works/${encodeURIComponent(workId)}`
    : `/api/literature/admin/writers/${encodeURIComponent(writerId)}/works`;
  return requestAbsolute(url, {
    method: workId ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminCreativeWork(writerId, workId) {
  return requestAbsolute(
    `/api/literature/admin/writers/${encodeURIComponent(writerId)}/works/${encodeURIComponent(workId)}`,
    { method: 'DELETE' }
  );
}

export async function fetchAdminWriterPhotos(writerId) {
  return requestAbsolute(`/api/literature/admin/writers/${encodeURIComponent(writerId)}/photos`);
}

export async function uploadAdminWriterPhoto(writerId, { file, year, caption }) {
  const token = getAdminToken();
  const form = new FormData();
  if (file) form.append('photo', file);
  if (year !== '' && year != null) form.append('year', String(year));
  if (caption) form.append('caption', caption);
  const res = await fetch(`/api/literature/admin/writers/${encodeURIComponent(writerId)}/photos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearAdminToken();
    throw makeApiError(data, res.status);
  }
  return data;
}

export async function updateAdminWriterPhoto(writerId, photoId, payload) {
  return requestAbsolute(
    `/api/literature/admin/writers/${encodeURIComponent(writerId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  );
}

export async function deleteAdminWriterPhoto(writerId, photoId) {
  return requestAbsolute(
    `/api/literature/admin/writers/${encodeURIComponent(writerId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE' }
  );
}

// ----- Kitap asar bólekleri (literature_pieces) -----

export async function fetchAdminPieces({
  q = '',
  bookId = '',
  writerId = '',
  status = '',
  page = 1,
  limit = 40,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (bookId) params.set('bookId', bookId);
  if (writerId) params.set('writerId', String(writerId));
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return requestAbsolute(`/api/literature/admin/pieces?${params.toString()}`);
}

export async function fetchAdminPiece(id) {
  return requestAbsolute(`/api/literature/admin/pieces/${encodeURIComponent(id)}`);
}

export async function saveAdminPiece(payload) {
  const id = payload?.id;
  if (id) {
    return requestAbsolute(`/api/literature/admin/pieces/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
  return requestAbsolute('/api/literature/admin/pieces', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function hideAdminPiece(id) {
  return requestAbsolute(`/api/literature/admin/pieces/${encodeURIComponent(id)}/hide`, {
    method: 'POST',
  });
}

export async function restoreAdminPiece(id) {
  return requestAbsolute(`/api/literature/admin/pieces/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
  });
}

export async function deleteAdminPiece(id) {
  return requestAbsolute(`/api/literature/admin/pieces/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ----- Takliflar moderatsiyasi -----

export async function fetchPendingSuggestions(limit = 50) {
  return requestAbsolute(`/api/tusindirme/suggestions?limit=${encodeURIComponent(limit)}`);
}

export async function fetchModeratorSuggestions({
  status = 'pending',
  type = '',
  page = 1,
  limit = 30,
} = {}) {
  const params = new URLSearchParams({
    status: String(status),
    page: String(page),
    limit: String(limit),
  });
  if (type) params.set('type', type);
  return requestAbsolute(`/api/tusindirme/suggestions/moderation?${params.toString()}`);
}

export async function moderateSuggestion(id, { approve, note = '' }) {
  return requestAbsolute(`/api/tusindirme/suggestions/${encodeURIComponent(id)}/moderate`, {
    method: 'POST',
    body: JSON.stringify({ approve, note }),
  });
}

export async function fetchGhostTitles({ page = 1, limit = 25, q = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q) params.set('q', q);
  return requestAbsolute(`/api/tusindirme/ghost-titles?${params.toString()}`);
}

export async function activateGhostTitles(titleIds) {
  return requestAbsolute('/api/tusindirme/ghost-titles/activate', {
    method: 'POST',
    body: JSON.stringify({ titleIds }),
  });
}

export async function updateGhostDescription(
  descriptionId,
  { description, activate = true, category } = {}
) {
  const body = { activate };
  if (description !== undefined) body.description = description;
  if (category !== undefined) body.category = category;
  return requestAbsolute(`/api/tusindirme/description/${encodeURIComponent(descriptionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Public sóz (WordDetail) — ádette activate=false. */
export async function updateSenseDescription(
  descriptionId,
  { description, activate = false, category } = {}
) {
  return updateGhostDescription(descriptionId, { description, activate, category });
}

export async function createSenseDescription(titleId, { description, category = null } = {}) {
  return requestAbsolute(`/api/tusindirme/title/${encodeURIComponent(titleId)}/descriptions`, {
    method: 'POST',
    body: JSON.stringify({ description, category }),
  });
}

export async function createDictionaryTitle({ word, description, category = null } = {}) {
  return requestAbsolute('/api/tusindirme/titles', {
    method: 'POST',
    body: JSON.stringify({ word, description, category }),
  });
}

export async function renameDictionaryTitle(titleId, { word } = {}) {
  return requestAbsolute(`/api/tusindirme/title/${encodeURIComponent(titleId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ word }),
  });
}

export async function deactivateDictionaryTitle(titleId) {
  return requestAbsolute(`/api/tusindirme/title/${encodeURIComponent(titleId)}`, {
    method: 'DELETE',
  });
}

export async function reactivateDictionaryTitle(titleId) {
  return requestAbsolute(`/api/tusindirme/title/${encodeURIComponent(titleId)}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function deleteSenseDescription(descriptionId) {
  return requestAbsolute(`/api/tusindirme/description/${encodeURIComponent(descriptionId)}`, {
    method: 'DELETE',
  });
}

export async function updateExampleSentence(exampleId, { example } = {}) {
  return requestAbsolute(`/api/tusindirme/example/${encodeURIComponent(exampleId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ example }),
  });
}

export async function createSenseExample(descriptionId, { example, author = null } = {}) {
  return requestAbsolute(`/api/tusindirme/description/${encodeURIComponent(descriptionId)}/examples`, {
    method: 'POST',
    body: JSON.stringify({ example, author }),
  });
}

export async function deleteSenseExample(exampleId) {
  return requestAbsolute(`/api/tusindirme/example/${encodeURIComponent(exampleId)}`, {
    method: 'DELETE',
  });
}

export async function updateIdiomPhrase(idiomId, { phrase } = {}) {
  return requestAbsolute(`/api/tusindirme/idiom/${encodeURIComponent(idiomId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ phrase }),
  });
}

export async function createSenseIdiom(descriptionId, { phrase, description = null } = {}) {
  return requestAbsolute(`/api/tusindirme/description/${encodeURIComponent(descriptionId)}/idioms`, {
    method: 'POST',
    body: JSON.stringify({ phrase, description }),
  });
}

export async function deleteSenseIdiom(idiomId) {
  return requestAbsolute(`/api/tusindirme/idiom/${encodeURIComponent(idiomId)}`, {
    method: 'DELETE',
  });
}

export async function updateIdiomGloss(idiomDescId, { description } = {}) {
  return requestAbsolute(`/api/tusindirme/idiom-desc/${encodeURIComponent(idiomDescId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
}

export async function addSenseSynonymRelation(descriptionId, word) {
  return requestAbsolute('/api/tusindirme/relations/sense/synonym', {
    method: 'POST',
    body: JSON.stringify({ descriptionId, word }),
  });
}

export async function removeSenseSynonymRelation(descriptionId, targetDescriptionId) {
  return requestAbsolute('/api/tusindirme/relations/sense/synonym', {
    method: 'DELETE',
    body: JSON.stringify({ descriptionId, targetDescriptionId }),
  });
}

export async function addSenseAntonymRelation(descriptionId, word) {
  return requestAbsolute('/api/tusindirme/relations/sense/antonym', {
    method: 'POST',
    body: JSON.stringify({ descriptionId, word }),
  });
}

export async function removeSenseAntonymRelation(descriptionId, targetDescriptionId) {
  return requestAbsolute('/api/tusindirme/relations/sense/antonym', {
    method: 'DELETE',
    body: JSON.stringify({ descriptionId, targetDescriptionId }),
  });
}

export async function addCompoundRelation(mainTitleId, word) {
  return requestAbsolute('/api/tusindirme/compounds', {
    method: 'POST',
    body: JSON.stringify({ mainTitleId, word }),
  });
}

export async function removeCompoundRelation(relationId) {
  return requestAbsolute(`/api/tusindirme/compounds/${encodeURIComponent(relationId)}`, {
    method: 'DELETE',
  });
}

export async function addWordRelation(titleId, { word, type }) {
  return requestAbsolute('/api/tusindirme/relations/word', {
    method: 'POST',
    body: JSON.stringify({ titleId, word, type }),
  });
}

export async function removeWordRelation(relationId) {
  return requestAbsolute(`/api/tusindirme/relations/word/${encodeURIComponent(relationId)}`, {
    method: 'DELETE',
  });
}

// ----- O‘qish darslari boshqaruvi -----

export async function fetchAdminLessons() {
  return requestAbsolute('/api/reading/admin/lessons');
}

export async function fetchAdminLessonSections(bookId) {
  const params = new URLSearchParams({ bookId: String(bookId) });
  return requestAbsolute(`/api/reading/admin/lessons/sections?${params}`);
}

export async function generateAdminLesson({ bookId, sectionIndex = 0, force = false } = {}) {
  return requestAbsolute('/api/reading/admin/lessons/generate', {
    method: 'POST',
    body: JSON.stringify({ bookId, sectionIndex, force }),
  });
}

export async function saveAdminLesson(payload) {
  const id = payload?.id;
  const url = id
    ? `/api/reading/admin/lessons/${encodeURIComponent(id)}`
    : '/api/reading/admin/lessons';
  return requestAbsolute(url, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminLesson(id) {
  return requestAbsolute(`/api/reading/admin/lessons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ----- Exit feedback inbox -----

export async function fetchAdminExitFeedback({
  helpful = '',
  page = 1,
  limit = 40,
  days = 30,
} = {}) {
  const params = new URLSearchParams();
  if (helpful !== '' && helpful != null) params.set('helpful', String(helpful));
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('days', String(days));
  return request(`/feedback/exit?${params.toString()}`);
}

// ----- Admin akkauntlar (owner) -----

export async function fetchAdminAccounts() {
  return request('/accounts');
}

export async function createAdminAccount(payload) {
  return request('/accounts', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAdminAccount(id, payload) {
  return request(`/accounts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function resetAdminAccountPassword(id, newPassword) {
  return request(`/accounts/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}
