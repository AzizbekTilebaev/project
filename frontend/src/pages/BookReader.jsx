import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ProtectedContent from '../components/ProtectedContent';
import ReadingToolbar from '../components/literature/ReadingToolbar';
import SectionTape from '../components/literature/SectionTape';
import {
  clearBookContinue,
  readBookProgressMap,
  readReaderPrefs,
  themeClasses,
  writeBookProgressLocal,
  writeReaderPrefs,
} from '../components/literature/litUtils';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchBookById, saveBookProgress } from '../api/books';
import { fetchWorkPieces } from '../api/literature';
import {
  getReadingLessonMeta,
  queueReadingTitleId,
  readReadingPractice,
} from '../lib/readingProgress';
import { readingPracticeHref } from '../lib/readingPractice';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import TappableParagraph from '../components/literature/TappableParagraph';
import useResumeTick from '../hooks/useResumeTick';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { useAuth } from '../contexts/AuthContext';

function foldTitleKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’ʻ`'´]/g, '')
    // rough cyr→lat for title compare (enough for book titles)
    .replace(/а/g, 'a')
    .replace(/ә/g, 'a')
    .replace(/б/g, 'b')
    .replace(/в/g, 'v')
    .replace(/г/g, 'g')
    .replace(/ғ/g, 'g')
    .replace(/д/g, 'd')
    .replace(/е/g, 'e')
    .replace(/ё/g, 'e')
    .replace(/ж/g, 'j')
    .replace(/з/g, 'z')
    .replace(/и/g, 'i')
    .replace(/й/g, 'y')
    .replace(/к/g, 'k')
    .replace(/қ/g, 'q')
    .replace(/л/g, 'l')
    .replace(/м/g, 'm')
    .replace(/н/g, 'n')
    .replace(/ң/g, 'n')
    .replace(/о/g, 'o')
    .replace(/ө/g, 'o')
    .replace(/п/g, 'p')
    .replace(/р/g, 'r')
    .replace(/с/g, 's')
    .replace(/т/g, 't')
    .replace(/у/g, 'u')
    .replace(/ү/g, 'u')
    .replace(/ў/g, 'w')
    .replace(/ф/g, 'f')
    .replace(/х/g, 'x')
    .replace(/ҳ/g, 'h')
    .replace(/ц/g, 'c')
    .replace(/ч/g, 'ch')
    .replace(/ш/g, 'sh')
    .replace(/щ/g, 'sh')
    .replace(/ъ/g, '')
    .replace(/ы/g, 'i')
    .replace(/ь/g, '')
    .replace(/э/g, 'e')
    .replace(/ю/g, 'yu')
    .replace(/я/g, 'ya')
    .replace(/[^a-z0-9]+/g, '');
}

function isAboutBookSection(rawTitle, book, index) {
  if (index !== 0 || !rawTitle) return false;
  if (/kitap haqqında|muqova|обложка|kitap haqqinda/i.test(rawTitle)) return true;
  const raw = foldTitleKey(rawTitle);
  if (!raw || raw.length < 4) return false;
  const candidates = [book?.titleOriginal, book?.titleLatin, book?.title]
    .map(foldTitleKey)
    .filter((c) => c && c.length >= 4);
  return candidates.some((c) => c === raw || raw.includes(c) || c.includes(raw));
}

function resolveSections(book, pieces, script) {
  if (Array.isArray(pieces) && pieces.length) {
    return pieces.map((p, i) => {
      const rawOrig = p.titleOriginal || p.titleCyrillic || p.title || '';
      const isAbout = isAboutBookSection(rawOrig, book, i);
      let title;
      if (isAbout) {
        title = t('aboutBook', script);
      } else if (script === 'latin') {
        title = p.titleLatin || p.title || `${t('section', script)} ${i + 1}`;
      } else {
        title =
          p.titleCyrillic ||
          p.titleOriginal ||
          p.title ||
          `${t('section', script)} ${i + 1}`;
      }
      let paragraphs = p.paragraphs || [];
      if (script === 'latin' && Array.isArray(p.paragraphsLatin) && p.paragraphsLatin.length) {
        paragraphs = p.paragraphsLatin;
      } else if (
        script !== 'latin' &&
        Array.isArray(p.paragraphsCyrillic) &&
        p.paragraphsCyrillic.length
      ) {
        paragraphs = p.paragraphsCyrillic;
      } else if (
        script !== 'latin' &&
        Array.isArray(p.paragraphsOriginal) &&
        p.paragraphsOriginal.length
      ) {
        paragraphs = p.paragraphsOriginal;
      }
      if (typeof paragraphs === 'string') {
        paragraphs = paragraphs.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
      }
      if (!Array.isArray(paragraphs)) paragraphs = [];
      return {
        title,
        paragraphs: paragraphs.map((x) => String(x || '').trim()).filter(Boolean),
        pieceId: p.id || null,
        sectionIndex: p.sectionIndex ?? i,
        kind: isAbout ? 'about' : 'piece',
        workYear: p.workYear ?? null,
        workDateLabel: p.workDateLabel || null,
        workPlace: p.workPlace || null,
      };
    });
  }

  const sections = book?.sections || [];
  return sections.map((s, i) => ({
    title: s.title || `${t('section', script)} ${i + 1}`,
    paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs : [],
    pieceId: null,
    sectionIndex: i,
    workYear: null,
    workDateLabel: null,
    workPlace: null,
  }));
}

function persistProgress(bookId, sectionIndex, paragraphIndex, totalParagraphs, completed) {
  const total = Math.max(1, totalParagraphs || 1);
  const percent = completed
    ? 100
    : Math.min(99, Math.round(((sectionIndex + (paragraphIndex + 1) / total) / Math.max(1, sectionIndex + 1)) * 100));

  writeBookProgressLocal(bookId, {
    section: sectionIndex,
    sectionIndex,
    paragraph: paragraphIndex,
    paragraphIndex,
    percent: completed ? 100 : percent,
    done: Boolean(completed),
    completed: Boolean(completed),
  });

  saveBookProgress(bookId, {
    sectionIndex,
    paragraphIndex,
    percent: completed ? 100 : Math.min(99, Math.round(((paragraphIndex + 1) / total) * 100)),
    completed: Boolean(completed),
  }).catch(() => {});
}

export default function BookReader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const [prefs, setPrefs] = useState(() => {
    const stored = readReaderPrefs();
    return { ...stored, script };
  });
  const [tocOpen, setTocOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [gloss, setGloss] = useState(null); // { lemma, status, word, queued, msg }
  const [tapBusy, setTapBusy] = useState(false);
  const [sectionEnd, setSectionEnd] = useState(false);
  const [testLater, setTestLater] = useState(false);
  const paraRefs = useRef([]);
  const endRef = useRef(null);
  const saveTimer = useRef(null);
  const skipPersistRef = useRef(false);
  const resumeTick = useResumeTick();

  const sectionParam = Number(searchParams.get('section') ?? searchParams.get('s') ?? 0) || 0;
  const paraParam = Number(searchParams.get('p') ?? searchParams.get('paragraph') ?? 0) || 0;
  // Eki rejim: 'read' — kitaptay varaqlaw, 'sections' — bólimler tasması
  const view = searchParams.get('view') === 'sections' ? 'sections' : 'read';

  // Keep reader prefs.script locked to global Header / ScriptToggle
  useEffect(() => {
    setPrefs((prev) => (prev.script === script ? prev : { ...prev, script }));
  }, [script]);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        { bookPayload: () => fetchBookById(id) },
        {
          literature: async () => {
            const res = await fetchWorkPieces(id, { script });
            return {
              pieces: res.pieces || res.items || [],
              work: res.work || null,
            };
          },
        }
      ),
    { deps: [id, script], enabled: Boolean(id) }
  );

  const bookRaw = data?.bookPayload?.book || null;
  const litWork = data?.literature?.work || null;
  const book = bookRaw
    ? {
        ...bookRaw,
        titleOriginal: litWork?.titleOriginal || bookRaw.titleOriginal,
        titleLatin: litWork?.titleLatin || bookRaw.titleLatin,
        title:
          script === 'latin'
            ? litWork?.titleLatin || litWork?.title || bookRaw.titleLatin || bookRaw.title
            : litWork?.titleCyrillic ||
              litWork?.titleOriginal ||
              litWork?.title ||
              bookRaw.titleCyrillic ||
              bookRaw.title,
        author:
          script === 'latin'
            ? litWork?.authorLatin || litWork?.author || bookRaw.authorLatin || bookRaw.author
            : litWork?.authorCyrillic ||
              litWork?.authorOriginal ||
              litWork?.author ||
              bookRaw.authorCyrillic ||
              bookRaw.author,
      }
    : null;
  const sections = useMemo(
    () => resolveSections(book, data?.literature?.pieces, script),
    [book, data?.literature?.pieces, script]
  );

  const sectionIndex = Math.min(
    Math.max(0, sectionParam),
    Math.max(0, sections.length - 1)
  );
  const section = sections[sectionIndex];
  const paragraphs = useMemo(() => section?.paragraphs || [], [section]);
  const readerPrefs = useMemo(() => ({ ...prefs, script }), [prefs, script]);
  const themes = themeClasses(readerPrefs.theme);

  usePageMeta(
    book ? `${t('readMode', script)} — ${book.title}` : t('readMode', script),
    section?.title || book?.author || t('readMode', script)
  );

  const updatePrefs = (next) => {
    const written = writeReaderPrefs({ ...next, script: next.script ?? script });
    setPrefs(written);
    if (written.script !== script) setScript(written.script);
  };

  const goSection = useCallback(
    (idx, paragraph = 0) => {
      const safe = Math.min(Math.max(0, idx), Math.max(0, sections.length - 1));
      const q = new URLSearchParams(searchParams);
      q.set('section', String(safe));
      q.delete('view');
      if (paragraph > 0) q.set('p', String(paragraph));
      else q.delete('p');
      setSearchParams(q, { replace: true });
      setTocOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, sections.length, setSearchParams]
  );

  const setView = useCallback(
    (next) => {
      const q = new URLSearchParams(searchParams);
      if (next === 'sections') q.set('view', 'sections');
      else q.delete('view');
      setSearchParams(q, { replace: true });
      setTocOpen(false);
    },
    [searchParams, setSearchParams]
  );

  const tapeItems = useMemo(
    () =>
      sections.map((s, i) => ({
        key: s.pieceId || i,
        index: i,
        title: s.title || `${t('section', script)} ${i + 1}`,
        preview: (s.paragraphs?.[0] || '').slice(0, 110),
        count: s.paragraphs?.length || 0,
      })),
    [sections, script]
  );
  const localProgress = readBookProgressMap()[id] || null;

  // Restore progress on first load when no section query
  useEffect(() => {
    if (!id || searchParams.has('section') || searchParams.has('s')) return;
    const local = readBookProgressMap()[id];
    if (local && !local.done && local.section != null) {
      const q = new URLSearchParams(searchParams);
      q.set('section', String(local.section));
      if (local.paragraph) q.set('p', String(local.paragraph));
      setSearchParams(q, { replace: true });
    }
  }, [id, searchParams, setSearchParams]);

  useEffect(() => {
    setSectionEnd(false);
    setTestLater(false);
  }, [id, sectionIndex]);

  // Bólim aqırına jetkende mini-test usınıladı
  useEffect(() => {
    const el = endRef.current;
    if (!el || !paragraphs.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSectionEnd(true);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, sectionIndex, paragraphs.length, view]);

  // Paragraph-level progress via IntersectionObserver
  useEffect(() => {
    if (!id || !paragraphs.length) return undefined;
    paraRefs.current = paraRefs.current.slice(0, paragraphs.length);
    const lastPara = paragraphs.length - 1;

    const observer = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number(entry.target.getAttribute('data-para'));
          if (Number.isNaN(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (!best) return;
        if (best.idx >= lastPara) setSectionEnd(true);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          if (skipPersistRef.current) return;
          persistProgress(id, sectionIndex, best.idx, paragraphs.length, false);
        }, 400);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.25, 0.5, 0.75] }
    );

    paraRefs.current.forEach((el) => el && observer.observe(el));
    if (paraParam >= lastPara) setSectionEnd(true);
    if (!skipPersistRef.current) {
      persistProgress(id, sectionIndex, Math.min(paraParam, paragraphs.length - 1), paragraphs.length, false);
    }

    return () => {
      observer.disconnect();
      clearTimeout(saveTimer.current);
    };
  }, [id, sectionIndex, paragraphs, paraParam]);

  // Deep-link scroll to paragraph
  useEffect(() => {
    if (!paraParam || !paraRefs.current[paraParam]) return;
    const t = setTimeout(() => {
      paraRefs.current[paraParam]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [paraParam, sectionIndex, paragraphs.length]);

  const pct = sections.length
    ? Math.round(((sectionIndex + 1) / sections.length) * 100)
    : 0;
  const isLast = sectionIndex >= sections.length - 1;
  const readingMeta = useMemo(() => getReadingLessonMeta(), [celebrate, resumeTick]);
  const learnHref = `/books/${encodeURIComponent(id)}/learn?section=${sectionIndex}`;
  const showReadingMashq = readingMeta.practiceCount > 0 || readingMeta.missedCount > 0;
  const mashqHref =
    readingPracticeHref(readReadingPractice()) || '/tutor/practice?from=reading';

  useEffect(() => {
    setGloss(null);
  }, [sectionIndex, id]);

  useEffect(() => {
    if (!gloss) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setGloss(null);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [gloss]);

  async function onWordTap(lemma) {
    const word = String(lemma || '').trim();
    if (!word || tapBusy) return;
    setTapBusy(true);
    setGloss({ lemma: word, status: 'loading', word: null, morph: null, queued: false, msg: '' });
    try {
      const [{ searchWords }, { analyzeMorphology }, { toLatin }] = await Promise.all([
        import('../api/tusindirme'),
        import('../api/morphology'),
        import('../utils/qqScript'),
      ]);

      const [searchRes, morphRes] = await Promise.all([
        searchWords(word, 8).catch(() => null),
        analyzeMorphology(word, { script }).catch(() => null),
      ]);
      const morph = morphRes?.analysis || null;

      const foldKey = (s) =>
        toLatin(String(s || ''))
          .toLocaleLowerCase('kk')
          .normalize('NFC')
          .replace(/[''`´ʻʼ']/g, '')
          .replace(/\s+/g, '')
          .trim();

      // Aldın anıq teńlik (latın/kirill), keyin fuzzy (list[0]) — avvalgidek
      const pickExact = (rows, needle) => {
        const list = rows || [];
        const key = foldKey(needle);
        if (!key) return list[0] || null;
        return (
          list.find((w) => foldKey(w.soz) === key) ||
          list.find((w) => foldKey(w.base_soz) === key) ||
          list.find((w) => foldKey(w.normalized) === key) ||
          list[0] ||
          null
        );
      };

      let exact = pickExact(searchRes?.data, word);
      let viaRoot = false;

      if (!exact?.id && morph?.root && morph.root !== word) {
        const rootRes = await searchWords(morph.root, 8).catch(() => null);
        exact = pickExact(rootRes?.data, morph.root);
        if (exact?.id) viaRoot = true;
      }
      if (!exact?.id && morph?.rootTitleId) {
        exact = {
          id: morph.rootTitleId,
          soz: morph.rootHeadword || morph.root,
          birinshi_aniqlama: '',
        };
        viaRoot = true;
      }

      if (!exact?.id) {
        setGloss({
          lemma: word,
          status: morph?.hasSuffixes ? 'morph-only' : 'miss',
          word: null,
          morph,
          queued: false,
          msg: t('readerTapMiss', script),
        });
        return;
      }
      setGloss({
        lemma: word,
        status: 'ready',
        word: exact,
        morph,
        viaRoot,
        queued: false,
        msg: viaRoot ? t('readerMorphViaRoot', script) : '',
      });
    } catch {
      setGloss({
        lemma: word,
        status: 'miss',
        word: null,
        morph: null,
        queued: false,
        msg: t('readerTapMiss', script),
      });
    } finally {
      setTapBusy(false);
    }
  }

  function addGlossToPractice() {
    if (!gloss?.word?.id) return;
    const recorded = queueReadingTitleId(gloss.word.id, {
      bookId: id,
      sectionIndex,
    });
    setGloss((prev) =>
      prev
        ? {
            ...prev,
            queued: true,
            msg: recorded.isNew
              ? t('readerTapQueued', script)
              : t('readerTapAlready', script),
          }
        : prev
    );
  }

  const finish = () => {
    if (skipPersistRef.current) return;
    persistProgress(id, sectionIndex, Math.max(0, paragraphs.length - 1), paragraphs.length, true);
    setCelebrate(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const abandonSoft = () => {
    skipPersistRef.current = true;
    clearTimeout(saveTimer.current);
    clearBookContinue(id);
    navigate('/books');
  };

  const hasResumeProgress = sectionIndex > 0 || paraParam > 0 || pct > 5;

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref={`/books/${id}`} backLabel={t('bookUnit', script)}>
      <DictShell className={`pt-24 pb-28 transition-colors duration-300 ${themes.shell}`}>
        <ProtectedContent label="book-reader">
          <section className="relative mx-auto max-w-3xl px-4 pt-4 md:px-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Link
                to={`/books/${encodeURIComponent(id)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/50 px-3 py-1.5 text-sm text-ink/60 hover:text-teal-900"
              >
                <Icon name="left" /> {t('back', script)}
              </Link>
              <div className="flex items-center gap-2">
                <div
                  className="inline-flex qp-chip !rounded-full p-1 text-xs"
                  role="group"
                  aria-label={t('viewMode', script)}
                >
                  <button
                    type="button"
                    onClick={() => setView('read')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
                      view === 'read'
                        ? 'bg-teal-800 text-white shadow-sm'
                        : 'text-ink/50 hover:text-teal-900'
                    }`}
                  >
                    <Icon name="book" /> {t('readMode', script)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('sections')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
                      view === 'sections'
                        ? 'bg-teal-800 text-white shadow-sm'
                        : 'text-ink/50 hover:text-teal-900'
                    }`}
                  >
                    <Icon name="film" /> {t('sectionsTab', script)}
                  </button>
                </div>
                <span className="rounded-full border border-teal-600/15 bg-teal-50/80 px-3 py-1 text-xs font-semibold text-teal-900">
                  {sectionIndex + 1} / {sections.length || 1}
                </span>
              </div>
            </div>

            {hasResumeProgress && !celebrate && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-700/15 bg-sky-50/60 px-4 py-3">
                <p className="text-xs text-sky-950/75">{text(KAA.bookResumeHint)}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={abandonSoft}
                    className="rounded-full border border-sky-800/25 bg-white px-3.5 py-1.5 text-xs font-bold text-sky-950"
                  >
                    {text(KAA.bookAbandon)}
                  </button>
                  <Link
                    to="/tutor/practice?from=reading"
                    className="qp-chip text-teal-950"
                  >
                    <Icon name="bolt" /> {text(KAA.bookLater)}
                  </Link>
                </div>
              </div>
            )}

            {celebrate && (
              <div
                className="mb-6 quiz-result-pop rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/90 via-white/80 to-amber-50/50 px-6 py-7 text-center"
              >
                <Icon name="trophy" className="mx-auto mb-3 text-3xl text-amber-600" />
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-emerald-800/60">
                  {t('readerFinishEyebrow', script)}
                </p>
                <h2 className="mt-1 font-display text-3xl tracking-tight text-ink">
                  {t('readerFinishTitle', script)}
                </h2>
                <p className="mt-2 text-sm text-ink/60">{t('readerFinishHint', script)}</p>
                {readingMeta.streak > 0 && (
                  <Link
                    to={mashqHref}
                    className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:underline ${anim.streakFlame}`}
                  >
                    <span className={anim.streakDot} aria-hidden />
                    {text(KAA.readingBrowseStreakCta).replace('{n}', String(readingMeta.streak))}
                    <AnimChevron count={2} className="opacity-70" />
                  </Link>
                )}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {section && section.kind !== 'about' ? (
                    <Link
                      to={learnHref}
                      className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-6 py-3 text-sm font-bold text-white`}
                    >
                      <Icon name="grammar" /> {t('readerLearnCta', script)}
                      <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                    </Link>
                  ) : (
                    <Link
                      to={`/books/${encodeURIComponent(id)}/learn?section=0`}
                      className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-6 py-3 text-sm font-bold text-white`}
                    >
                      <Icon name="grammar" /> {t('tutorNav', script)}
                      <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                    </Link>
                  )}
                  {showReadingMashq ? (
                    <Link
                      to={mashqHref}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-950"
                    >
                      <Icon name="bolt" />{' '}
                      {readingMeta.streak > 0
                        ? text(KAA.readingBrowseStreakCta).replace(
                            '{n}',
                            String(readingMeta.streak)
                          )
                        : text(KAA.readingBrowsePractice)}
                      <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-xs">
                        {readingMeta.practiceCount}
                      </span>
                    </Link>
                  ) : (
                    <Link
                      to={mashqHref}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-950"
                    >
                      <Icon name="bolt" />{' '}
                      {readingMeta.streak > 0
                        ? text(KAA.readingBrowseStreakCta).replace(
                            '{n}',
                            String(readingMeta.streak)
                          )
                        : text(KAA.practiceNav)}
                    </Link>
                  )}
                  <Link
                    to={`/books/${encodeURIComponent(id)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-3 text-sm font-semibold text-teal-900"
                  >
                    {t('readerFinishDetail', script)}
                    <AnimChevron count={2} className="opacity-60" />
                  </Link>
                  <ShareResultButton
                    title={text(KAA.shareBookTitle)}
                    text={text(KAA.shareBookText).replace(
                      '{title}',
                      book?.title || 'Kitap'
                    )}
                    url={
                      typeof window !== 'undefined' && id
                        ? `${window.location.origin}/books/${encodeURIComponent(id)}`
                        : undefined
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-3 text-sm font-semibold text-teal-950"
                  />
                </div>
                {!isAuthenticated ? (
                  <GuestSoftContinue className="mt-5 text-left" bodyKey="authGuestFreeBody" />
                ) : null}
                <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {t('readerFinishFree', script)}
                </p>
                <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" />
              </div>
            )}

            {view === 'sections' ? (
              <div className="animate-dict-rise">
                <header className="mb-6 qp-surface px-6 py-8 text-center shadow-sm md:px-10">
                  <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-teal-800/55">
                    {book?.author || t('bookUnit', script)}
                  </p>
                  <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
                    {book?.title}
                  </h1>
                  <p className="mt-2 text-sm text-ink/50">
                    {sections.length} {t('chooseSectionHint', script)}
                  </p>
                  <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-ink/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </header>
                <SectionTape
                  items={tapeItems}
                  progress={localProgress}
                  activeIndex={sectionIndex}
                  onSelect={(i) => goSection(i)}
                  script={script}
                />
                <p className="mt-4 text-center text-xs text-ink/35">
                  {t('tapeHint', script)}
                </p>
              </div>
            ) : (
              <>
            <ReadingToolbar
              prefs={readerPrefs}
              onPrefsChange={updatePrefs}
              tocOpen={tocOpen}
              onTocToggle={() => setTocOpen((v) => !v)}
              title={book?.title || ''}
              sectionLabel={section?.title}
              className={themes.bar}
            />

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>

            {tocOpen && (
              <div className="animate-dict-rise mt-4">
                <SectionTape
                  items={tapeItems}
                  progress={localProgress}
                  activeIndex={sectionIndex}
                  onSelect={(i) => goSection(i)}
                  dense
                  script={script}
                />
              </div>
            )}

            <article
              className={`animate-dict-rise mt-6 rounded-[2rem] border px-6 py-8 shadow-[0_28px_70px_-35px_rgba(28,42,36,0.4)] md:px-10 md:py-10 ${themes.paper}`}
            >
              <p className={`mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] ${themes.muted}`}>
                {t('section', script)} {sectionIndex + 1}
              </p>
              <h1 className="mb-2 font-display text-3xl tracking-tight md:text-4xl">
                {section?.title || '—'}
              </h1>
              <p className={`mb-6 text-xs ${themes.muted}`}>{t('wordTapHint', script)}</p>

              <div className="space-y-6">
                {paragraphs.length === 0 ? (
                  <p className={themes.muted}>—</p>
                ) : (
                  paragraphs.map((p, i) => (
                    <TappableParagraph
                      key={i}
                      text={p}
                      activeLemma={gloss?.lemma || null}
                      onWordTap={onWordTap}
                      paraRef={(el) => {
                        paraRefs.current[i] = el;
                      }}
                      dataPara={i}
                      style={{ fontSize: `${readerPrefs.fontSize}px`, lineHeight: 1.75 }}
                    />
                  ))
                )}
              </div>

              {(section?.workDateLabel || section?.workPlace || section?.workYear) && (
                <footer
                  className={`mt-8 border-t border-ink/10 pt-4 text-right text-sm italic ${themes.muted}`}
                >
                  {[section.workPlace, section.workDateLabel || (section.workYear ? String(section.workYear) : null)]
                    .filter(Boolean)
                    .join(', ')}
                </footer>
              )}
            </article>

            <div ref={endRef} aria-hidden="true" className="h-px w-full" />

            {section && section.kind !== 'about' && (
              sectionEnd && !testLater && !celebrate ? (
                <div
                  className="quiz-result-pop mt-6 overflow-hidden rounded-[1.75rem] border border-teal-700/20 bg-gradient-to-br from-teal-50/85 via-white/85 to-amber-50/45 px-5 py-5 shadow-sm md:px-6"
                >
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-teal-800/60">
                    {t('readerSectionDone', script)} · {t('section', script)}{' '}
                    {sectionIndex + 1}
                  </p>
                  <p className="mt-1 font-display text-xl tracking-tight text-ink">
                    {t('readerMiniTestTitle', script)}
                  </p>
                  <p className="mt-1 max-w-md text-sm text-ink/55">
                    {t('readerMiniTestHint', script)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <Link
                      to={learnHref}
                      className="qp-btn-primary shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-800"
                    >
                      <Icon name="bolt" />
                      {t('readerMiniTestStart', script)}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTestLater(true)}
                      className="rounded-full border border-teal-700/20 bg-white/70 px-4 py-2.5 text-xs font-semibold text-teal-900 transition hover:bg-white"
                    >
                      {t('readerMiniTestLater', script)}
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  to={learnHref}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900/70 transition hover:text-teal-900"
                >
                  <Icon name="grammar" />
                  {t('readerLearnCta', script)}
                </Link>
              )
            )}

            <nav className="mt-8 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={sectionIndex === 0}
                onClick={() => goSection(sectionIndex - 1)}
                className="rounded-xl border border-teal-700/25 bg-white/60 px-5 py-3 text-sm font-medium text-teal-900 transition-all hover:-translate-y-0.5 disabled:opacity-30"
              >
                ← {t('prev', script)}
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={finish}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <Icon name="trophy" /> {t('finished', script)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goSection(sectionIndex + 1)}
                  className="rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5"
                >
                  {t('next', script)} →
                </button>
              )}
            </nav>

            <p className="mt-6 text-center text-xs text-ink/35">
              {t('progressSaved', script)}
            </p>
              </>
            )}
          </section>
        </ProtectedContent>

        {gloss ? (
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={gloss.lemma}>
            <button
              type="button"
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
              aria-label={t('close', script)}
              onClick={() => setGloss(null)}
            />
            <div className="animate-dict-rise relative z-[81] mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-teal-700/20 bg-gradient-to-br from-teal-50 via-white to-amber-50/40 px-5 py-5 shadow-[0_28px_80px_-28px_rgba(28,42,36,0.55)] sm:mb-0 sm:px-6 sm:py-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display text-2xl tracking-tight text-ink">{gloss.lemma}</p>
                <button
                  type="button"
                  onClick={() => setGloss(null)}
                  className="rounded-full border border-ink/10 bg-white/80 px-3 py-1 text-xs font-semibold text-ink/50 hover:text-teal-900"
                >
                  {t('close', script)}
                </button>
              </div>

              {gloss.morph?.hasSuffixes ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {gloss.morph.segments.map((seg, i) => (
                    <span key={`${seg.latin}-${i}`} className="inline-flex items-center gap-1">
                      {i > 0 ? (
                        <span className="text-ink/25" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span
                        title={seg.gloss || seg.role}
                        className={
                          seg.isRoot
                            ? 'inline-flex items-center gap-1 rounded-full bg-teal-800 px-2.5 py-1 text-xs font-bold text-white'
                            : 'inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950'
                        }
                      >
                        {seg.isRoot ? (
                          <span className="opacity-70">{t('readerMorphRoot', script)}</span>
                        ) : null}
                        {seg.text}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}

              {gloss.morph?.hasSuffixes ? (
                <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto text-[0.7rem] text-ink/50">
                  {gloss.morph.suffixes.map((suf, i) => (
                    <li key={`${suf.latin}-g-${i}`}>
                      <span className="font-semibold text-amber-900/80">+{suf.text}</span>
                      {' — '}
                      {suf.role}
                      {suf.gloss ? ` · ${suf.gloss}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}

              {gloss.status === 'loading' && (
                <div className="mt-5" role="status" aria-live="polite">
                  <p className="text-sm text-ink/55">{t('readerTapLoading', script)}</p>
                  <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-teal-800/10">
                    <div className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-teal-700 to-emerald-500 animate-[qp-indeterminate_1.15s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}
              {(gloss.status === 'miss' || gloss.status === 'morph-only') && (
                <p className="mt-3 text-sm text-ink/55">{gloss.msg}</p>
              )}
              {gloss.status === 'ready' && gloss.word && (
                <>
                  <p className="mt-3 text-xs uppercase tracking-wider text-teal-800/55">
                    {gloss.word.soz || gloss.lemma}
                    {gloss.viaRoot ? ` · ${t('readerMorphRoot', script)}` : ''}
                  </p>
                  {gloss.word.birinshi_aniqlama ? (
                    <p className="mt-2 max-h-40 overflow-y-auto text-sm leading-relaxed text-ink/75">
                      {text(gloss.word.birinshi_aniqlama)}
                    </p>
                  ) : null}
                  {gloss.msg ? (
                    <p className="mt-2 text-xs font-semibold text-teal-800">{gloss.msg}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={tapBusy}
                      onClick={addGlossToPractice}
                      className="qp-btn-primary !px-4 !py-2 !text-xs disabled:opacity-50"
                    >
                      <Icon name="bolt" /> {t('readerTapAdd', script)}
                    </button>
                    <Link
                      to={`/dictionary/${gloss.word.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-semibold text-teal-900"
                    >
                      {text(KAA.sozlikteAshiw)}
                    </Link>
                    {showReadingMashq || gloss.queued ? (
                      <Link
                        to={mashqHref}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                      >
                        {text(KAA.readingBrowsePractice)}
                      </Link>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DictShell>
    </PageGate>
  );
}
