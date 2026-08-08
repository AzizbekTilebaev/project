import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { voteSuggestion } from '../api/tusindirme';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, MotionSpan, motionVariants } from '../animations';

const TYPE_KEYS = {
  synonym: 'jamiyetTypeSynonym',
  antonym: 'jamiyetTypeAntonym',
  compound: 'jamiyetTypeCompound',
};

const STATUS_KEYS = {
  pending: 'jamiyetStatusPending',
  approved: 'jamiyetStatusApproved',
  rejected: 'jamiyetStatusRejected',
};

function lookupHref(word) {
  const q = String(word || '').trim();
  if (!q) return null;
  return `/dictionary/all?q=${encodeURIComponent(q)}`;
}

/**
 * Shared vote row for WordDetail panel + Community feed/profile.
 */
export default function CommunitySuggestionRow({
  item,
  onUpdated,
  showSource = false,
  showStatus = false,
  compact = false,
}) {
  const { text } = useUiScript();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [voteFlash, setVoteFlash] = useState(null);

  const vote = async (voteValue) => {
    if (busy || item.isMine || item.status !== 'pending') return;
    setBusy(true);
    setErr('');
    try {
      const res = await voteSuggestion(item.id, voteValue);
      setVoteFlash(voteValue);
      window.setTimeout(() => setVoteFlash(null), 400);
      if (res?.unchanged) {
        onUpdated?.({
          ...item,
          myVote: res.myVote || voteValue,
          upvotes: res.upvotes ?? item.upvotes,
          downvotes: res.downvotes ?? item.downvotes,
        });
        return;
      }
      onUpdated?.({
        ...item,
        myVote: res.myVote || voteValue,
        upvotes: res.upvotes ?? item.upvotes,
        downvotes: res.downvotes ?? item.downvotes,
        status: res.status || item.status,
      });
    } catch (e) {
      setErr(e.message || 'Dawıs beriw múmkin bolmadı.');
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = text(KAA[TYPE_KEYS[item.suggestionType]] || item.suggestionType);
  const sourceHref = item.sourceHref;
  const sourceLabel = item.sourceLabel;
  const snippet = String(item.senseSnippet || '').trim();
  const note = String(item.moderatorNote || '').trim();
  const lookup = lookupHref(item.suggestedWord);
  const resolved = item.status === 'approved' || item.status === 'rejected';
  const showLookup = Boolean(lookup && (item.status === 'approved' || (showStatus && resolved)));

  return (
    <li
      className={`rounded-xl border border-ink/10 bg-white/50 ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-teal-800">
            {typeLabel}
          </span>
          <span className="font-display text-lg text-ink">{text(item.suggestedWord)}</span>
          <MotionSpan
            key={`up-${item.upvotes}-${voteFlash === 'up'}`}
            variants={voteFlash === 'up' ? motionVariants.pop : motionVariants.none}
            className="inline-block rounded-full border border-emerald-600/15 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
          >
            ↑{item.upvotes ?? 0}
          </MotionSpan>
          <MotionSpan
            key={`dn-${item.downvotes}-${voteFlash === 'down'}`}
            variants={voteFlash === 'down' ? motionVariants.pop : motionVariants.none}
            className="inline-block rounded-full border border-rose-500/15 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700"
          >
            ↓{item.downvotes ?? 0}
          </MotionSpan>
          {showStatus && item.status ? (
            <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-ink/55">
              {text(KAA[STATUS_KEYS[item.status]] || item.status)}
            </span>
          ) : null}
          {item.isMine ? (
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-teal-800/70">
              {text(KAA.jamiyetOwnHint)}
            </span>
          ) : null}
          {showSource && sourceHref && sourceLabel ? (
            <Link
              to={sourceHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-900 hover:underline"
            >
              {text(sourceLabel)}
              <AnimChevron count={2} className="opacity-50" />
            </Link>
          ) : null}
        </div>

        {item.status === 'pending' && !item.isMine ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              aria-pressed={item.myVote === 'up'}
              onClick={() => vote('up')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                item.myVote === 'up'
                  ? 'border-emerald-700 bg-emerald-600 text-white'
                  : 'border-emerald-600/30 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-600 hover:text-white'
              }`}
            >
              ✓ {text(KAA.jamiyetVoteUp)}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={item.myVote === 'down'}
              onClick={() => vote('down')}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                item.myVote === 'down'
                  ? 'border-rose-700 bg-rose-500 text-white'
                  : 'border-rose-500/30 bg-rose-50/60 text-rose-700 hover:bg-rose-500 hover:text-white'
              }`}
            >
              ✕ {text(KAA.jamiyetVoteDown)}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {showLookup ? (
              <Link
                to={lookup}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950"
              >
                <Icon name="search" /> {text(KAA.jamiyetLookupWord)}
              </Link>
            ) : null}
            {showSource && sourceHref ? (
              <Link
                to={sourceHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white px-3 py-1.5 text-xs font-bold text-teal-950"
              >
                <Icon name="book" /> {text(KAA.jamiyetOpenWord)}
              </Link>
            ) : null}
          </div>
        )}
      </div>

      {snippet ? (
        <p className={`text-xs leading-relaxed text-ink/50 ${compact ? 'mt-1.5' : 'mt-2'}`}>
          {text(snippet)}
        </p>
      ) : null}
      {showStatus && note ? (
        <p className="mt-1.5 text-xs text-ink/45">
          <span className="font-semibold text-ink/55">{text(KAA.jamiyetModeratorNote)}:</span>{' '}
          {text(note)}
        </p>
      ) : null}

      {err ? <p className="mt-2 w-full text-sm text-rose-700">{text(err)}</p> : null}
    </li>
  );
}
