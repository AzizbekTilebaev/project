import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import {
  LEDGER_FILTERS,
  formatPointsDelta,
  labelForPointsKind,
  matchesLedgerFilter,
  relativePointsTime,
} from '../lib/pointsLabels';

/**
 * Wallet transaction ledger — used on QuizStatistics and Profile strip.
 */
export default function PointsLedger({
  history = [],
  loading = false,
  compact = false,
  emptyHref = '/quiz',
  className = '',
}) {
  const { text } = useUiScript();
  const [filter, setFilter] = useState('all');

  const rows = useMemo(
    () => (history || []).filter((tx) => matchesLedgerFilter(tx, filter)),
    [history, filter]
  );

  return (
    <div id="wallet" className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg text-ink">{text(KAA.walletLedger)}</h3>
        {!compact ? (
          <div className="flex flex-wrap gap-1">
            {LEDGER_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold ${
                  filter === f.id
                    ? 'bg-amber-700 text-white'
                    : 'border border-ink/10 bg-white/70 text-ink/60'
                }`}
              >
                {text(f.label)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-ink/45">{text(KAA.walletLoading)}</p>
      ) : (
        <ul className={`space-y-2 ${compact ? 'max-h-40' : 'max-h-80'} overflow-y-auto`}>
          {rows.map((tx) => {
            const amount = Number(tx.amount) || 0;
            const tone =
              amount > 0
                ? 'text-emerald-800'
                : tx.kind === 'quiz_attempt_voided' || tx.kind === 'award_revoked'
                  ? 'text-amber-900'
                  : 'text-rose-800';
            return (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-ink/[0.06] bg-white/70 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {text(labelForPointsKind(tx.kind))}
                  </p>
                  <p className="text-[0.65rem] text-ink/45">
                    {text(relativePointsTime(tx.createdAt))}
                    {tx.meta?.quizId ? ` · ${tx.meta.quizId}` : ''}
                    {tx.meta?.reason ? ` · ${tx.meta.reason}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 font-display text-lg ${tone}`}>
                  {formatPointsDelta(amount)}
                </span>
              </li>
            );
          })}
          {!rows.length && (
            <li className="rounded-2xl border border-dashed border-ink/10 px-4 py-6 text-center text-sm text-ink/45">
              <p className="mb-3">{text(KAA.walletEmpty)}</p>
              <Link
                to={emptyHref}
                className="inline-flex rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white"
              >
                {text(KAA.statsEarnBall)}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
