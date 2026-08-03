import { getAnonymousId } from '../lib/anonymousId';
import { getStoredAuthToken, setStoredAuthToken } from '../lib/apiHeaders';
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

  const res = await fetch(`/api/auth${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}

export async function fetchMe() {
  return request('/me');
}

export async function registerWithEmail({ email, password, displayName }) {
  const data = await request('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
  if (data.token) setStoredAuthToken(data.token);
  return data;
}

export async function loginWithEmail({ email, password }) {
  const data = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) setStoredAuthToken(data.token);
  return data;
}

export async function completeTotpLogin({ challengeToken, code }) {
  const data = await request('/login/totp', {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });
  if (data.token) setStoredAuthToken(data.token);
  return data;
}

export async function loginWithGoogle(credential, nonce) {
  const data = await request('/google', {
    method: 'POST',
    body: JSON.stringify({ credential, nonce: nonce || undefined }),
  });
  if (data.token) setStoredAuthToken(data.token);
  return data;
}

export async function linkGoogle(credential, nonce) {
  return request('/google/link', {
    method: 'POST',
    body: JSON.stringify({ credential, nonce: nonce || undefined }),
  });
}

export async function unlinkGoogle() {
  return request('/google/unlink', { method: 'POST' });
}

export async function updateProfile(profile) {
  return request('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append('avatar', file);
  const headers = {
    Accept: 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api/auth/avatar', { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}

export async function removeAvatar() {
  return request('/avatar', { method: 'DELETE' });
}

export async function logout() {
  try {
    await request('/logout', { method: 'POST' });
  } finally {
    setStoredAuthToken('');
  }
}

export async function fetchAuthConfig() {
  return request('/config');
}

export async function requestPasswordReset(email) {
  return request('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword({ token, newPassword }) {
  const data = await request('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
  if (data.token) setStoredAuthToken(data.token);
  return data;
}

export async function changePassword({ currentPassword, newPassword }) {
  return request('/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function revokeOtherSessions() {
  return request('/sessions/others', { method: 'DELETE' });
}

export async function beginTotpSetup() {
  return request('/security/totp/begin', { method: 'POST' });
}

export async function confirmTotpSetup(code) {
  return request('/security/totp/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function disableTotp(code) {
  return request('/security/totp/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Logged-in: link/verify phone (AUTH_PHONE_LOGIN). */
export async function requestPhoneVerifyOtp(phone) {
  return request('/security/phone/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPhoneVerifyOtp({ phone, code }) {
  return request('/security/phone/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

/** Soft phone login (public, AUTH_PHONE_LOGIN). */
export async function requestPhoneLoginOtp(phone) {
  return request('/phone/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function loginWithPhoneOtp({ phone, code }) {
  const data = await request('/phone/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
  if (data.token) setStoredAuthToken(data.token);
  return data;
}
