/** Point transaction kind → Karakalpak Latin label (source for useUiScript). */
export const POINTS_KIND_LABELS = {
  quiz_completed: 'Test juwmaqlandı',
  adaptive_completed: 'Adaptiv test',
  dict_game_completed: 'Sóz oyını',
  word_of_day_claim: 'Kún sózi',
  combo_chest_claim: 'Combo sandıq',
  answer_review_unlock: 'Juwaplardı ashıw',
  quiz_attempt_voided: 'Urınıw biykarlandı',
  award_revoked: 'Ball qaytarıldı',
};

export const LEDGER_FILTERS = [
  { id: 'all', label: 'Barlıǵı' },
  { id: 'earned', label: 'Islengen' },
  { id: 'spent', label: 'Sarplanǵan' },
  { id: 'clawback', label: 'Qaytarılǵan' },
];

const CLAWBACK_KINDS = new Set(['quiz_attempt_voided', 'award_revoked']);

export function labelForPointsKind(kind) {
  return POINTS_KIND_LABELS[kind] || String(kind || 'Tranzaksiya');
}

export function matchesLedgerFilter(tx, filter) {
  const amount = Number(tx?.amount) || 0;
  const kind = String(tx?.kind || '');
  if (filter === 'earned') return amount > 0;
  if (filter === 'spent') return amount < 0 && !CLAWBACK_KINDS.has(kind);
  if (filter === 'clawback') return CLAWBACK_KINDS.has(kind) || (amount < 0 && kind.includes('void'));
  return true;
}

export function formatPointsDelta(amount) {
  const n = Number(amount) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

export function relativePointsTime(iso, now = Date.now()) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'házir';
  if (mins < 60) return `${mins} min aldın`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat aldın`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} kún aldın`;
  try {
    return new Date(iso).toLocaleString('kaa', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso).slice(0, 16);
  }
}
