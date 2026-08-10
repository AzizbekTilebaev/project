/**
 * Recent words viewedAt → qısqa vaqıt belgisi.
 * @param {number|string|Date|null|undefined} viewedAt
 * @param {(s: string) => string} [text] — i18n helper (identity default)
 */
export function formatViewedAt(viewedAt, text = (s) => s) {
  const ms = typeof viewedAt === 'number' ? viewedAt : Date.parse(viewedAt);
  if (!Number.isFinite(ms)) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return text('Házir');
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} ${text('min')}`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `${h} ${text('saat')}`;
  }
  const d = Math.floor(diff / 86_400_000);
  if (d < 7) return `${d} ${text('kún')}`;
  try {
    return new Date(ms).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
