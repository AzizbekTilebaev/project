import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import Icon from '../components/Icon';
import ImmersionBrowseCard from '../components/ImmersionBrowseCard';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchReadyImmersion } from '../api/immersion';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim } from '../animations';
import {
  clearImmersionContinue,
  getImmersionListenMeta,
  getContinueImmersion,
  isImmersionWordQueued,
} from '../lib/immersionProgress';
import useResumeTick from '../hooks/useResumeTick';
import { FALLBACK_LETTERS } from '../utils/dictionaryHelpers';
import { LATIN_LETTERS } from '../components/literature/litUtils';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { useAuth } from '../contexts/AuthContext';
import GuestSoftContinue from '../components/GuestSoftContinue';

const PAGE_SIZE = 40;

export default function ImmersionBrowse() {
  const { text, script } = useUiScript();
  const { isAuthenticated } = useAuth();
  const listRef = useRef(null);
  usePageMeta(text(KAA.dawisliSozler), text(KAA.dawisliSozlerTush));

  const letters = script === 'latin' ? LATIN_LETTERS : FALLBACK_LETTERS;

  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState('');
  const [kind, setKind] = useState('');
  const [heardFilter, setHeardFilter] = useState('all');
  const [words, setWords] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const resumeTick = useResumeTick();
  const meta = useMemo(() => getImmersionListenMeta(), [resumeTick]);
  const continueImmersion = useMemo(() => getContinueImmersion(), [resumeTick]);
  const {
    streak,
    practiceCount,
  } = meta;

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 280);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const loadPage = useCallback(
    async ({ append = false, offset = 0 } = {}) => {
      if (append) setLoadingMore(true);
      else {
        setStatus('loading');
        setError(null);
      }
      try {
        const res = await fetchReadyImmersion({
          limit: PAGE_SIZE,
          offset,
          q,
          letter,
          kind,
        });
        const next = res.words || [];
        setWords((prev) => (append ? [...prev, ...next] : next));
        setTotal(Number(res.total) || next.length);
        setHasMore(Boolean(res.hasMore));
        setStatus('ready');
      } catch (err) {
        if (!append) {
          setError(err?.message || 'Júklew qáteligi');
          setStatus('error');
          setWords([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        setLoadingMore(false);
      }
    },
    [q, letter, kind]
  );

  useEffect(() => {
    setExpandedId(null);
    loadPage({ append: false, offset: 0 });
  }, [loadPage]);

  const scrollToList = () => {
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const displayed = useMemo(() => {
    if (heardFilter === 'all') return words;
    return words.filter((w) => {
      const queued = isImmersionWordQueued(w.titleId);
      return heardFilter === 'heard' ? queued : !queued;
    });
  }, [words, heardFilter, resumeTick]);

  const hasActiveFilters = Boolean(q || letter || kind || heardFilter !== 'all');

  const clearFilters = () => {
    setQInput('');
    setQ('');
    setLetter('');
    setKind('');
    setHeardFilter('all');
  };

  const kindChips = [
    { id: '', label: KAA.immersionBrowseKindAll },
    { id: 'audio', label: KAA.immersionBrowseKindAudio },
    { id: 'video', label: KAA.immersionBrowseKindVideo },
    { id: 'model3d', label: KAA.immersionBrowseKind3d },
  ];

  const heardChips = [
    { id: 'all', label: KAA.immersionBrowseHeardAll },
    { id: 'unheard', label: KAA.immersionBrowseUnheard },
    { id: 'heard', label: KAA.immersionBrowseHeard },
  ];

  return (
    <ProtectedContent>
    <PageGate
      status={status === 'error' ? 'error' : status === 'loading' && !words.length ? 'loading' : 'ready'}
      error={error}
      onRetry={() => loadPage({ append: false, offset: 0 })}
      backHref="/dictionary"
      backLabel={text(KAA.sozlik)}
    >
      <DictShell className="pt-24 pb-28 md:pb-24">
        <section className="mx-auto max-w-3xl px-5 pt-6 sm:px-6 md:px-10">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
            {text(KAA.immersiya)}
          </p>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-4xl md:text-5xl">
            {text(KAA.dawisliSozler)}
          </h1>
          <AnimIconDivider amber className="mb-3" />
          <p className="mb-6 max-w-xl text-ink/55">{text(KAA.dawisliSozlerTush)}</p>

          <div className="mb-6">
            {continueImmersion ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={continueImmersion.href}
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-cyan-800 px-4 py-2.5 text-sm font-bold text-white`}
                >
                  <Icon name="sparkle" /> {text(KAA.continueImmersion)}
                  {continueImmersion.soz ? (
                    <span className="max-w-[10rem] truncate font-semibold opacity-90">
                      · {text(continueImmersion.soz)}
                    </span>
                  ) : null}
                  <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                </Link>
                <button
                  type="button"
                  onClick={() => clearImmersionContinue(continueImmersion.id)}
                  className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900"
                >
                  {text(KAA.immersionAbandon)}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={scrollToList}
                className={`${anim.shine} qp-btn-primary`}
              >
                <Icon name="sparkle" /> {text(KAA.immersionColdListen)}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </button>
            )}
          </div>

          {(practiceCount > 0 || streak > 0 || continueImmersion) && (
            <div className="mb-8">
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.immersionListenFree)}
              </p>
              <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-0" compact />
              {!isAuthenticated ? (
                <GuestSoftContinue
                  className="mt-3 text-left"
                  titleKey={null}
                  bodyKey="immersionBrowseGuestProduce"
                  compact
                />
              ) : null}
            </div>
          )}

          <div ref={listRef} className="mb-5 scroll-mt-28 space-y-3">
            {(practiceCount > 0 || streak > 0) && (
              <div className="flex flex-wrap items-center gap-2 pb-1">
                {streak > 0 && (
                  <button
                    type="button"
                    onClick={scrollToList}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950 ${anim.streakFlame}`}
                  >
                    <span className={anim.streakDot} aria-hidden />
                    {text(KAA.immersionStreak)} {streak}
                  </button>
                )}
                {practiceCount > 0 && (
                  <Link
                    to="/quiz"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white px-3 py-1.5 text-xs font-bold text-teal-950"
                  >
                    <Icon name="trophy" /> {text(KAA.immersionPracticeNow)}
                    <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[0.65rem]">
                      {practiceCount}
                    </span>
                  </Link>
                )}
              </div>
            )}
            <label className="block">
              <span className="sr-only">{text(KAA.immersionBrowseSearch)}</span>
              <input
                type="search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder={text(KAA.immersionBrowseSearch)}
                className="w-full rounded-2xl border border-teal-700/20 bg-white/90 px-4 py-3 text-sm text-ink outline-none ring-teal-600/20 focus:ring-2"
              />
            </label>

            <div className="flex flex-wrap gap-1.5">
              {kindChips.map((c) => (
                <button
                  key={c.id || 'all'}
                  type="button"
                  aria-pressed={kind === c.id}
                  onClick={() => setKind(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    kind === c.id
                      ? 'bg-teal-900 text-white'
                      : 'border border-ink/10 bg-white text-ink/55 hover:text-teal-900'
                  }`}
                >
                  {text(c.label)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {heardChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={heardFilter === c.id}
                  onClick={() => setHeardFilter(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    heardFilter === c.id
                      ? 'bg-cyan-800 text-white'
                      : 'border border-ink/10 bg-white text-ink/55 hover:text-cyan-900'
                  }`}
                >
                  {text(c.label)}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 alphabet-scroll">
              <button
                type="button"
                aria-pressed={!letter}
                onClick={() => setLetter('')}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                  !letter
                    ? 'bg-teal-900 text-white'
                    : 'border border-ink/10 bg-white text-ink/50'
                }`}
              >
                {text(KAA.immersionBrowseAllLetters)}
              </button>
              {letters.map((L) => (
                <button
                  key={L}
                  type="button"
                  aria-pressed={letter === L}
                  onClick={() => setLetter(letter === L ? '' : L)}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold tabular-nums ${
                    letter === L
                      ? 'bg-teal-900 text-white'
                      : 'border border-ink/10 bg-white text-ink/50 hover:text-teal-900'
                  }`}
                >
                  {L}
                </button>
              ))}
            </div>
          </div>

          {total === 0 && status === 'ready' && !hasActiveFilters ? (
            <div className="qp-surface border-dashed px-6 py-10 text-center">
              <Icon name="sparkle" className="mx-auto mb-3 text-3xl text-teal-700" />
              <p className="text-ink/60">{text(KAA.dawisliSozJoq)}</p>
              <p className="mt-2 text-sm text-ink/45">{text(KAA.immersionColdEmptyHint)}</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/dictionary"
                  className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="book" /> {text(KAA.sozlik)}
                </Link>
                <Link
                  to="/quiz"
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
                >
                  <Icon name="trophy" /> {text(KAA.testler)}
                </Link>
              </div>
              <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" compact />
              {!isAuthenticated ? (
                <GuestSoftContinue
                  className="mx-auto mt-3 max-w-md text-left"
                  titleKey={null}
                  bodyKey="immersionBrowseGuestProduce"
                  compact
                />
              ) : null}
            </div>
          ) : displayed.length === 0 && status === 'ready' ? (
            <div className="qp-surface border-dashed px-6 py-8 text-center">
              <p className="text-ink/60">{text(KAA.immersionBrowseEmptyFilter)}</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 inline-flex rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                >
                  {text(KAA.immersionBrowseClearFilters)}
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-ink/45">
                {text(KAA.dawisliSozSan)}: {heardFilter === 'all' ? total : displayed.length}
                {heardFilter === 'all' && words.length < total
                  ? ` · ${words.length}/${total}`
                  : ''}
              </p>
              <ul className="grid gap-2 sm:grid-cols-1">
                {displayed.map((w) => (
                  <ImmersionBrowseCard
                    key={w.titleId}
                    word={w}
                    expanded={expandedId === w.titleId}
                    queued={isImmersionWordQueued(w.titleId)}
                    onToggle={(id) =>
                      setExpandedId((cur) => (cur === id ? null : id))
                    }
                    onListen={() => {
                      /* resumeTick via emitResumeChanged in recordImmersionListen */
                    }}
                  />
                ))}
              </ul>
              {hasMore && (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => loadPage({ append: true, offset: words.length })}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-950 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Icon name="loader" className="animate-spin" />
                    ) : (
                      <Icon name="down" />
                    )}
                    {text(KAA.immersionBrowseLoadMore)}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
