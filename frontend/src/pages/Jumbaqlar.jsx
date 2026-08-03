import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  fetchDailyJumbaq,
  fetchJumbaqCategories,
  fetchJumbaqlar,
  fetchJumbaqProgress,
  fetchRandomJumbaq,
  guessJumbaqAnswer,
  revealJumbaqAnswer,
  saveJumbaqProgress,
} from '../api/jumbaqlar';
import { AnimIconDivider, AnimChevron, anim } from '../animations';
import {
  clearJumbaqContinue,
  getJumbaqRevealMeta,
  getJumbaqRevealStreak,
  recordJumbaqReveal,
  getContinueJumbaq,
  touchJumbaqContinue,
  readJumbaqPractice,
} from '../lib/jumbaqProgress';
import { jumbaqPracticeHref } from '../lib/readingPractice';
import { KAA } from '../i18n/kaa';
import useResumeTick from '../hooks/useResumeTick';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 24;
const LOCAL_PROGRESS_KEY = 'jumbaq:progress';

function readLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeLocalProgress(map) {
  try {
    localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function normalizeItem(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    jumbaq: raw.jumbaq || raw.text || raw.question || '',
    juwap: raw.juwap || raw.answer || raw.juwabi || '',
    topar: raw.topar ?? raw.category ?? null,
    utopar: raw.utopar ?? raw.subcategory ?? null,
  };
}

function progressEntry(map, id) {
  const e = map?.[id] || map?.[String(id)] || {};
  return {
    revealed: Boolean(e.revealed),
    favorited: Boolean(e.favorited),
  };
}

function JumbaqCard({
  item,
  progress,
  onReveal,
  onGuess,
  onFavorite,
  onNext,
  featured = false,
  script = 'cyrillic',
  practiceHref = '/tutor/practice?from=jumbaq',
  isAuthenticated = true,
}) {
  const { text } = useUiScript();
  const revealed = progress.revealed;
  const favorited = progress.favorited;
  const [draft, setDraft] = useState('');
  const [guessMsg, setGuessMsg] = useState('');
  const [busyGuess, setBusyGuess] = useState(false);
  const lookupHref = item.juwap
    ? `/dictionary/all?q=${encodeURIComponent(String(item.juwap).trim())}&from=jumbaq`
    : '/dictionary/all?from=jumbaq';
  const revealStreak = revealed ? getJumbaqRevealStreak() : 0;

  const submitGuess = async (e) => {
    e?.preventDefault?.();
    if (busyGuess || revealed || !String(draft || '').trim()) return;
    setBusyGuess(true);
    setGuessMsg('');
    try {
      const res = await onGuess?.(item, String(draft).trim());
      if (res?.correct) {
        setGuessMsg(res.nearMiss ? t('guessNearMiss', script) : t('correctMsg', script));
      } else {
        setGuessMsg(t('guessWrong', script));
      }
    } catch (err) {
      setGuessMsg(err?.message || t('guessWrong', script));
    } finally {
      setBusyGuess(false);
    }
  };

  return (
    <article
      className={`group qp-card p-5 shadow-[0_16px_40px_-30px_rgba(28,42,36,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-600/25 hover:bg-white/80 md:p-6 ${
        featured ? 'ring-1 ring-sky-500/20' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {item.topar != null && (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-sky-900">
              {t('group', script)} {item.topar}
            </span>
          )}
          {item.utopar != null && (
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[0.65rem] font-bold text-teal-800">
              U·{item.utopar}
            </span>
          )}
          <span className="rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[0.65rem] text-ink/40">
            #{item.id}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onFavorite?.(item)}
          className={`rounded-full p-2 transition ${
            favorited ? 'bg-rose-100 text-rose-600' : 'bg-ink/[0.04] text-ink/35 hover:text-rose-600'
          }`}
          aria-label={t('saveWord', script)}
        >
          <Icon name="heart" filled={favorited} />
        </button>
      </div>

      <p className="whitespace-pre-line font-display text-lg leading-8 tracking-tight text-ink md:text-xl">
        {item.jumbaq}
      </p>

      <div className="mt-5 border-t border-ink/[0.06] pt-4">
        {!revealed ? (
          <div className="space-y-3">
            <p className="text-xs text-ink/50">{t('guessHint', script)}</p>
            <form onSubmit={submitGuess} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busyGuess}
                autoComplete="off"
                spellCheck={false}
                placeholder={t('guessAnswer', script)}
                className="min-w-[12rem] flex-1 rounded-xl border border-sky-600/25 bg-white/90 px-3 py-2.5 text-sm text-ink outline-none ring-sky-500/30 focus:ring-2 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busyGuess || !String(draft || '').trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Icon name="check-circle" /> {t('guessSubmit', script)}
              </button>
            </form>
            {guessMsg ? (
              <p className="text-sm font-semibold text-sky-950" role="status">
                {guessMsg}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => onReveal?.(item)}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-600/30 bg-white px-4 py-2 text-sm font-bold text-sky-950 transition hover:bg-sky-50"
            >
              <Icon name="eye" /> {t('revealAnswer', script)}
            </button>
          </div>
        ) : (
          <div className="animate-dict-rise space-y-3">
            <div className="rounded-xl bg-emerald-50/90 px-4 py-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-emerald-800/60">
                {t('answer', script)}
              </p>
              <p className="mt-1 text-base font-semibold text-emerald-950">{item.juwap || '—'}</p>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-50/70 px-4 py-3">
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sky-800/60">
                {t('jumbaqNextEyebrow', script)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={lookupHref}
                  className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="book" /> {t('jumbaqLookupDict', script)}
                  <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                </Link>
                <Link
                  to={practiceHref}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                >
                  <Icon name="bolt" /> {text(KAA.practiceNav)}
                </Link>
                <button
                  type="button"
                  onClick={() => onNext?.(item)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                >
                  <Icon name="sparkle" /> {t('jumbaqNextRandom', script)}
                </button>
                <ShareResultButton
                  title={text(KAA.shareJumbaqTitle)}
                  text={
                    revealStreak > 0
                      ? text(KAA.shareJumbaqStreakText)
                          .replace('{answer}', String(item.juwap || '—'))
                          .replace('{streak}', String(revealStreak))
                      : text(KAA.shareJumbaqText).replace(
                          '{answer}',
                          String(item.juwap || '—')
                        )
                  }
                  url={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/jumbaqlar`
                      : undefined
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  compact
                />
              </div>
              {!isAuthenticated ? (
                <GuestSoftContinue className="mt-3 text-left" bodyKey="authGuestFreeBody" compact />
              ) : null}
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sky-800/55">
                {t('jumbaqRevealFree', script)}
              </p>
              <FreePlayCtaRow
                links={FOOTER_FREE_LINKS}
                justify="start"
                className="mt-2"
                compact
              />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function Jumbaqlar() {
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();
  usePageMeta(
    t('jumbaqlar', script),
    text('Qaraqalpaq jumbaqları — kategoriya, izlew, kúnlik hám juwaptı ashıw. Quiz emes.')
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const topar = searchParams.get('topar') || '';
  const utopar = searchParams.get('utopar') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [draft, setDraft] = useState(q);
  const [progressMap, setProgressMap] = useState(readLocalProgress);
  const [spotlight, setSpotlight] = useState(null);
  const [busy, setBusy] = useState('');
  const [answersById, setAnswersById] = useState({});
  const [revealMeta, setRevealMeta] = useState(() => getJumbaqRevealMeta());
  const resumeTick = useResumeTick();
  const skipTouchRef = useRef(false);
  const continueJumbaq = useMemo(
    () => getContinueJumbaq(),
    [topar, utopar, q, revealMeta, resumeTick]
  );
  const practiceHref = useMemo(() => {
    const focused = jumbaqPracticeHref(readJumbaqPractice());
    return focused || '/tutor/practice?from=jumbaq';
  }, [revealMeta, resumeTick]);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        {
          list: () =>
            fetchJumbaqlar({
              q: q || undefined,
              topar: topar || undefined,
              utopar: utopar || undefined,
              script,
              page,
              limit: PAGE_SIZE,
            }),
          categories: () => fetchJumbaqCategories({ script }),
        },
        {
          progress: () => fetchJumbaqProgress().catch(() => null),
          daily: () => fetchDailyJumbaq({ script }).catch(() => null),
        }
      ),
    { deps: [q, topar, utopar, page, script] }
  );

  useEffect(() => {
    const remote = data?.progress?.progress || data?.progress?.items || data?.progress;
    if (!remote) return;
    const map = { ...readLocalProgress() };
    const list = Array.isArray(remote) ? remote : Object.entries(remote).map(([id, v]) => ({ id, ...v }));
    if (Array.isArray(list)) {
      for (const row of list) {
        const id = row.id ?? row.jumbaqId;
        if (id == null) continue;
        map[id] = {
          revealed: Boolean(row.revealed ?? map[id]?.revealed),
          favorited: Boolean(row.favorited ?? map[id]?.favorited),
        };
      }
      writeLocalProgress(map);
      setProgressMap(map);
    } else if (typeof remote === 'object') {
      const merged = { ...map, ...remote };
      writeLocalProgress(merged);
      setProgressMap(merged);
    }
  }, [data?.progress]);

  const items = useMemo(() => {
    const raw = data?.list?.jumbaqlar || data?.list?.items || data?.list?.results || [];
    return raw.map(normalizeItem).filter(Boolean);
  }, [data?.list]);

  const total = Number(data?.list?.total ?? 1251) || items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categories = data?.categories?.categories || data?.categories?.items || [];
  const daily = normalizeItem(data?.daily?.jumbaq || data?.daily?.item || data?.daily);

  const setParam = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next);
  };

  const upsertProgress = useCallback(async (item, patch) => {
    const id = item.id;
    setProgressMap((prev) => {
      const next = {
        ...prev,
        [id]: { ...progressEntry(prev, id), ...patch },
      };
      writeLocalProgress(next);
      return next;
    });
    try {
      await saveJumbaqProgress(id, patch);
    } catch {
      /* local fallback already applied */
    }
  }, []);

  useEffect(() => {
    skipTouchRef.current = false;
  }, [topar, utopar, q]);

  useEffect(() => {
    if (!topar && !utopar && !q) return;
    if (skipTouchRef.current) return;
    const cat = categories.find((c) => String(c.topar ?? c.id ?? c.label) === String(topar));
    touchJumbaqContinue({
      topar,
      utopar,
      q,
      label: cat?.label || (topar ? `${t('group', script)} ${topar}` : q),
    });
  }, [topar, utopar, q, categories, script]);

  const abandonContinue = useCallback(() => {
    skipTouchRef.current = true;
    clearJumbaqContinue();
  }, []);

  const mergeAnswer = useCallback((id, juwap) => {
    if (!id || !juwap) return;
    setAnswersById((prev) => ({ ...prev, [id]: juwap, [String(id)]: juwap }));
    setSpotlight((prev) =>
      prev && String(prev.id) === String(id) ? { ...prev, juwap } : prev
    );
  }, []);

  const withAnswer = useCallback(
    (item) => {
      if (!item) return item;
      const juwap = item.juwap || answersById[item.id] || answersById[String(item.id)] || '';
      return juwap ? { ...item, juwap } : item;
    },
    [answersById]
  );

  const onReveal = async (item) => {
    try {
      const res = await revealJumbaqAnswer(item.id, { script });
      const juwap = res.juwap || res.answer || '';
      mergeAnswer(item.id, juwap);
      upsertProgress(item, { revealed: true });
      const meta = await recordJumbaqReveal({
        topar: item.topar ?? topar,
        utopar: item.utopar ?? utopar,
        q,
        label: item.topar != null ? `${t('group', script)} ${item.topar}` : '',
        juwap,
      });
      setRevealMeta(meta);
    } catch {
      // Guest/offline: local reveal without juwap (list stripped)
      upsertProgress(item, { revealed: true });
    }
  };

  const onGuess = async (item, answer) => {
    const res = await guessJumbaqAnswer(item.id, { answer, script });
    if (res.correct) {
      const juwap = res.juwap || res.answer || answer;
      mergeAnswer(item.id, juwap);
      upsertProgress(item, { revealed: true });
      const meta = await recordJumbaqReveal({
        topar: item.topar ?? topar,
        utopar: item.utopar ?? utopar,
        q,
        label: item.topar != null ? `${t('group', script)} ${item.topar}` : '',
        juwap,
      });
      setRevealMeta(meta);
    }
    return res;
  };

  const onFavorite = (item) => {
    const cur = progressEntry(progressMap, item.id);
    upsertProgress(item, { favorited: !cur.favorited });
  };

  const loadRandom = async () => {
    setBusy('random');
    try {
      const res = await fetchRandomJumbaq({ script });
      setSpotlight(normalizeItem(res.jumbaq || res.item || res));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSpotlight(null);
    } finally {
      setBusy('');
    }
  };

  const revealedCount = useMemo(
    () => Object.values(progressMap).filter((p) => p?.revealed).length,
    [progressMap]
  );
  const favoriteCount = useMemo(
    () => Object.values(progressMap).filter((p) => p?.favorited).length,
    [progressMap]
  );

  return (
    <ProtectedContent>
    <PageGate
      status={status}
      error={error}
      onRetry={reload}
      backHref="/literature"
      backLabel={t('literatureBack', script)}
    >
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-4xl px-6 pt-8 md:px-10">
          <Link
            to="/literature"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/45 hover:text-teal-900"
          >
            <Icon name="left" /> {t('literatureBack', script)}
          </Link>

          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-sky-800/60">
                {t('folkWisdom', script)}
              </p>
              <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
                {t('jumbaqlar', script)}
              </h1>
              <AnimIconDivider amber className="mt-2 mb-1" />
              <p className="mt-2 max-w-lg text-sm text-ink/55">
                {total} {t('jumbaqUnit', script)} · {t('jumbaqIntro', script)}
              </p>
            </div>
            <ScriptToggle value={script} onChange={setScript} />
          </div>

          <div className="mb-8 flex flex-wrap gap-2 text-xs font-semibold">
            {continueJumbaq && !topar && !utopar && !q && (
              <>
                <Link
                  to={continueJumbaq.href}
                  className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-sky-800 px-3.5 py-1.5 text-white`}
                >
                  <Icon name="sparkle" /> {text(KAA.continueJumbaq)}
                  {continueJumbaq.label ? (
                    <span className="max-w-[10rem] truncate opacity-90">· {continueJumbaq.label}</span>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={abandonContinue}
                  className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-ink/55 hover:text-teal-900"
                >
                  {text(KAA.jumbaqAbandon)}
                </button>
              </>
            )}
            {continueJumbaq && (topar || utopar || q) && (
              <div className="flex w-full flex-wrap items-center gap-2">
                <p className="w-full text-[0.7rem] font-medium text-sky-900/65 sm:w-auto">
                  {text(KAA.jumbaqResumeHint)}
                </p>
                <button
                  type="button"
                  onClick={abandonContinue}
                  className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-ink/55 hover:text-teal-900"
                >
                  {text(KAA.jumbaqAbandon)}
                </button>
                <Link
                  to="/quiz"
                  className="qp-chip text-teal-950"
                >
                  <Icon name="trophy" /> {text(KAA.jumbaqLater)}
                </Link>
              </div>
            )}
            <span className="qp-chip text-ink/55">
              {t('revealed', script)}: {revealedCount}
            </span>
            <span className="qp-chip text-ink/55">
              {t('saved', script)}: {favoriteCount}
            </span>
            {(revealMeta.streak > 0 || revealMeta.todayCount > 0) && (
              <button
                type="button"
                onClick={loadRandom}
                className={`rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-amber-950 ${anim.streakFlame}`}
              >
                <span className={anim.streakDot} aria-hidden />
                {t('jumbaqStreakCta', script).replace(
                  '{n}',
                  String(revealMeta.streak || revealMeta.todayCount || 1)
                )}
              </button>
            )}
            <button
              type="button"
              onClick={loadRandom}
              disabled={busy === 'random'}
              className="rounded-full bg-teal-100 px-3 py-1.5 text-teal-950 transition hover:bg-teal-200 disabled:opacity-50"
            >
              <Icon name="sparkle" className="mr-1" />
              {busy === 'random' ? '...' : t('random', script)}
            </button>
          </div>

          {revealedCount === 0 && !continueJumbaq && items.length > 0 && (
            <div className="mb-8 rounded-2xl border border-sky-700/15 bg-gradient-to-br from-sky-50/70 via-white/80 to-amber-50/35 px-4 py-4">
              <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sky-800/60">
                {text(KAA.jumbaqColdEyebrow)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadRandom}
                  disabled={busy === 'random'}
                  className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-sky-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50`}
                >
                  <Icon name="sparkle" /> {text(KAA.jumbaqColdRandom)}
                </button>
                {daily ? (
                  <a
                    href="#jumbaq-daily"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    <Icon name="flame" /> {text(KAA.jumbaqColdDaily)}
                  </a>
                ) : null}
                <Link
                  to="/quiz"
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                >
                  <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                </Link>
              </div>
            </div>
          )}

          {(spotlight || daily) && (
            <div className="mb-10 grid gap-4 md:grid-cols-2">
              {daily && (
                <div id="jumbaq-daily">
                  <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-amber-800/60">
                    {t('dailyJumbaq', script)}
                  </p>
                  <JumbaqCard
                    item={withAnswer(daily)}
                    progress={progressEntry(progressMap, daily.id)}
                    onReveal={onReveal}
                    onGuess={onGuess}
                    onFavorite={onFavorite}
                    onNext={loadRandom}
                    featured
                    script={script}
                    practiceHref={practiceHref}
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              )}
              {spotlight && (
                <div>
                  <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-teal-800/60">
                    {t('random', script)}
                  </p>
                  <JumbaqCard
                    item={withAnswer(spotlight)}
                    progress={progressEntry(progressMap, spotlight.id)}
                    onReveal={onReveal}
                    onGuess={onGuess}
                    onFavorite={onFavorite}
                    onNext={loadRandom}
                    featured
                    script={script}
                    practiceHref={practiceHref}
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              )}
            </div>
          )}

          <form
            className="mb-5"
            onSubmit={(e) => {
              e.preventDefault();
              setParam({ q: draft.trim(), page: 1 });
            }}
          >
            <div className="flex gap-2">
              <label className="relative flex-1">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/35"
                />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('jumbaqSearchPlaceholder', script)}
                  className="w-full qp-card qp-card--static py-3.5 pl-11 pr-4 text-sm outline-none focus:border-sky-600/40 focus:bg-white"
                />
              </label>
              <button
                type="submit"
                className="rounded-2xl bg-sky-700 px-5 text-sm font-bold text-white hover:bg-sky-800"
              >
                {t('searchBtn', script)}
              </button>
            </div>
          </form>

          {categories.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setParam({ topar: '', utopar: '', page: 1 })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  !topar
                    ? 'bg-sky-800 text-white'
                    : 'border border-ink/10 bg-white/45 text-ink/55 hover:text-sky-900'
                }`}
              >
                {t('allItems', script)}
              </button>
              {categories.map((cat) => {
                const key = String(cat.topar ?? cat.id ?? cat.label);
                const active = String(topar) === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setParam({
                        topar: active ? '' : key,
                        utopar: '',
                        page: 1,
                      })
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'bg-sky-800 text-white'
                        : 'border border-ink/10 bg-white/45 text-ink/55 hover:text-sky-900'
                    }`}
                  >
                    {cat.label || `${t('group', script)} ${cat.topar}`}
                    {cat.count != null ? ` · ${cat.count}` : ''}
                  </button>
                );
              })}
            </div>
          )}

          {items.length === 0 ? (
            <div className="qp-surface border-dashed px-6 py-16 text-center">
              <p className="font-display text-2xl text-ink/60">{t('jumbaqNotFound', script)}</p>
              <p className="mt-2 text-sm text-ink/45">{t('jumbaqNotFoundHint', script)}</p>
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.jumbaqColdEmptyHint)}
              </p>
              <FreePlayCtaRow
                links={FOOTER_FREE_LINKS}
                showSoftProfile
                justify="center"
                className="mt-4"
              />
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item, idx) => (
                <li
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
                  className="animate-dict-row"
                >
                  <JumbaqCard
                    item={withAnswer(item)}
                    progress={progressEntry(progressMap, item.id)}
                    onReveal={onReveal}
                    onGuess={onGuess}
                    onFavorite={onFavorite}
                    onNext={loadRandom}
                    script={script}
                    practiceHref={practiceHref}
                    isAuthenticated={isAuthenticated}
                  />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <nav className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParam({ page: page - 1 })}
                className="qp-btn-ghost !rounded-xl disabled:opacity-30"
              >
                ← {t('prev', script)}
              </button>
              <span className="text-xs font-semibold text-ink/50">
                {t('pageWord', script)} {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setParam({ page: page + 1 })}
                className="inline-flex items-center gap-2 qp-btn-ghost !rounded-xl disabled:opacity-30"
              >
                {t('next', script)}
                <AnimChevron count={2} className="opacity-60" />
              </button>
            </nav>
          )}
        </section>
      </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
