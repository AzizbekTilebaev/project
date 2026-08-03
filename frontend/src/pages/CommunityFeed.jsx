import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import Icon from '../components/Icon';
import CommunitySuggestionRow from '../components/CommunitySuggestionRow';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchMySuggestions, fetchSuggestions } from '../api/tusindirme';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim } from '../animations';
import { BACK_ONLINE_EVENT } from '../lib/networkRecovery';

const MINE_STATUSES = ['all', 'pending', 'approved', 'rejected'];

function normalizeTab(raw) {
  return raw === 'mine' ? 'mine' : 'feed';
}

function normalizeMineStatus(raw) {
  return MINE_STATUSES.includes(raw) ? raw : 'all';
}

export default function CommunityFeed() {
  const { text } = useUiScript();
  usePageMeta(text(KAA.jamiyetTitle), text(KAA.jamiyetTush));
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = normalizeTab(searchParams.get('tab'));
  const mineStatus = normalizeMineStatus(searchParams.get('status'));

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const setTab = (next) => {
    const nextTab = normalizeTab(next);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (nextTab === 'mine') p.set('tab', 'mine');
        else p.delete('tab');
        if (nextTab !== 'mine') p.delete('status');
        return p;
      },
      { replace: true }
    );
  };

  const setMineStatus = (next) => {
    const s = normalizeMineStatus(next);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', 'mine');
        if (s === 'all') p.delete('status');
        else p.set('status', s);
        return p;
      },
      { replace: true }
    );
  };

  const load = async (nextTab = tab, nextMine = mineStatus) => {
    setStatus('loading');
    setError(null);
    try {
      if (nextTab === 'mine') {
        const res = await fetchMySuggestions({ status: nextMine, limit: 40 });
        setItems(res.suggestions || []);
      } else {
        const res = await fetchSuggestions({ limit: 40 });
        setItems(res.suggestions || []);
      }
      setStatus('ready');
    } catch (err) {
      setError(err?.message || 'Júklew qáteligi');
      setStatus('error');
      setItems([]);
    }
  };

  useEffect(() => {
    load(tab, mineStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mineStatus]);

  useEffect(() => {
    const onBack = () => {
      if (status === 'error') load(tab, mineStatus);
    };
    window.addEventListener(BACK_ONLINE_EVENT, onBack);
    return () => window.removeEventListener(BACK_ONLINE_EVENT, onBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tab, mineStatus]);

  return (
    <PageGate
      status={status === 'error' ? 'error' : status === 'loading' && !items.length ? 'loading' : 'ready'}
      error={error}
      onRetry={() => load()}
      backHref="/dictionary"
      backLabel={text(KAA.sozlik)}
    >
      <DictShell className="pt-24 pb-28 md:pb-24">
        <section className="mx-auto max-w-3xl px-5 pt-6 sm:px-6 md:px-10">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
            {text(KAA.jamiyet)}
          </p>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            {text(KAA.jamiyetTitle)}
          </h1>
          <AnimIconDivider amber className="mb-3" />
          <p className="mb-6 max-w-xl text-ink/55">{text(KAA.jamiyetTush)}</p>

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={tab === 'feed'}
              onClick={() => setTab('feed')}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                tab === 'feed' ? 'qp-btn-primary !px-4 !py-1.5' : 'qp-chip text-ink/55'
              }`}
            >
              {text(KAA.jamiyetTabFeed)}
            </button>
            <button
              type="button"
              aria-pressed={tab === 'mine'}
              onClick={() => setTab('mine')}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                tab === 'mine' ? 'qp-btn-primary !px-4 !py-1.5' : 'qp-chip text-ink/55'
              }`}
            >
              {text(KAA.jamiyetTabMine)}
            </button>
            <Link
              to="/profile"
              className="qp-chip text-teal-950 no-underline"
            >
              {text(KAA.jamiyetSoftSync)}
            </Link>
          </div>

          {tab === 'mine' && (
            <div className="mb-5 flex flex-wrap gap-1.5">
              {MINE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={mineStatus === s}
                  onClick={() => setMineStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    mineStatus === s
                      ? 'bg-cyan-800 text-white'
                      : 'border border-ink/10 bg-white text-ink/50'
                  }`}
                >
                  {s === 'all'
                    ? text(KAA.immersionBrowseAllLetters)
                    : text(
                        KAA[
                          s === 'pending'
                            ? 'jamiyetStatusPending'
                            : s === 'approved'
                              ? 'jamiyetStatusApproved'
                              : 'jamiyetStatusRejected'
                        ]
                      )}
                </button>
              ))}
            </div>
          )}

          {status === 'ready' && items.length === 0 ? (
            <div className="qp-surface border-dashed px-6 py-10 text-center">
              <Icon name="users" className="mx-auto mb-3 text-3xl text-teal-700" />
              <p className="text-ink/60">
                {tab === 'mine' ? text(KAA.jamiyetMineEmpty) : text(KAA.jamiyetFeedEmpty)}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/dictionary"
                  className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="book" /> {text(KAA.jamiyetFeedCtaDict)}
                </Link>
                {tab === 'mine' ? (
                  <Link
                    to="/community"
                    className="qp-btn-ghost !px-4 !py-2 !text-xs"
                  >
                    <Icon name="users" /> {text(KAA.jamiyetSeeFeed)}
                  </Link>
                ) : (
                  <Link
                    to="/tutor/practice"
                    className="qp-btn-ghost !px-4 !py-2 !text-xs"
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((s) => (
                <CommunitySuggestionRow
                  key={s.id}
                  item={s}
                  showSource
                  showStatus={tab === 'mine'}
                  onUpdated={(next) =>
                    setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)))
                  }
                />
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              to="/dictionary"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 hover:underline"
            >
              {text(KAA.sozlik)}
              <AnimChevron count={2} className="opacity-50" />
            </Link>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 hover:underline"
            >
              {text(KAA.jamiyetProfileTitle)}
              <AnimChevron count={2} className="opacity-50" />
            </Link>
          </div>
        </section>
      </DictShell>
    </PageGate>
  );
}
