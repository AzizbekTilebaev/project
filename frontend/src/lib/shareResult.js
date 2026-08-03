/**
 * Web Share API + clipboard fallback (WordDetail / GameLobby pattern).
 * @returns {'shared'|'copied'|'cancelled'|'failed'}
 */
export async function shareResult({ title, text, url } = {}) {
  const safeUrl =
    url || (typeof window !== 'undefined' ? window.location.href : '');
  const payload = {
    title: String(title || '').trim() || undefined,
    text: String(text || '').trim() || undefined,
    url: safeUrl || undefined,
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      /* fall through to clipboard */
    }
  }

  const clip = [payload.text, payload.url].filter(Boolean).join('\n');
  if (!clip) return 'failed';
  try {
    await navigator.clipboard.writeText(clip);
    return 'copied';
  } catch {
    return 'failed';
  }
}
