import { useEffect, useState, startTransition, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  searchWords,
  fetchRandomWord,
  fetchAlphabet,
  fetchByLetter,
  fetchAllWords,
  fetchPosList,
  fetchThemeList,
} from '../api/tusindirme';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import { FALLBACK_LETTERS, groupHomonyms } from '../utils/dictionaryHelpers';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import WordCard, { HomonymGroupCard } from '../components/dictionary/WordCard';
import LayoutResults from '../components/dictionary/LayoutResults';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { t as litT } from '../components/literature/litLabels';
import { AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import { jumbaqPracticeHref } from '../lib/readingPractice';
import { readJumbaqPractice } from '../lib/jumbaqProgress';
import useResumeTick from '../hooks/useResumeTick';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 40;
const SEARCH_DEBOUNCE_MS = 250;

export default function DictionaryAll() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const favorites = useDictionaryFavorites();
  const { text, script } = useUiScript();
  const { isAuthenticated } = useAuth();
  const fromJumbaq = searchParams.get('from') === 'jumbaq';
  const resumeTick = useResumeTick();
  const jumbaqPracticeCta = useMemo(() => {
    const focused = jumbaqPracticeHref(readJumbaqPractice());
    return focused || '/tutor/practice?from=jumbaq';
  }, [resumeTick]);
  const practiceCta = fromJumbaq ? jumbaqPracticeCta : '/tutor/practice';

  const initialQ = searchParams.get('q') || '';
  const initialLetter = searchParams.get('letter') || '';
  const initialPos = searchParams.get('pos') || '';
  const initialTheme = searchParams.get('theme') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [letter, setLetter] = useState(initialLetter);
  const [pos, setPos] = useState(initialPos);
  const [theme, setTheme] = useState(initialTheme);
  const [page, setPage] = useState(initialPage);

  const { status: bootstrapStatus, data: bootstrap, error: bootstrapError, reload: reloadBootstrap } =
    usePageData(
      () =>
        loadPageBundle({
          alphabet: async () => {
            const alpha = await fetchAlphabet();
            if (!alpha?.data?.length) return FALLBACK_LETTERS;
            const fromApi = alpha.data
              .filter((r) => r.arip && (Number(r.tastiyiqlangan) > 0 || Number(r.jami) > 0))
              .map((r) => r.arip);
            return fromApi.length ? fromApi : FALLBACK_LETTERS;
          },
          pos: async () => {
            const res = await fetchPosList();
            return res?.data || [];
          },
          themes: async () => {
            const res = await fetchThemeList();
            return res?.data || [];
          },
        }),
      { deps: [] }
    );

  const letters = bootstrap?.alphabet || FALLBACK_LETTERS;
  const posOptions = bootstrap?.pos || [];
  const themeOptions = bootstrap?.themes || [];

  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchMeta, setSearchMeta] = useState({ searchType: null, message: null });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const mode = debouncedQuery.trim()
    ? 'search'
    : letter
      ? 'letter'
      : pos
        ? 'pos'
        : theme
          ? 'theme'
          : 'all';

  usePageMeta(
    debouncedQuery.trim()
      ? text(`"${debouncedQuery.trim()}" izlew`)
      : letter
        ? text(`${letter} háripi`)
        : pos
          ? text('Sóz túrkimi')
          : theme
            ? text('Tema')
            : text('Barlıq sózler'),
    text('Qaraqalpaq tiliniń túsindirme sózligi — anıqlama, mısal hám avtor birge.')
  );

  // Data fetch by mode (runs after bootstrap gate is ready)
  useEffect(() => {
    if (bootstrapStatus !== 'ready') return undefined;
    let cancelled = false;
    const controller = new AbortController();
    const q = debouncedQuery.trim();

    const writeParams = (obj) => {
      const clean = {};
      Object.entries(obj).forEach(([k, v]) => {
        if (v !== '' && v != null && !(k === 'page' && Number(v) === 1)) clean[k] = String(v);
      });
      // Jumbaq lookup konteksti — filter/search sync da saqlanadı
      if (fromJumbaq) clean.from = 'jumbaq';
      // URL o‘zgarmagan bo‘lsa yozmaymiz — sync effekt qayta ishga tushmasin
      const next = new URLSearchParams(clean).toString();
      const current = window.location.search.replace(/^\?/, '');
      if (next !== current) setSearchParams(clean, { replace: true });
    };

    (async () => {
      try {
        setSearching(true);
        setError(null);

        if (q) {
          const data = await searchWords(q, 30, { signal: controller.signal });
          if (cancelled) return;
          setResults(data.data || []);
          setSuggestions(data.suggestions || []);
          setSearchMeta({
            searchType: data.searchType || null,
            message: data.message || null,
          });
          setTotal(data.data?.length || 0);
          setTotalPages(1);
          writeParams({ q });
          return;
        }

        if (letter) {
          const data = await fetchByLetter(letter, page, PAGE_SIZE, {
            signal: controller.signal,
          });
          if (cancelled) return;
          setResults(data.data || []);
          setSuggestions([]);
          setSearchMeta({ searchType: null, message: null });
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 0);
          writeParams({ letter, page });
          return;
        }

        if (pos) {
          const data = await fetchAllWords(
            { page, limit: PAGE_SIZE, pos },
            { signal: controller.signal }
          );
          if (cancelled) return;
          setResults(data.data || []);
          setSuggestions([]);
          setSearchMeta({ searchType: null, message: null });
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 0);
          writeParams({ pos, page });
          return;
        }

        if (theme) {
          const data = await fetchAllWords(
            { page, limit: PAGE_SIZE, theme },
            { signal: controller.signal }
          );
          if (cancelled) return;
          setResults(data.data || []);
          setSuggestions([]);
          setSearchMeta({ searchType: null, message: null });
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 0);
          writeParams({ theme, page });
          return;
        }

        const data = await fetchAllWords(
          { page, limit: PAGE_SIZE },
          { signal: controller.signal }
        );
        if (cancelled) return;
        setResults(data.data || []);
        setSuggestions([]);
        setSearchMeta({ searchType: null, message: null });
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        writeParams({ page });
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapStatus, debouncedQuery, letter, pos, theme, page, fromJumbaq]);

  // Sync URL → local when back/forward
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setLetter(searchParams.get('letter') || '');
    setPos(searchParams.get('pos') || '');
    setTheme(searchParams.get('theme') || '');
    setPage(Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1));
  }, [searchParams]);

  const groups = useMemo(() => groupHomonyms(results), [results]);

  const [activeIdx, setActiveIdx] = useState(-1);
  const activeRef = useRef(null);

  useEffect(() => {
    setActiveIdx(-1);
  }, [mode, results]);

  useEffect(() => {
    if (activeIdx >= 0 && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIdx]);

  const clearFilters = () => {
    startTransition(() => {
      setQuery('');
      setLetter('');
      setPos('');
      setTheme('');
      setPage(1);
      // Filtrlerni tozalaw — from konteksti ham óshiriladi (niyetli)
      setSearchParams({}, { replace: true });
    });
  };

  const wordHref = (id) =>
    fromJumbaq ? `/dictionary/${id}?from=jumbaq` : `/dictionary/${id}`;

  const selectLetter = (lit) => {
    setQuery('');
    setPos('');
    setTheme('');
    setPage(1);
    setLetter(letter === lit ? '' : lit);
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      clearFilters();
      return;
    }
    if (!groups.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, groups.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      const target = activeIdx >= 0 ? groups[activeIdx] : mode === 'search' ? groups[0] : null;
      if (target) navigate(wordHref(target.items[0].id));
    }
  };

  const onRandom = async () => {
    try {
      const data = await fetchRandomWord();
      if (data.data?.id) navigate(wordHref(data.data.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const statusText = (() => {
    if (searching) return text('Júklenip atır...');
    if (mode === 'search') {
      if (results.length === 0) return text(`"${query}" — nátiyje joq`);
      return text(`"${query}" — ${results.length} nátiyje`);
    }
    if (mode === 'letter') return text(`"${letter}" — ${total} sóz`);
    if (mode === 'pos') {
      const label = posOptions.find((p) => p.slug === pos)?.label || pos;
      return text(`${label} — ${total} sóz`);
    }
    if (mode === 'theme') {
      const label = themeOptions.find((t) => t.slug === theme)?.label || theme;
      return text(`${label} — ${total} sóz`);
    }
    return text(`${total.toLocaleString('kk')} sóz`);
  })();

  const showPager = mode !== 'search' && totalPages > 1;

  return (
    <ProtectedContent>
    <PageGate
      status={bootstrapStatus}
      error={bootstrapError}
      onRetry={reloadBootstrap}
      backHref={fromJumbaq ? '/jumbaqlar' : '/dictionary'}
      backLabel={fromJumbaq ? litT('jumbaqBackList', script) : 'Sózlik'}
    >
    <DictShell className="pt-24 pb-20">
      <section className="relative max-w-3xl mx-auto px-6 md:px-10 pt-8 md:pt-12">
        <Link
          to={fromJumbaq ? '/jumbaqlar' : '/dictionary'}
          className="inline-flex items-center gap-2 text-sm text-ink/45 hover:text-teal-900 mb-6 transition-colors"
        >
          ← {fromJumbaq ? litT('jumbaqBackList', script) : text('Sózlik')}
        </Link>
        <p className="font-display text-4xl md:text-5xl text-ink tracking-tight mb-3 animate-dict-rise">
          {text('Barlıq sózler')}
        </p>
        <p className="max-w-lg text-ink/65 text-lg leading-relaxed mb-8 animate-dict-rise-delay">
          {text('Izlew, álipbe, sóz túrkimi yamasa tema boyınsha.')}
        </p>

        {fromJumbaq && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/20 bg-sky-50/80 px-4 py-3 animate-dict-rise-delay">
            <p className="flex-1 text-sm leading-6 text-sky-950/80">
              {litT('jumbaqFromBanner', script)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/jumbaqlar"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-600/25 bg-white px-3.5 py-1.5 text-xs font-bold text-sky-950"
              >
                {litT('jumbaqBackList', script)}
                <AnimChevron count={2} className="opacity-70" />
              </Link>
              <Link
                to={practiceCta}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6 animate-dict-rise-delay-2">
          <label className="relative flex-1">
            <span className="sr-only">{text('Sóz izlew')}</span>
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40 text-xl" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setLetter('');
                setPos('');
                setTheme('');
                setPage(1);
                setQuery(e.target.value);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={text('Sóz jazıń... (latın yamasa kirill)')}
              className="w-full qp-card qp-card--static py-4 pl-12 pr-4 text-lg text-ink shadow-sm placeholder:text-ink/45 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/10 transition-colors"
              autoComplete="off"
              role="combobox"
              aria-expanded={groups.length > 0}
              aria-controls="dict-results-list"
              aria-activedescendant={activeIdx >= 0 ? `dict-result-${activeIdx}` : undefined}
            />
          </label>
          <button
            type="button"
            onClick={onRandom}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/20 transition-all hover:-translate-y-0.5 hover:from-teal-800 hover:to-emerald-800"
          >
            <Icon name="sparkle" /> {text('Qálese')}
          </button>
        </div>

        {/* Alphabet strip */}
        <div className="mb-5 -mx-1">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-ink/35 mb-3 px-1">
            {text('Álipbe')}
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-2 px-1 alphabet-scroll">
            {letters.map((lit) => (
              <button
                key={lit}
                type="button"
                onClick={() => selectLetter(lit)}
                className={`shrink-0 min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium transition-all ${
                  letter === lit
                    ? 'bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-md shadow-teal-900/25 scale-110'
                    : 'bg-white/40 text-ink/70 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-600/30 border border-ink/[0.06]'
                }`}
              >
                {text(lit)}
              </button>
            ))}
          </div>
        </div>

        {/* POS chips */}
        {posOptions.length > 0 && (
          <div className="mb-4">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-ink/35 mb-2">
              {text('Túrkim')}
            </p>
            <div className="flex flex-wrap gap-2">
              {posOptions.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setLetter('');
                    setTheme('');
                    setPage(1);
                    setPos(pos === p.slug ? '' : p.slug);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    pos === p.slug
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-700 text-white shadow-md shadow-teal-900/25'
                      : 'bg-white/40 text-ink/65 border border-ink/[0.06] hover:bg-teal-50 hover:text-teal-900 hover:border-teal-500/30'
                  }`}
                >
                  {text(p.label)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Theme chips */}
        {themeOptions.length > 0 && (
          <div className="mb-6">
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-ink/35 mb-2">
              {text('Tema')}
            </p>
            <div className="flex flex-wrap gap-2">
              {themeOptions.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setLetter('');
                    setPos('');
                    setPage(1);
                    setTheme(theme === t.slug ? '' : t.slug);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    theme === t.slug
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-900/25'
                      : 'bg-white/40 text-ink/65 border border-ink/[0.06] hover:bg-amber-50 hover:text-amber-900 hover:border-amber-500/30'
                  }`}
                >
                  {text(t.label)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-10 text-sm">
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-600/15 px-3 py-1.5 text-teal-900 font-medium">
            <Icon name="book" className="text-teal-700" /> {statusText}
          </p>
          {(query || letter || pos || theme) && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-500/20 px-3 py-1.5 text-rose-700 font-medium transition-colors hover:bg-rose-100"
            >
              ✕ {text('Tazalaw')}
            </button>
          )}
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 md:px-10">
        {searching && (
          <p className="text-ink/60 py-16 text-center font-display text-2xl">
            {text('Sózler júklenip atır...')}
          </p>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="mb-4 text-red-800">{text(error)}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mb-6 underline text-ink"
            >
              {text(KAA.qaytaUriniw)}
            </button>
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.notFoundFreeEyebrow)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                to={practiceCta}
                className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
            </div>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" compact />
          </div>
        )}

        {!error && mode === 'search' && results.length === 0 && !searching && (
          <div className="mb-10 motion-rise">
            <p className="mb-2 text-center font-display text-xl text-ink/60">
              {text(`“${query}” boyınsha hesh nárse tabılmadı`)}
            </p>
            <p className="mb-6 text-center text-sm text-ink/45">{text(KAA.dictSearchEmptyHint)}</p>
            {suggestions.length === 0 && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to={practiceCta}
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                </div>
                <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mb-8" compact />
                {!isAuthenticated ? (
                  <GuestSoftContinue
                    className="mx-auto mb-8 max-w-md text-left"
                    titleKey={null}
                    bodyKey="authGuestFreeBody"
                    compact
                  />
                ) : null}
              </>
            )}
            {suggestions.length > 0 && (
              <>
                <p className="mb-4 text-[0.7rem] uppercase tracking-[0.18em] text-ink/40">
                  {text(searchMeta.message || 'Bálkim bular?')}
                </p>
                <LayoutResults
                  id="dict-suggestions-list"
                  className="mb-6 space-y-4"
                  items={suggestions}
                  getKey={(entry) => entry.id}
                >
                  {(entry) => (
                    <WordCard
                      entry={entry}
                      query={query}
                      favoriteActive={favorites.has(entry.id)}
                      onFavoriteToggle={favorites.toggle}
                      from={fromJumbaq ? 'jumbaq' : null}
                    />
                  )}
                </LayoutResults>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to={practiceCta}
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                </div>
                <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" compact />
              </>
            )}
          </div>
        )}

        {!error && mode === 'search' && results.length > 0 && searchMeta.message && !searching && (
          <p className="mb-4 text-[0.7rem] uppercase tracking-[0.18em] text-ink/40">
            {text(searchMeta.message)}
          </p>
        )}

        {!error && results.length === 0 && mode !== 'search' && !searching && (
          <div className="qp-surface motion-rise border-dashed px-6 py-12 text-center">
            <p className="text-ink/55">{text('Hesh qanday sóz tabılmadı.')}</p>
            <p className="mt-2 text-sm text-ink/45">{text(KAA.dictBrowseEmptyHint)}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                to={practiceCta}
                className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
              <button
                type="button"
                onClick={onRandom}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
              >
                <Icon name="sparkle" /> {text('Qálese')}
              </button>
            </div>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" compact />
            {!isAuthenticated ? (
              <GuestSoftContinue
                className="mx-auto mt-3 max-w-md text-left"
                titleKey={null}
                bodyKey="authGuestFreeBody"
                compact
              />
            ) : null}
          </div>
        )}

        <LayoutResults
          items={groups}
          getKey={(group) => group.items[0].id}
          activeIdx={activeIdx}
          activeRef={activeRef}
        >
          {(group) =>
            group.items.length > 1 ? (
              <HomonymGroupCard
                group={group}
                query={query}
                favoriteActive={favorites.has(group.items[0].id)}
                onFavoriteToggle={favorites.toggle}
                from={fromJumbaq ? 'jumbaq' : null}
              />
            ) : (
              <WordCard
                entry={group.items[0]}
                query={query}
                favoriteActive={favorites.has(group.items[0].id)}
                onFavoriteToggle={favorites.toggle}
                from={fromJumbaq ? 'jumbaq' : null}
              />
            )
          }
        </LayoutResults>

        {showPager && (
          <nav className="mt-12 flex items-center justify-between gap-4" aria-label={text('Bet')}>
            <button
              type="button"
              disabled={page <= 1 || searching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-teal-700/25 bg-white/60 px-4 py-2 text-sm font-medium text-teal-900 transition-all hover:-translate-y-0.5 hover:bg-teal-50 disabled:opacity-30 disabled:hover:translate-y-0"
            >
              ← {text('Aldıńǵı')}
            </button>
            <p className="rounded-full bg-white/60 border border-ink/[0.06] px-4 py-1.5 text-sm font-semibold text-ink/60">
              {page} / {totalPages}
            </p>
            <button
              type="button"
              disabled={page >= totalPages || searching}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-teal-900/20 transition-all hover:-translate-y-0.5 hover:from-teal-800 hover:to-emerald-800 disabled:opacity-30 disabled:hover:translate-y-0"
            >
              {text('Keyingi')} →
            </button>
          </nav>
        )}
      </section>
    </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
