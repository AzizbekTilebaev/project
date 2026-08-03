import { getAnonymousId } from '../lib/anonymousId';
import { getStoredAuthToken } from '../lib/apiHeaders';
import { makeApiError } from '../lib/apiErrors';

export async function submitExitFeedback({ helpful, note = '' }) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Anonymous-Id': getAnonymousId(),
  };
  const token = getStoredAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/feedback/exit', {
    method: 'POST',
    headers,
    body: JSON.stringify({ helpful, note }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw makeApiError(data, res.status);
  return data;
}
