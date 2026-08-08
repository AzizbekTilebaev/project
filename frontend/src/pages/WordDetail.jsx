import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  fetchWordById,
} from '../api/tusindirme';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import useRecentWords from '../hooks/useRecentWords';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import FavoriteButton from '../components/dictionary/FavoriteButton';
import Icon from '../components/Icon';
import CommunitySuggestPanel from '../components/CommunitySuggestPanel';
import { fetchWordImmersion, seedImmersionListen, submitImmersionProduce } from '../api/immersion';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { useGuestQuota } from '../hooks/useGuestQuota';
import { AnimIconDivider, anim, AnimChevron, PageEnter } from '../animations';
import { KAA } from '../i18n/kaa';
import {
  applyImmersionPracticeResults,
  clearImmersionContinue,
  getContinueImmersion,
  getImmersionListenStreak,
  isImmersionWordQueued,
  recordImmersionListen,
  touchImmersionContinue,
} from '../lib/immersionProgress';
import { gradeImmersionProduceLocal } from '../lib/produceGrade';
import useResumeTick from '../hooks/useResumeTick';
import { safeMediaUrl } from '../lib/safeUrl';
import { MODEL_VIEWER } from '../lib/vendorIntegrity';
import { focusedPracticeHref, jumbaqPracticeHref } from '../lib/readingPractice';
import { readJumbaqPractice } from '../lib/jumbaqProgress';
import GuestSoftContinue from '../components/GuestSoftContinue';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { t as litT } from '../components/literature/litLabels';
import { MorphologyPanel, TranslationsPanel } from '../components/dictionary/LinkedDictPanels';
import {
  getAdminToken,
  fetchAdminMe,
  updateSenseDescription,
  createSenseDescription,
  deleteSenseDescription,
  renameDictionaryTitle,
  deactivateDictionaryTitle,
  updateExampleSentence,
  updateIdiomPhrase,
  updateIdiomGloss,
  createSenseExample,
  deleteSenseExample,
  createSenseIdiom,
  deleteSenseIdiom,
  addSenseSynonymRelation,
  removeSenseSynonymRelation,
  addSenseAntonymRelation,
  removeSenseAntonymRelation,
  addCompoundRelation,
  removeCompoundRelation,
  addWordRelation,
  removeWordRelation,
} from '../api/admin';

const FAV_GUEST_TIP_KEY = 'qp_fav_guest_tip_seen';

function WordNextSteps({
  word,
  isFavorite,
  onToggleFavorite,
  related = [],
  nextWord = null,
  fromJumbaq = false,
}) {
  const { text, script } = useUiScript();
  const lemma = word.homonyms ? word.base_soz : word.soz;
  const playHref =
    focusedPracticeHref(
      [word.id, ...related.map((r) => r?.id)].filter(Boolean),
      { exit: fromJumbaq ? 'jumbaq' : null }
    ) || `/dictionary/${encodeURIComponent(word.id)}`;
  const practiceHref = fromJumbaq
    ? jumbaqPracticeHref(readJumbaqPractice()) || '/tutor/practice?from=jumbaq'
    : `/tutor/practice?from=stats`;
  const relatedOne = related[0] || null;

  return (
    <aside className="mt-14 mb-4 qp-surface px-5 py-6 md:px-7">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
        {text(KAA.wordNextEyebrow)}
      </p>
      <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
        {text(KAA.wordNextTitle)}
      </h2>
      <p className="mt-1 text-sm text-ink/50">{text(lemma)}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onToggleFavorite}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
            isFavorite
              ? 'border border-teal-700/25 bg-white text-teal-900'
              : 'bg-teal-800 text-white hover:-translate-y-0.5'
          }`}
        >
          <Icon name="heart" filled={isFavorite} />
          {text(isFavorite ? KAA.wordNextFavDone : KAA.wordNextFav)}
        </button>

        <Link
          to={playHref}
          className={`${anim.shine} inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-900 transition hover:-translate-y-0.5`}
        >
          <Icon name="gamepad" />
          {text(KAA.wordNextPlay)}
          <AnimChevron count={2} className="opacity-70" />
        </Link>

        <Link
          to={practiceHref}
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-950 transition hover:-translate-y-0.5"
        >
          <Icon name="bolt" />
          {text(KAA.wordNextHub)}
        </Link>

        {relatedOne ? (
          <Link
            to={`/dictionary/${relatedOne.id}`}
            className="inline-flex items-center gap-2 qp-chip text-ink/70 hover:text-teal-900"
          >
            {text(KAA.wordNextRelated)}: {text(relatedOne.soz)}
          </Link>
        ) : nextWord ? (
          <Link
            to={`/dictionary/${nextWord.id}`}
            className="inline-flex items-center gap-2 qp-chip text-ink/70 hover:text-teal-900"
          >
            {text(KAA.wordNextAlpha)}: {text(nextWord.soz)}
            <AnimChevron count={2} className="opacity-60" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 border-t border-teal-700/10 pt-4">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/50">
          {text(KAA.wordNextFree)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/quiz"
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
          >
            <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
          </Link>
          <Link
            to="/crossword"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-3.5 py-1.5 text-xs font-bold text-amber-950"
          >
            <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
          </Link>
          <Link
            to="/dictionary/immersion"
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-600/25 bg-cyan-50/80 px-3.5 py-1.5 text-xs font-bold text-cyan-950"
          >
            <Icon name="sparkle" /> {text(KAA.dawisliSozler)}
          </Link>
          {fromJumbaq ? (
            <Link
              to="/jumbaqlar"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50/80 px-3.5 py-1.5 text-xs font-bold text-sky-950"
            >
              <Icon name="sparkle" /> {litT('jumbaqBackList', script)}
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function ImmersionBlock({ titleId, soz = '' }) {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listened, setListened] = useState(false);
  const [streak, setStreak] = useState(0);
  const [produceText, setProduceText] = useState('');
  const [produceBusy, setProduceBusy] = useState(false);
  const [produceResult, setProduceResult] = useState(null);
  const [guestSoft, setGuestSoft] = useState(false);
  const markedRef = useRef(false);
  const skipTouchRef = useRef(false);
  const resumeTick = useResumeTick();
  const isContinueWord = useMemo(() => {
    const cur = getContinueImmersion();
    return Boolean(cur && String(cur.id) === String(titleId || ''));
  }, [titleId, resumeTick]);

  useEffect(() => {
    skipTouchRef.current = false;
  }, [titleId]);

  useEffect(() => {
    if (!titleId) return undefined;
    let cancelled = false;
    setLoading(true);
    const queued = isImmersionWordQueued(titleId);
    setListened(queued);
    markedRef.current = queued;
    setStreak(getImmersionListenStreak());
    setProduceText('');
    setProduceResult(null);
    setGuestSoft(false);
    fetchWordImmersion(titleId)
      .then((d) => {
        if (!cancelled) setAssets(d.assets || []);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [titleId]);

  useEffect(() => {
    if (!titleId || !assets.length || skipTouchRef.current) return;
    touchImmersionContinue({ id: titleId, soz });
  }, [titleId, soz, assets.length]);

  useEffect(() => {
    const has3d = assets.some((a) => a.kind === 'model3d' && safeMediaUrl(a.fileAccess?.url));
    if (!has3d || customElements.get('model-viewer')) return undefined;
    if (document.getElementById('model-viewer-local')) return undefined;
    const script = document.createElement('script');
    script.id = 'model-viewer-local';
    script.type = 'module';
    script.src = MODEL_VIEWER.js;
    script.integrity = MODEL_VIEWER.jsIntegrity;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
    return undefined;
  }, [assets]);

  const markListened = () => {
    if (!titleId || markedRef.current) return;
    markedRef.current = true;
    const res = recordImmersionListen(titleId, { soz });
    setListened(true);
    setStreak(res.streak);
    // Authed: server SRS seed; guest/qáte — local queue jetkilikli
    seedImmersionListen(titleId, { prompt: soz || null }).catch(() => {});
  };

  const onTimeUpdate = (e) => {
    const t = e.currentTarget?.currentTime;
    if (Number(t) >= 2) markListened();
  };

  const onProduceSubmit = async (event) => {
    event?.preventDefault?.();
    if (!titleId || produceBusy || produceResult?.correct) return;
    const answer = String(produceText || '').trim();
    if (!answer) return;
    markListened();
    setProduceBusy(true);
    setGuestSoft(false);

    if (!isAuthenticated) {
      const graded = gradeImmersionProduceLocal({ lemma: soz, answer });
      setProduceResult({
        correct: graded.correct,
        nearMiss: graded.nearMiss,
        correctLemma: soz || null,
      });
      applyImmersionPracticeResults([
        { id: String(titleId), correct: Boolean(graded.correct) },
      ]);
      setGuestSoft(true);
      setProduceBusy(false);
      return;
    }

    try {
      const res = await submitImmersionProduce(titleId, {
        answer,
        prompt: soz || null,
      });
      setProduceResult({
        correct: Boolean(res.correct),
        nearMiss: Boolean(res.nearMiss),
        correctLemma: res.correctLemma || soz || null,
      });
      if (res.correct) {
        applyImmersionPracticeResults([{ id: String(titleId), correct: true }]);
      } else {
        applyImmersionPracticeResults([{ id: String(titleId), correct: false }]);
      }
    } catch {
      // Offline — server produceGrade parity (fold + soft nearMiss)
      const graded = gradeImmersionProduceLocal({ lemma: soz, answer });
      setProduceResult({
        correct: graded.correct,
        nearMiss: graded.nearMiss,
        correctLemma: soz || null,
      });
      applyImmersionPracticeResults([
        { id: String(titleId), correct: Boolean(graded.correct) },
      ]);
      setGuestSoft(true);
    } finally {
      setProduceBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="mb-12 rounded-3xl border border-teal-700/15 bg-teal-50/40 px-5 py-8 text-center">
        <Icon name="loader" className="animate-spin text-2xl text-teal-700" />
        <p className="mt-2 text-sm text-ink/45">{text('Immersiya media júklenip atır...')}</p>
      </section>
    );
  }

  if (!assets.length) {
    return (
      <section className="mb-12 overflow-hidden rounded-[2rem] border border-dashed border-teal-700/20 bg-gradient-to-br from-teal-50/40 via-white/70 to-sky-50/40 px-5 py-7 md:px-7">
        <p className="mb-1 text-[0.65rem] uppercase tracking-[0.22em] text-teal-800/70">
          {text('Immersiya')}
        </p>
        <h2 className="mb-2 font-display text-2xl tracking-tight text-ink">
          {text('Sózdi seziw')}
        </h2>
        <p className="mb-5 max-w-lg text-sm leading-relaxed text-ink/55">
          {text(
            'Bul sóz ushın audio / video / 3D házirshe joq. Tayyar dawıslı sózlerdi kóriń yamasa oyin menen úyreniń.'
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dictionary/immersion"
            className="qp-btn-primary !px-4 !py-2"
          >
            {text('Dawıslı sózler')}
          </Link>
          <Link
            to="/dictionary/game"
            className="inline-flex rounded-full border border-teal-700/30 px-4 py-2 text-sm font-semibold text-teal-900"
          >
            {text('Sóz oyını')}
          </Link>
        </div>
        <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
          {text(KAA.wordSenseEmptyFree)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/tutor/practice"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
          >
            <Icon name="bolt" /> {text(KAA.practiceNav)}
          </Link>
          <Link
            to="/quiz"
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
          >
            <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
          </Link>
          <Link
            to="/crossword"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-4 py-2 text-xs font-bold text-amber-950"
          >
            <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
          </Link>
        </div>
      </section>
    );
  }

  const kindMeta = {
    audio: { label: 'Audio', icon: 'sparkle', tone: 'from-sky-100 to-teal-50' },
    video: { label: 'Video', icon: 'eye', tone: 'from-amber-100 to-orange-50' },
    model3d: { label: '3D', icon: 'layers', tone: 'from-teal-100 to-cyan-50' },
  };
  const playHref =
    focusedPracticeHref([titleId], { exit: 'immersion' }) ||
    `/dictionary/game?source=focused&ids=${encodeURIComponent(titleId)}&exit=immersion`;

  return (
    <section className="mb-12 overflow-hidden rounded-[2rem] border border-teal-700/15 bg-gradient-to-br from-teal-50/70 via-white/80 to-cyan-50/50 px-5 py-6 md:px-7">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-teal-800/70 mb-1">
            {text('Immersiya')}
          </p>
          <h2 className="font-display text-2xl text-ink tracking-tight">{text('Sózdi seziw')}</h2>
          <Link
            to="/dictionary/immersion"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline"
          >
            {text('Basqa dawıslı sózler')}
            <AnimChevron count={2} className="opacity-70" />
          </Link>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full bg-white/80 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-900">
            {text(`${assets.length} media`)}
          </span>
          {streak > 0 && (
            <Link
              to="/tutor/practice?from=immersion"
              className={`inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 ${anim.streakFlame}`}
            >
              <span className={anim.streakDot} aria-hidden />
              {text(KAA.immersionBrowseStreakCta).replace('{n}', String(streak))}
            </Link>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {assets.map((a) => {
          const url = safeMediaUrl(a.fileAccess?.url);
          if (!url) return null;
          const meta = kindMeta[a.kind] || kindMeta.video;
          return (
            <article
              key={a.id}
              className={`overflow-hidden rounded-2xl border border-teal-200/70 bg-gradient-to-br ${meta.tone} shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}
            >
              <div className="flex items-center justify-between px-4 pt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-900">
                  <Icon name={meta.icon} /> {text(meta.label)}
                </span>
                {a.title && (
                  <span className="truncate text-xs text-ink/45 max-w-[50%]">{text(a.title)}</span>
                )}
              </div>
              <div className="p-4">
                {a.kind === 'audio' && (
                  <audio
                    controls
                    className="w-full"
                    src={url}
                    preload="none"
                    onEnded={markListened}
                    onTimeUpdate={onTimeUpdate}
                  >
                    <track kind="captions" />
                  </audio>
                )}
                {a.kind === 'video' && (
                  <video
                    controls
                    className="w-full rounded-xl bg-ink/5 aspect-video object-cover"
                    src={url}
                    preload="metadata"
                    onEnded={markListened}
                    onTimeUpdate={onTimeUpdate}
                  />
                )}
                {a.kind === 'model3d' && (
                  <div
                    className="relative overflow-hidden rounded-xl bg-white/70 border border-teal-200"
                    onPointerDown={markListened}
                    role="presentation"
                  >
                    <model-viewer
                      src={url}
                      alt={text(a.title || '3D model')}
                      camera-controls
                      auto-rotate
                      shadow-intensity="0.6"
                      style={{ width: '100%', height: '220px', background: 'transparent' }}
                    />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-3 right-3 rounded-full bg-teal-700 px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      {text('Ashıw')}
                    </a>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 qp-card qp-card--static px-4 py-4">
        {listened ? (
          <p className={`mb-3 text-sm font-semibold text-teal-950 ${anim.checkinPop}`}>
            {produceResult?.correct
              ? text(KAA.immersionProduceDone)
              : text(KAA.immersionQueuedHint)}
            {streak > 0 ? ` · ${text(KAA.immersionStreak)} ${streak}` : ''}
          </p>
        ) : (
          <p className="mb-3 text-sm text-ink/55">{text(KAA.immersionListenHint)}</p>
        )}

        {listened && !produceResult?.correct ? (
          <form onSubmit={onProduceSubmit} className="mb-4 space-y-2">
            <p className="text-xs text-ink/50">{text(KAA.immersionProduceHint)}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={produceText}
                onChange={(e) => setProduceText(e.target.value)}
                disabled={produceBusy}
                autoComplete="off"
                spellCheck={false}
                placeholder={text(KAA.immersionProducePlaceholder)}
                className="min-w-0 flex-1 rounded-2xl border border-teal-700/25 bg-white px-4 py-2.5 text-sm text-ink outline-none ring-teal-600/25 focus:ring-2 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={produceBusy || !String(produceText || '').trim()}
                className="qp-btn-primary disabled:opacity-50"
              >
                {text(KAA.immersionProduceSubmit)}
              </button>
            </div>
            {produceResult && !produceResult.correct ? (
              <p className="text-sm font-semibold text-rose-800" role="status">
                {text(KAA.tutorWrongMsg)}
                {produceResult.correctLemma ? (
                  <span className="mt-1 block font-display text-base text-ink">
                    {text(produceResult.correctLemma)}
                  </span>
                ) : null}
              </p>
            ) : null}
          </form>
        ) : null}

        {produceResult?.correct ? (
          <p
            className={`mb-4 text-sm font-semibold text-emerald-800 ${anim.checkinPop}`}
            role="status"
          >
            {produceResult.nearMiss
              ? text(KAA.tutorNearMissMsg)
              : text(KAA.tutorCorrectMsg)}
          </p>
        ) : null}

        {guestSoft ? (
          <GuestSoftContinue
            className="mb-4 text-left"
            titleKey={null}
            bodyKey="immersionBrowseGuestProduce"
            compact
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            to={playHref}
            onClick={() => markListened()}
            className={`${anim.shine} qp-btn-primary !px-4 !py-2`}
          >
            {streak > 0 && listened
              ? text(KAA.immersionBrowseStreakCta).replace('{n}', String(streak))
              : text(KAA.immersionPracticeNow)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
          <Link
            to="/quiz"
            onClick={() => markListened()}
            className="inline-flex rounded-full border border-teal-700/30 px-4 py-2 text-sm font-semibold text-teal-900"
          >
            {text(KAA.testler)}
          </Link>
          {isContinueWord && (
            <button
              type="button"
              onClick={() => {
                skipTouchRef.current = true;
                clearImmersionContinue(titleId);
              }}
              className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink/55 hover:text-teal-900"
            >
              {text(KAA.immersionAbandon)}
            </button>
          )}
          <Link
            to="/tutor/practice?from=immersion"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white/80 px-4 py-2 text-xs font-bold text-ink/55"
          >
            <Icon name="bolt" /> {text(KAA.immersionLater)}
          </Link>
        </div>
        {listened ? (
          <>
            <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.immersionListenFree)}
            </p>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-2" compact />
          </>
        ) : null}
      </div>
      <p className="mt-4 text-[11px] text-ink/40">
        {text('Dawıs — immersiya; video/3D admin júklewi menen kengen.')}
      </p>
    </section>
  );
}

function ShareButton({ word }) {
  const { text } = useUiScript();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    const title = text(`${word} — Sózlik`);
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // foydalanuvchi bekor qildi yoki qo'llanmaydi — clipboardga o'tamiz
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard yopiq bo'lsa jim qolamiz
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      title={text('Ulashıw')}
      aria-label={text('Sózdi ulashıw')}
      className="w-11 h-11 rounded-full border border-ink/15 text-ink/50 hover:text-teal-900 hover:border-teal-800/40 inline-flex items-center justify-center transition-colors"
    >
      <Icon
        name={copied ? 'check' : 'share'}
        className={`text-xl ${copied ? 'text-teal-700' : ''}`}
      />
    </button>
  );
}

function ExampleCard({
  exampleId,
  example,
  author,
  authorSlug,
  index,
  total,
  canModerate = false,
  onSaved,
}) {
  const { text } = useUiScript();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

  function startEdit() {
    setDraft(String(example || ''));
    setSaveError('');
    setEditing(true);
  }

  async function saveEdit() {
    const next = String(draft || '').trim();
    if (!next || !exampleId) return;
    setBusy(true);
    setSaveError('');
    try {
      await updateExampleSentence(exampleId, { example: next });
      setEditing(false);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function removeExample() {
    if (!exampleId) return;
    if (!window.confirm(text('Bul mısal óshiriledi. Dawam etesiz be?'))) return;
    setBusy(true);
    setSaveError('');
    try {
      await deleteSenseExample(exampleId);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <figure className="example-card group">
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-teal-800/60">
          {text(total > 1 ? `Mısal ${index + 1}` : 'Mısal')}
        </span>
        <div className="flex items-center gap-2">
          {canModerate && exampleId && !editing && (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={busy}
                className="rounded-full border border-teal-800/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50 disabled:opacity-50"
              >
                {text('Redaktorlaw')}
              </button>
              <button
                type="button"
                onClick={removeExample}
                disabled={busy}
                className="rounded-full border border-rose-300 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                {text('Óshiriw')}
              </button>
            </>
          )}
          <span className="font-display text-4xl text-teal-800/15 leading-none select-none" aria-hidden>
            ”
          </span>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 text-sm leading-relaxed text-ink"
            disabled={busy}
          />
          {saveError ? <p className="text-xs text-rose-700">{text(saveError)}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy || !draft.trim()}
              className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
            >
              {text('Saqlaw')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setSaveError('');
              }}
              disabled={busy}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50"
            >
              {text('Biykarlaw')}
            </button>
          </div>
        </div>
      ) : (
        <blockquote>
          <p className="font-display text-[1.2rem] md:text-[1.35rem] text-ink leading-[1.6] italic">
            {text(example)}
          </p>
        </blockquote>
      )}

      {!editing && saveError ? <p className="mt-2 text-xs text-rose-700">{text(saveError)}</p> : null}

      {/* Author — always its own row, never inline with quote */}
      <figcaption className="mt-6 pt-4 border-t border-dashed border-ink/10">
        {author ? (
          <div className="flex flex-col gap-1">
            <span className="text-[0.65rem] uppercase tracking-[0.18em] text-ink/35">
              {text('Avtor')}
            </span>
            {authorSlug ? (
              <Link
                to={`/writers/${encodeURIComponent(authorSlug)}`}
                className="text-teal-950 font-semibold text-base tracking-wide no-underline hover:underline"
              >
                {text(author)}
              </Link>
            ) : (
              <span className="text-teal-950 font-semibold text-base tracking-wide">
                {text(author)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-ink/35 text-sm">{text('Avtor kórsetilmegen')}</span>
        )}
      </figcaption>
    </figure>
  );
}

function IdiomItem({ idiom, canModerate = false, onSaved }) {
  const { text } = useUiScript();
  const [editingPhrase, setEditingPhrase] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState('');
  const [editingGlossId, setEditingGlossId] = useState(null);
  const [glossDraft, setGlossDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const glosses = Array.isArray(idiom.descriptions) ? idiom.descriptions : [];

  async function savePhrase() {
    const next = String(phraseDraft || '').trim();
    if (!next || !idiom.id) return;
    setBusy(true);
    setSaveError('');
    try {
      await updateIdiomPhrase(idiom.id, { phrase: next });
      setEditingPhrase(false);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function saveGloss(glossId) {
    const next = String(glossDraft || '').trim();
    if (!next || !glossId) return;
    setBusy(true);
    setSaveError('');
    try {
      await updateIdiomGloss(glossId, { description: next });
      setEditingGlossId(null);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function removeIdiom() {
    if (!idiom.id) return;
    if (!window.confirm(text('Bul frazeologizm óshiriledi. Dawam etesiz be?'))) return;
    setBusy(true);
    setSaveError('');
    try {
      await deleteSenseIdiom(idiom.id);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="idiom-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {editingPhrase ? (
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="text"
              value={phraseDraft}
              onChange={(e) => setPhraseDraft(e.target.value)}
              className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 font-display text-lg text-teal-950"
              disabled={busy}
              maxLength={255}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={savePhrase}
                disabled={busy || !phraseDraft.trim()}
                className="qp-btn-primary !px-3 !py-1 !text-xs disabled:opacity-50"
              >
                {text('Saqlaw')}
              </button>
              <button
                type="button"
                onClick={() => setEditingPhrase(false)}
                disabled={busy}
                className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 disabled:opacity-50"
              >
                {text('Biykarlaw')}
              </button>
            </div>
          </div>
        ) : (
          <p className="font-display text-lg text-teal-950">{text(idiom.phrase)}</p>
        )}
        {canModerate && idiom.id && !editingPhrase && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                setPhraseDraft(String(idiom.phrase || ''));
                setSaveError('');
                setEditingPhrase(true);
              }}
              disabled={busy}
              className="rounded-full border border-teal-800/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50 disabled:opacity-50"
            >
              {text('Redaktorlaw')}
            </button>
            <button
              type="button"
              onClick={removeIdiom}
              disabled={busy}
              className="rounded-full border border-rose-300 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {text('Óshiriw')}
            </button>
          </div>
        )}
      </div>
      {glosses.map((d) => (
        <div key={d.id} className="mt-1">
          {editingGlossId === d.id ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={glossDraft}
                onChange={(e) => setGlossDraft(e.target.value)}
                className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 text-sm text-ink"
                disabled={busy}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveGloss(d.id)}
                  disabled={busy || !glossDraft.trim()}
                  className="qp-btn-primary !px-3 !py-1 !text-xs disabled:opacity-50"
                >
                  {text('Saqlaw')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGlossId(null)}
                  disabled={busy}
                  className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 disabled:opacity-50"
                >
                  {text('Biykarlaw')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-ink/65 leading-relaxed">{text(d.description)}</p>
              {canModerate && d.id && (
                <button
                  type="button"
                  onClick={() => {
                    setGlossDraft(String(d.description || ''));
                    setSaveError('');
                    setEditingGlossId(d.id);
                  }}
                  className="shrink-0 rounded-full border border-ink/10 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ink/55 hover:bg-ink/5"
                >
                  {text('Máni')}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {saveError ? <p className="mt-2 text-xs text-rose-700">{text(saveError)}</p> : null}
    </li>
  );
}

function ReferencePanel({ sense }) {
  const { text } = useUiScript();
  const ref = sense.reference;
  const targetSenses = Array.isArray(ref.senses) ? ref.senses : [];

  return (
    <section className="animate-dict-rise-delay w-full">
      {/* Lug'atlardagi kabi tabiiy havola satri: "qarań: ҒАРҒА" */}
      <p className="text-ink/45 italic text-lg mb-10">
        {text('qarań')}{' '}
        <span className="not-italic font-display text-3xl md:text-4xl text-teal-950 tracking-tight align-middle ml-2">
          {text(ref.target).toUpperCase()}
        </span>
      </p>

      {targetSenses.length > 0 ? (
        <div className="space-y-12">
          {targetSenses.map((targetSense, index) => {
            const examples = Array.isArray(targetSense.examples) ? targetSense.examples : [];
            return (
              <div key={targetSense.id || index}>
                <p className="font-display text-xl md:text-[1.45rem] text-ink leading-[1.75]">
                  {targetSenses.length > 1 && (
                    <span className="text-teal-800/50 mr-3">{index + 1}.</span>
                  )}
                  {targetSense.category && (
                    <em className="text-teal-800/80 not-italic text-base mr-3 lowercase">
                      {text(targetSense.category)}
                    </em>
                  )}
                  {text(targetSense.description)}
                </p>
                {examples.length > 0 && (
                  <div className="mt-6 space-y-5 pl-5 md:pl-7 border-l border-teal-800/20">
                    {examples.map((example, exampleIndex) => (
                      <figure key={example.id || exampleIndex}>
                        <blockquote>
                          <p className="font-display italic text-[1.1rem] md:text-[1.2rem] text-ink/80 leading-[1.7]">
                            “{text(example.example)}”
                          </p>
                        </blockquote>
                        {example.author && (
                          <figcaption className="mt-2 text-sm text-teal-900/70 tracking-wide">
                            —{' '}
                            {example.authorSlug ? (
                              <Link
                                to={`/writers/${encodeURIComponent(example.authorSlug)}`}
                                className="font-semibold text-teal-900 no-underline hover:underline"
                              >
                                {text(example.author)}
                              </Link>
                            ) : (
                              text(example.author)
                            )}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p className="text-ink/50">{text('Bul sózdiń anıqlaması ele qosılmaǵan.')}</p>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            {text(KAA.wordSenseEmptyFree)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/tutor/practice"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
            >
              <Icon name="bolt" /> {text(KAA.practiceNav)}
            </Link>
            <Link
              to="/quiz"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
            >
              <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
            </Link>
            <Link
              to="/crossword"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-4 py-2 text-xs font-bold text-amber-950"
            >
              <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
            </Link>
            <Link
              to="/dictionary/all"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
            >
              <Icon name="book" /> {text(KAA.sozlik)}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

// Grammatik havola: "азаплаў фейилиниң өзлик дәрежеси" — asos so'z ma'nosi bilan
function GrammarRefPanel({ sense }) {
  const { text } = useUiScript();
  const ref = sense.grammar_ref;
  const baseSenses = Array.isArray(ref.senses) ? ref.senses : [];

  const baseTitle = ref.base_id ? (
    <Link
      to={`/dictionary/${ref.base_id}`}
      className="not-italic font-display text-3xl md:text-4xl text-teal-950 tracking-tight align-middle hover:underline underline-offset-4 decoration-teal-800/40"
    >
      {text(ref.base).toUpperCase()}
    </Link>
  ) : (
    <span className="not-italic font-display text-3xl md:text-4xl text-teal-950 tracking-tight align-middle">
      {text(ref.base).toUpperCase()}
    </span>
  );

  return (
    <section className="animate-dict-rise-delay w-full">
      {/* Tabiiy satr: АЗАПЛАЎ sóziniń — өзлик дәрежеси */}
      <p className="text-ink/45 italic text-lg mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {baseTitle}
        <span>{text('feyiliniń')}</span>
        <span className="not-italic text-teal-800 font-medium">{text(ref.form)}</span>
      </p>
      <p className="text-ink/50 text-sm mb-10">
        {text('Bul sóz — asos feyildiń grammatikalıq forması. Tolıq mánisi tómende.')}
      </p>

      {baseSenses.length > 0 ? (
        <div className="space-y-12">
          {baseSenses.map((baseSense, index) => {
            const examples = Array.isArray(baseSense.examples) ? baseSense.examples : [];
            return (
              <div key={baseSense.id || index}>
                <p className="font-display text-xl md:text-[1.45rem] text-ink leading-[1.75]">
                  {baseSenses.length > 1 && (
                    <span className="text-teal-800/50 mr-3">{index + 1}.</span>
                  )}
                  {baseSense.category && (
                    <em className="text-teal-800/80 not-italic text-base mr-3 lowercase">
                      {text(baseSense.category)}
                    </em>
                  )}
                  {text(baseSense.description)}
                </p>
                {examples.length > 0 && (
                  <div className="mt-6 space-y-5 pl-5 md:pl-7 border-l border-teal-800/20">
                    {examples.map((example, exampleIndex) => (
                      <figure key={example.id || exampleIndex}>
                        <blockquote>
                          <p className="font-display italic text-[1.1rem] md:text-[1.2rem] text-ink/80 leading-[1.7]">
                            “{text(example.example)}”
                          </p>
                        </blockquote>
                        {example.author && (
                          <figcaption className="mt-2 text-sm text-teal-900/70 tracking-wide">
                            —{' '}
                            {example.authorSlug ? (
                              <Link
                                to={`/writers/${encodeURIComponent(example.authorSlug)}`}
                                className="font-semibold text-teal-900 no-underline hover:underline"
                              >
                                {text(example.author)}
                              </Link>
                            ) : (
                              text(example.author)
                            )}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p className="text-ink/50">
            {text('Asos sóz')}{' '}
            <span className="font-display text-teal-950">{text(ref.base).toUpperCase()}</span>{' '}
            {text('sózlikke ele qosılmaǵan.')}
          </p>
          <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            {text(KAA.grammarRefEmptyFree)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/dictionary/all?q=${encodeURIComponent(String(ref.base || '').trim())}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
            >
              <Icon name="book" /> {text(KAA.sozlik)}
            </Link>
            <Link
              to="/tutor/practice"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
            >
              <Icon name="bolt" /> {text(KAA.practiceNav)}
            </Link>
            <Link
              to="/quiz"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white px-4 py-2 text-xs font-bold text-teal-950"
            >
              <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
            </Link>
            <Link
              to="/crossword"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-4 py-2 text-xs font-bold text-amber-950"
            >
              <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function TitleRename({ titleId, word, onSaved, onDeactivated }) {
  const { text } = useUiScript();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [clashId, setClashId] = useState(null);

  if (!titleId) return null;

  function startEdit() {
    setDraft(String(word || ''));
    setSaveError('');
    setClashId(null);
    setEditing(true);
  }

  async function save() {
    const next = String(draft || '').trim();
    if (!next) return;
    setBusy(true);
    setSaveError('');
    setClashId(null);
    try {
      await renameDictionaryTitle(titleId, { word: next });
      setEditing(false);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setSaveError(err.message || 'Atın ózgertiw qátesi');
      if (err.payload?.titleId) setClashId(err.payload.titleId);
    } finally {
      setBusy(false);
    }
  }

  async function hideTitle() {
    if (
      !window.confirm(
        text('Bul sóz public sózlikten jasıırıladı (status=0). Dawam etesiz be?')
      )
    ) {
      return;
    }
    setBusy(true);
    setSaveError('');
    try {
      await deactivateDictionaryTitle(titleId);
      if (typeof onDeactivated === 'function') onDeactivated();
    } catch (err) {
      setSaveError(err.message || 'Jasıriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startEdit}
          disabled={busy}
          className="rounded-full border border-teal-800/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50 disabled:opacity-50"
        >
          {text('Atın ózgertiw')}
        </button>
        <button
          type="button"
          onClick={hideTitle}
          disabled={busy}
          className="rounded-full border border-rose-300 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          {text('Jasıriw')}
        </button>
        {saveError ? <p className="w-full text-xs text-rose-700">{text(saveError)}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-3 max-w-md space-y-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 font-display text-2xl text-ink"
        disabled={busy}
        maxLength={255}
        autoFocus
      />
      {saveError ? <p className="text-xs text-rose-700">{text(saveError)}</p> : null}
      {clashId ? (
        <Link
          to={`/dictionary/${encodeURIComponent(clashId)}`}
          className="block text-xs font-semibold text-teal-900 underline"
        >
          {text('Qarsı sózdi ashıw')} →
        </Link>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !draft.trim()}
          className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
        >
          {text('Saqlaw')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50"
        >
          {text('Biykarlaw')}
        </button>
      </div>
    </div>
  );
}

function AddSenseForm({ titleId, onSaved }) {
  const { text } = useUiScript();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!titleId) return null;

  async function submit() {
    const next = String(description || '').trim();
    if (!next) return;
    setBusy(true);
    setError('');
    try {
      await createSenseDescription(titleId, {
        description: next,
        category: String(category || '').trim() || null,
      });
      setDescription('');
      setCategory('');
      setOpen(false);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      setError(err.message || 'Qosıw qátesi');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-dashed border-teal-800/30 bg-teal-50/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50"
      >
        {text('Anıqlama qosıw')}
      </button>
    );
  }

  return (
    <div className="mt-4 w-full max-w-xl rounded-2xl border border-dashed border-teal-800/25 bg-teal-50/40 p-4 space-y-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-teal-800/70">
        {text('Jańa anıqlama')}
      </p>
      <textarea
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={text('Anıqlama tekstin jazıń…')}
        className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 text-sm leading-relaxed text-ink"
        disabled={busy}
      />
      <input
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder={text('Kategoriya / sóz túri (ixtiyarıy)')}
        className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
        disabled={busy}
        maxLength={64}
      />
      {error ? <p className="text-xs text-rose-700">{text(error)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !description.trim()}
          className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
        >
          {text('Qosıw')}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
          disabled={busy}
          className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50"
        >
          {text('Biykarlaw')}
        </button>
      </div>
    </div>
  );
}

function SensePanel({ sense, index, total, canModerate = false, onSenseSaved }) {
  const { text } = useUiScript();
  const examples = Array.isArray(sense.examples) ? sense.examples : [];
  const idioms = Array.isArray(sense.idioms) ? sense.idioms : [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [addingExample, setAddingExample] = useState(false);
  const [newExample, setNewExample] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [addingIdiom, setAddingIdiom] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [newIdiomGloss, setNewIdiomGloss] = useState('');
  const [addError, setAddError] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  if (sense.reference) {
    return <ReferencePanel sense={sense} />;
  }

  if (sense.grammar_ref) {
    return <GrammarRefPanel sense={sense} />;
  }

  function startEdit() {
    setDraft(String(sense.description || ''));
    setDraftCategory(String(sense.category || ''));
    setSaveError('');
    setEditing(true);
  }

  async function saveEdit() {
    const next = String(draft || '').trim();
    if (!next || !sense.id) return;
    setBusy(true);
    setSaveError('');
    try {
      await updateSenseDescription(sense.id, {
        description: next,
        category: String(draftCategory || '').trim() || null,
        activate: false,
      });
      setEditing(false);
      if (typeof onSenseSaved === 'function') await onSenseSaved();
    } catch (err) {
      setSaveError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function removeSense() {
    if (!sense.id) return;
    if (
      !window.confirm(
        text('Bul anıqlama (mısal hám frazalar menen) óshiriledi. Dawam etesiz be?')
      )
    ) {
      return;
    }
    setBusy(true);
    setSaveError('');
    try {
      await deleteSenseDescription(sense.id);
      if (typeof onSenseSaved === 'function') await onSenseSaved();
    } catch (err) {
      setSaveError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function submitNewExample() {
    const next = String(newExample || '').trim();
    if (!next || !sense.id) return;
    setAddBusy(true);
    setAddError('');
    try {
      await createSenseExample(sense.id, {
        example: next,
        author: String(newAuthor || '').trim() || null,
      });
      setNewExample('');
      setNewAuthor('');
      setAddingExample(false);
      if (typeof onSenseSaved === 'function') await onSenseSaved();
    } catch (err) {
      setAddError(err.message || 'Qosıw qátesi');
    } finally {
      setAddBusy(false);
    }
  }

  async function submitNewIdiom() {
    const phrase = String(newPhrase || '').trim();
    if (!phrase || !sense.id) return;
    setAddBusy(true);
    setAddError('');
    try {
      await createSenseIdiom(sense.id, {
        phrase,
        description: String(newIdiomGloss || '').trim() || null,
      });
      setNewPhrase('');
      setNewIdiomGloss('');
      setAddingIdiom(false);
      if (typeof onSenseSaved === 'function') await onSenseSaved();
    } catch (err) {
      setAddError(err.message || 'Qosıw qátesi');
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <section className="sense-panel animate-dict-rise-delay flex-1 min-w-[19rem] max-w-full">
      <header className="sense-panel__head">
        <div className="flex items-center gap-3 mb-1">
          <span className="sense-num font-display" aria-hidden>
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink/40">
              {text(total > 1 ? `Anıqlama ${index + 1} / ${total}` : 'Anıqlama')}
            </p>
            {sense.category && (
              <p className="text-teal-800 text-sm font-medium mt-0.5">{text(sense.category)}</p>
            )}
          </div>
          {canModerate && !editing && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={startEdit}
                disabled={busy}
                className="rounded-full border border-teal-800/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50 disabled:opacity-50"
              >
                {text('Redaktorlaw')}
              </button>
              {total > 1 && (
                <button
                  type="button"
                  onClick={removeSense}
                  disabled={busy}
                  className="rounded-full border border-rose-300 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  {text('Óshiriw')}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="sense-panel__body">
        {editing ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/45">
                {text('Kategoriya / sóz túri')}
              </span>
              <input
                type="text"
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                placeholder={text('mısalı: zat, feyil… (bos — óshiriledi)')}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
                disabled={busy}
                maxLength={64}
              />
            </label>
            <textarea
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 text-sm leading-relaxed text-ink"
              disabled={busy}
            />
            {saveError ? <p className="text-xs text-rose-700">{text(saveError)}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy || !draft.trim()}
                className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
              >
                {text('Saqlaw')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError('');
                }}
                disabled={busy}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50"
              >
                {text('Biykarlaw')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="sense-definition">{text(sense.description)}</p>
            {saveError ? <p className="mt-2 text-xs text-rose-700">{text(saveError)}</p> : null}
          </>
        )}
      </div>

      {(examples.length > 0 || canModerate) && (
        <div className="sense-panel__examples">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink/40">
              {text(
                examples.length === 0
                  ? 'Mısallar'
                  : examples.length === 1
                    ? 'Mısal'
                    : `${examples.length} mısal`
              )}
            </p>
            {canModerate && sense.id && !addingExample && (
              <button
                type="button"
                onClick={() => {
                  setAddError('');
                  setAddingExample(true);
                }}
                className="rounded-full border border-teal-800/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50"
              >
                {text('Mısal qosıw')}
              </button>
            )}
          </div>
          <div className="grid gap-5">
            {examples.map((ex, idx) => (
              <ExampleCard
                key={ex.id || idx}
                exampleId={ex.id}
                example={ex.example}
                author={ex.author}
                authorSlug={ex.authorSlug}
                index={idx}
                total={examples.length}
                canModerate={canModerate}
                onSaved={onSenseSaved}
              />
            ))}
            {addingExample && (
              <div className="rounded-2xl border border-dashed border-teal-800/25 bg-teal-50/40 p-4 space-y-3">
                <textarea
                  rows={3}
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  placeholder={text('Jańa mısal tekstin jazıń…')}
                  className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 text-sm leading-relaxed text-ink"
                  disabled={addBusy}
                />
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder={text('Avtor (ixtiyarıy)')}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
                  disabled={addBusy}
                  maxLength={255}
                />
                {addError ? <p className="text-xs text-rose-700">{text(addError)}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitNewExample}
                    disabled={addBusy || !newExample.trim()}
                    className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
                  >
                    {text('Qosıw')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingExample(false);
                      setAddError('');
                    }}
                    disabled={addBusy}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50"
                  >
                    {text('Biykarlaw')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(idioms.length > 0 || canModerate) && (
        <div className="sense-panel__idioms">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink/40">
              {text('Frazeologizmler')}
            </p>
            {canModerate && sense.id && !addingIdiom && (
              <button
                type="button"
                onClick={() => {
                  setAddError('');
                  setAddingIdiom(true);
                }}
                className="rounded-full border border-teal-800/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:bg-teal-50"
              >
                {text('Fraza qosıw')}
              </button>
            )}
          </div>
          <ul className="space-y-4">
            {idioms.map((idm) => (
              <IdiomItem
                key={idm.id}
                idiom={idm}
                canModerate={canModerate}
                onSaved={onSenseSaved}
              />
            ))}
            {addingIdiom && (
              <li className="rounded-2xl border border-dashed border-teal-800/25 bg-teal-50/40 p-4 space-y-3 list-none">
                <input
                  type="text"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  placeholder={text('Fraza…')}
                  className="w-full rounded-xl border border-teal-800/20 bg-white px-3 py-2 font-display text-lg text-teal-950"
                  disabled={addBusy}
                  maxLength={255}
                />
                <textarea
                  rows={2}
                  value={newIdiomGloss}
                  onChange={(e) => setNewIdiomGloss(e.target.value)}
                  placeholder={text('Máni (ixtiyarıy)')}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
                  disabled={addBusy}
                />
                {addError ? <p className="text-xs text-rose-700">{text(addError)}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submitNewIdiom}
                    disabled={addBusy || !newPhrase.trim()}
                    className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
                  >
                    {text('Qosıw')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingIdiom(false);
                      setAddError('');
                    }}
                    disabled={addBusy}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/70 disabled:opacity-50"
                  >
                    {text('Biykarlaw')}
                  </button>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

function RelationWordAdd({ placeholder, onAdd, disabled = false }) {
  const { text } = useUiScript();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e?.preventDefault?.();
    const next = String(word || '').trim();
    if (!next) return;
    setBusy(true);
    setError('');
    try {
      await onAdd(next);
      setWord('');
    } catch (err) {
      setError(err.message || 'Qosıw qátesi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder={text(placeholder || 'Sóz…')}
        className="min-w-[10rem] flex-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm"
        disabled={busy || disabled}
        maxLength={100}
      />
      <button
        type="submit"
        disabled={busy || disabled || !word.trim()}
        className="qp-btn-primary !px-3 !py-1.5 !text-xs disabled:opacity-50"
      >
        {text('Qosıw')}
      </button>
      {error ? <p className="w-full text-xs text-rose-700">{text(error)}</p> : null}
    </form>
  );
}

function LexicalRelations({ relations, titleId, canModerate = false, onSaved }) {
  const { text } = useUiScript();
  const [busyId, setBusyId] = useState(null);
  const groups = [
    {
      key: 'synonyms',
      type: 'synonym',
      label: 'Sinonimler',
      hint: 'Máni jaǵınan jaqın sózler',
      icon: 'link',
      items: Array.isArray(relations?.synonyms) ? relations.synonyms : [],
      medallion: 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-900/25',
      card: 'border-emerald-600/15 bg-emerald-50/50',
      chip: 'border-emerald-600/25 bg-white/70 text-emerald-950 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white',
    },
    {
      key: 'antonyms',
      type: 'antonym',
      label: 'Antonimler',
      hint: 'Qarama-qarsı mánili sózler',
      icon: 'transfer',
      items: Array.isArray(relations?.antonyms) ? relations.antonyms : [],
      medallion: 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-rose-900/25',
      card: 'border-rose-500/15 bg-rose-50/50',
      chip: 'border-rose-500/25 bg-white/70 text-rose-950 hover:bg-rose-500 hover:border-rose-500 hover:text-white',
    },
  ].filter((group) => canModerate || group.items.length > 0);

  if (!groups.length) return null;

  async function removeItem(relationId) {
    if (!relationId) return;
    if (!window.confirm(text('Bul baylanıs óshiriledi. Dawam etesiz be?'))) return;
    setBusyId(relationId);
    try {
      await removeWordRelation(relationId);
      if (typeof onSaved === 'function') await onSaved();
    } catch (err) {
      window.alert(err.message || 'Óshiriw qátesi');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="mt-16" aria-label={text('Leksikalıq baylanıslar')}>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-teal-800/60 mb-2">
            {text('Sózler baylanısı')}
          </p>
          <h2 className="font-display text-3xl text-ink tracking-tight">
            {text('Sinonim hám antonim')}
          </h2>
        </div>
        <span className="hidden sm:block h-px flex-1 max-w-44 bg-gradient-to-r from-teal-800/20 to-transparent" />
      </div>

      <div className={`grid gap-4 ${groups.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {groups.map((group) => (
          <section
            key={group.key}
            className={`rounded-2xl border px-5 py-5 shadow-[0_12px_40px_-32px_rgba(15,92,86,0.6)] ${group.card}`}
          >
            <header className="flex items-start gap-3 mb-4">
              <span
                className={`w-10 h-10 rounded-xl text-white inline-flex items-center justify-center shrink-0 shadow-lg ${group.medallion}`}
              >
                <Icon name={group.icon} className="text-lg" />
              </span>
              <div>
                <h3 className="font-display text-xl text-ink">{text(group.label)}</h3>
                <p className="text-xs text-ink/40 mt-0.5">{text(group.hint)}</p>
              </div>
            </header>
            <ul className="flex flex-wrap gap-2.5">
              {group.items.map((item) => (
                <li key={`${group.key}-${item.relationId || item.id}`} className="inline-flex items-center gap-1">
                  <Link
                    to={`/dictionary/${item.id}`}
                    title={item.note ? text(item.note) : undefined}
                    className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${group.chip}`}
                  >
                    <span className="font-display text-lg tracking-tight">{text(item.soz)}</span>
                    <AnimChevron count={2} className="opacity-40 group-hover:opacity-90" />
                  </Link>
                  {canModerate && item.relationId ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.relationId)}
                      disabled={busyId === item.relationId}
                      className="rounded-full border border-rose-300 px-2 py-1 text-[0.65rem] font-semibold text-rose-700 disabled:opacity-50"
                      aria-label={text('Óshiriw')}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canModerate && titleId ? (
              <RelationWordAdd
                placeholder={`${group.label} sózi…`}
                onAdd={async (word) => {
                  await addWordRelation(titleId, { word, type: group.type });
                  if (typeof onSaved === 'function') await onSaved();
                }}
              />
            ) : null}
          </section>
        ))}
      </div>
    </aside>
  );
}

function SenseLevelRelations({ senseRelations, canModerate = false, onSaved }) {
  const { text } = useUiScript();
  const list = Array.isArray(senseRelations) ? senseRelations : [];
  const hasAny = list.some((s) => (s.synonyms?.length || 0) + (s.antonyms?.length || 0) > 0);
  if (!canModerate && (!list.length || !hasAny)) return null;
  if (canModerate && !list.length) return null;

  async function removeSyn(descriptionId, targetDescriptionId) {
    if (!window.confirm(text('Bul sinonim óshiriledi. Dawam etesiz be?'))) return;
    await removeSenseSynonymRelation(descriptionId, targetDescriptionId);
    if (typeof onSaved === 'function') await onSaved();
  }

  async function removeAnt(descriptionId, targetDescriptionId) {
    if (!window.confirm(text('Bul antonim óshiriledi. Dawam etesiz be?'))) return;
    await removeSenseAntonymRelation(descriptionId, targetDescriptionId);
    if (typeof onSaved === 'function') await onSaved();
  }

  return (
    <aside className="mt-16" aria-label={text('Máni boyınsha baylanıslar')}>
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-teal-800/60 mb-2">
        {text('Máni dárejesinde')}
      </p>
      <h2 className="font-display text-3xl text-ink tracking-tight mb-6">
        {text('Sinonim / antonim (anıqlama boyınsha)')}
      </h2>
      <div className="space-y-6">
        {list.map((sense) => {
          if (!canModerate && !(sense.synonyms?.length || sense.antonyms?.length)) return null;
          return (
            <section
              key={sense.descriptionId}
              className="qp-card qp-card--static px-5 py-5"
            >
              <p className="text-ink/55 italic mb-4">{text(sense.description)}</p>
              <div className="mb-3">
                <p className="text-xs uppercase tracking-wider text-emerald-700 mb-2 font-semibold">
                  {text('Sinonimler')}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {(sense.synonyms || []).map((item) => (
                    <li
                      key={`${item.descriptionId}-${item.titleId}`}
                      className="inline-flex items-center gap-1"
                    >
                      <Link
                        to={`/dictionary/${item.titleId}`}
                        className="inline-flex rounded-full border border-emerald-600/25 bg-emerald-50/70 px-3 py-1.5 text-emerald-950 hover:bg-emerald-600 hover:text-white transition-colors"
                        title={item.meaning ? text(item.meaning) : undefined}
                      >
                        {text(item.soz)}
                      </Link>
                      {canModerate ? (
                        <button
                          type="button"
                          onClick={() => removeSyn(sense.descriptionId, item.descriptionId)}
                          className="rounded-full border border-rose-300 px-2 py-0.5 text-[0.65rem] font-semibold text-rose-700"
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canModerate ? (
                  <RelationWordAdd
                    placeholder="Sinonim sózi…"
                    onAdd={async (word) => {
                      await addSenseSynonymRelation(sense.descriptionId, word);
                      if (typeof onSaved === 'function') await onSaved();
                    }}
                  />
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-rose-700 mb-2 font-semibold">
                  {text('Antonimler')}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {(sense.antonyms || []).map((item) => (
                    <li
                      key={`${item.descriptionId}-${item.titleId}`}
                      className="inline-flex items-center gap-1"
                    >
                      <Link
                        to={`/dictionary/${item.titleId}`}
                        className="inline-flex rounded-full border border-rose-500/25 bg-rose-50/70 px-3 py-1.5 text-rose-950 hover:bg-rose-500 hover:text-white transition-colors"
                        title={item.meaning ? text(item.meaning) : undefined}
                      >
                        {text(item.soz)}
                      </Link>
                      {canModerate ? (
                        <button
                          type="button"
                          onClick={() => removeAnt(sense.descriptionId, item.descriptionId)}
                          className="rounded-full border border-rose-300 px-2 py-0.5 text-[0.65rem] font-semibold text-rose-700"
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canModerate ? (
                  <RelationWordAdd
                    placeholder="Antonim sózi…"
                    onAdd={async (word) => {
                      await addSenseAntonymRelation(sense.descriptionId, word);
                      if (typeof onSaved === 'function') await onSaved();
                    }}
                  />
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function CompoundPanel({ compounds, titleId, canModerate = false, onSaved }) {
  const { text } = useUiScript();
  const components = compounds?.components || [];
  const usedIn = compounds?.usedIn || [];
  if (!canModerate && !components.length && !usedIn.length) return null;

  async function removeComponent(relationId) {
    if (!relationId) return;
    if (!window.confirm(text('Bul qurma bólek óshiriledi. Dawam etesiz be?'))) return;
    await removeCompoundRelation(relationId);
    if (typeof onSaved === 'function') await onSaved();
  }

  return (
    <aside className="mt-16" aria-label={text('Qurma sóz')}>
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-teal-800/60 mb-2">
        {text('Qurma sóz')}
      </p>
      {(components.length > 0 || canModerate) && (
        <div className="mb-4">
          <p className="text-ink/70 mb-2">
            {text('Quram bólekleri:')}{' '}
            {components.map((c, i) => (
              <span key={c.relationId || c.id} className="inline-flex items-center gap-1">
                {i > 0 && ' + '}
                {c.status === 1 ? (
                  <Link to={`/dictionary/${c.id}`} className="text-teal-900 underline underline-offset-4">
                    {text(c.soz)}
                  </Link>
                ) : (
                  <span className="text-ink/50">{text(c.soz)}</span>
                )}
                {canModerate && c.relationId ? (
                  <button
                    type="button"
                    onClick={() => removeComponent(c.relationId)}
                    className="rounded-full border border-rose-300 px-1.5 text-[0.65rem] font-semibold text-rose-700"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
          </p>
          {canModerate && titleId ? (
            <RelationWordAdd
              placeholder="Bólek sóz…"
              onAdd={async (word) => {
                await addCompoundRelation(titleId, word);
                if (typeof onSaved === 'function') await onSaved();
              }}
            />
          ) : null}
        </div>
      )}
      {usedIn.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/45 mb-2">
            {text('Qatnasqan qurma sózler')}
          </p>
          <ul className="flex flex-wrap gap-2">
            {usedIn.map((item) => (
              <li key={item.relationId || item.id}>
                <Link
                  to={`/dictionary/${item.id}`}
                  className="inline-flex rounded-full border border-teal-800/20 px-3 py-1.5 hover:bg-teal-900 hover:text-parchment transition-colors"
                >
                  {text(item.soz)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

export default function WordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromJumbaq = searchParams.get('from') === 'jumbaq';
  const { text, script } = useUiScript();
  const { isAuthenticated } = useAuth();
  const favorites = useDictionaryFavorites();
  const { record: recordRecent } = useRecentWords();
  const { requireWord, GateModal, reload: reloadQuota } = useGuestQuota();
  const [favFlash, setFavFlash] = useState(false);
  const [adminMe, setAdminMe] = useState(null);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        word: async () => {
          try {
            const res = await fetchWordById(id);
            // Server allaqachon word-view hisoblagan
            reloadQuota();
            return res.data;
          } catch (err) {
            if (err?.code === 'GUEST_WORD_LIMIT' || err?.status === 403) {
              requireWord();
            }
            throw err;
          }
        },
      }),
    { deps: [id] }
  );

  useEffect(() => {
    if (!getAdminToken()) {
      setAdminMe(null);
      return undefined;
    }
    let cancelled = false;
    fetchAdminMe()
      .then((profile) => {
        if (!cancelled) setAdminMe(profile);
      })
      .catch(() => {
        if (!cancelled) setAdminMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canModerate = Boolean(adminMe?.permissions?.includes('moderate_community'));

  const word = data?.word || null;
  const displayTitle = word ? (word.homonyms ? word.base_soz : word.soz) : null;

  usePageMeta(
    displayTitle ? text(displayTitle) : null,
    word?.aniqlamalar?.[0]?.description ? text(word.aniqlamalar[0].description) : null
  );

  useEffect(() => {
    if (!word?.id) return;
    recordRecent({
      id: word.id,
      soz: word.homonyms ? word.base_soz : word.soz,
      category: word.aniqlamalar?.[0]?.category || null,
    });
  }, [word, recordRecent]);

  const onFavoriteToggle = useCallback(() => {
    if (!word?.id) return;
    const wasActive = favorites.has(word.id);
    favorites.toggle({
      id: word.id,
      soz: word.homonyms ? word.base_soz : word.soz,
      birinshi_aniqlama: word.aniqlamalar?.[0]?.description || null,
      category: word.aniqlamalar?.[0]?.category || null,
    });
    if (wasActive || isAuthenticated) return;
    try {
      if (sessionStorage.getItem(FAV_GUEST_TIP_KEY) === '1') return;
      sessionStorage.setItem(FAV_GUEST_TIP_KEY, '1');
    } catch {
      /* ignore */
    }
    setFavFlash(true);
    window.setTimeout(() => setFavFlash(false), 2800);
  }, [word, favorites, isAuthenticated]);

  if (!word && status === 'ready') {
    return (
      <PageGate
        status="error"
        error="Sóz tabılmadı"
        backHref={fromJumbaq ? '/jumbaqlar' : '/dictionary'}
        backLabel={fromJumbaq ? litT('jumbaqBackList', script) : 'Sózlikke qaytıw'}
      />
    );
  }

  if (!word) {
    return (
      <PageGate
        status={status}
        error={error}
        onRetry={reload}
        backHref={fromJumbaq ? '/jumbaqlar' : '/dictionary'}
        backLabel={fromJumbaq ? litT('jumbaqBackList', script) : 'Sózlikke qaytıw'}
      />
    );
  }

  const senses = word.aniqlamalar || [];
  const homonyms = Array.isArray(word.homonyms) ? word.homonyms : null;
  const totalSenses = homonyms
    ? homonyms.reduce((n, h) => n + (h.aniqlamalar?.length || 0), 0)
    : senses.length;
  const leadSense = homonyms
    ? (homonyms.find((h) => h.id === word.id || h.soz === word.soz)?.aniqlamalar ||
        homonyms[0]?.aniqlamalar ||
        [])[0]
    : senses[0];
  const leadGloss = leadSense?.description ? String(leadSense.description).trim() : '';

  return (
    <ProtectedContent>
    <>
    {GateModal}
    <main className="dict-shell relative min-h-screen pt-24 pb-24 overflow-hidden">
      <div className="dict-atmosphere pointer-events-none absolute inset-0" aria-hidden />

      <article className="relative max-w-5xl mx-auto px-5 md:px-8 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-10">
          <Link
            to={fromJumbaq ? '/jumbaqlar' : '/dictionary'}
            className="inline-flex items-center gap-2 text-sm text-ink/45 hover:text-teal-900 transition-colors"
          >
            ← {fromJumbaq ? litT('jumbaqBackList', script) : text('Sózlik')}
          </Link>
          <Link
            to={fromJumbaq ? '/dictionary/all?from=jumbaq' : '/dictionary/all'}
            className="text-sm text-ink/40 hover:text-teal-900 transition-colors"
          >
            {text('Barlıq sózler')}
          </Link>
        </div>

        <PageEnter>
        <header className="mb-12">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <h1 className="font-display text-5xl md:text-7xl text-ink tracking-tight">
                {text(homonyms ? word.base_soz : word.soz)}
              </h1>
              {canModerate && (
                <TitleRename
                  titleId={word.id}
                  word={word.soz}
                  onSaved={reload}
                  onDeactivated={() => navigate('/dictionary', { replace: true })}
                />
              )}
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <ShareButton word={homonyms ? word.base_soz : word.soz} />
              <FavoriteButton
                size="lg"
                active={favorites.has(word.id)}
                onToggle={onFavoriteToggle}
              />
            </div>
          </div>
          {favFlash && (
            <p
              className={`mb-3 inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-900 ${anim.checkinPop}`}
            >
              <Icon name="heart" filled />
              {text(KAA.favSavedFlash)}
              <Link to="/dictionary/favorites" className="underline underline-offset-2">
                {text(KAA.yoqtirilganlar)}
              </Link>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {homonyms && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-500/20 px-3 py-1.5 text-teal-800">
                <Icon name="layers" /> {text(`${homonyms.length} omonim`)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-600/20 px-3 py-1.5 text-teal-900">
              <Icon name="book" />{' '}
              {text(totalSenses > 0 ? `${totalSenses} anıqlama` : 'Anıqlama joq')}
            </span>
            {word.views_count != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-500/20 px-3 py-1.5 text-sky-800">
                <Icon name="eye" /> {text(`${word.views_count} ret kórildi`)}
              </span>
            )}
          </div>
          {leadGloss ? (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/65 motion-reveal">
              {text(leadGloss.length > 180 ? `${leadGloss.slice(0, 177)}…` : leadGloss)}
            </p>
          ) : (
            <p className="mt-5 text-sm text-ink/45 motion-reveal">
              {text('Anıqlama ele qosılmaǵan — morfologiya hám awdarmalardı kóriń.')}
            </p>
          )}
        </header>

        <AnimIconDivider wide amber icon="✦" />

        <div className="mb-10">
          <MorphologyPanel morphology={word.morphology} />
        </div>

        {homonyms ? (
          <div className="space-y-16">
            {homonyms.map((h) => {
              const hSenses = h.aniqlamalar || [];
              const isCurrent = h.id === word.id || h.soz === word.soz;
              return (
                <section key={h.id}>
                  <header className="flex items-baseline gap-4 mb-6">
                    <span
                      className={`font-display text-3xl md:text-4xl tracking-tight ${
                        isCurrent ? 'text-teal-900' : 'text-ink/70'
                      }`}
                    >
                      {text(h.roman || h.soz)}
                    </span>
                    <span className={anim.ruleDraw} aria-hidden />
                    <span className="text-[0.65rem] uppercase tracking-[0.18em] text-ink/35">
                      {text(`${hSenses.length} anıqlama`)}
                    </span>
                  </header>
                  {/* Ma'nolar: keng ekranda yonma-yon, sig'masa keyingi qatorga */}
                  <div className="flex flex-wrap gap-6 md:gap-8 items-start">
                    {hSenses.map((sense, i) => (
                      <SensePanel
                        key={sense.id || i}
                        sense={sense}
                        index={i}
                        total={hSenses.length}
                        canModerate={canModerate}
                        onSenseSaved={reload}
                      />
                    ))}
                  </div>
                  {canModerate && (
                    <AddSenseForm titleId={h.id} onSaved={reload} />
                  )}
                  {hSenses.length === 0 && (
                    <div>
                      <p className="text-ink/55">{text('Anıqlama ele qosılmaǵan.')}</p>
                      <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                        {text(KAA.wordSenseEmptyFree)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to="/tutor/practice"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                        >
                          <Icon name="bolt" /> {text(KAA.practiceNav)}
                        </Link>
                        <Link
                          to="/quiz"
                          className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                        >
                          <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                        </Link>
                        <Link
                          to="/crossword"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-4 py-2 text-xs font-bold text-amber-950"
                        >
                          <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                        </Link>
                        <Link
                          to="/dictionary/all"
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
                        >
                          <Icon name="book" /> {text(KAA.sozlik)}
                        </Link>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <>
            <AnimIconDivider className="mb-8" />
            <div className="flex flex-wrap gap-6 md:gap-8 items-start">
              {senses.map((sense, i) => (
                <SensePanel
                  key={sense.id || i}
                  sense={sense}
                  index={i}
                  total={senses.length}
                  canModerate={canModerate}
                  onSenseSaved={reload}
                />
              ))}
            </div>
            {canModerate && <AddSenseForm titleId={word.id} onSaved={reload} />}

            {senses.length === 0 && (
              <div>
                <p className="text-ink/55">{text('Bul sóz ushın anıqlama ele qosılmaǵan.')}</p>
                <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {text(KAA.wordSenseEmptyFree)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/tutor/practice"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                  <Link
                    to="/quiz"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                  </Link>
                  <Link
                    to="/crossword"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                  </Link>
                  <Link
                    to="/dictionary/all"
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
                  >
                    <Icon name="book" /> {text(KAA.sozlik)}
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-12 mb-10">
          <TranslationsPanel translations={word.translations} />
        </div>

        <ImmersionBlock titleId={word.id} soz={word.homonyms ? word.base_soz : word.soz} />

        <WordNextSteps
          word={word}
          isFavorite={favorites.has(word.id)}
          onToggleFavorite={onFavoriteToggle}
          related={Array.isArray(word.related) ? word.related : []}
          nextWord={word.next || null}
          fromJumbaq={fromJumbaq}
        />


        <LexicalRelations
          relations={word.relations}
          titleId={word.id}
          canModerate={canModerate}
          onSaved={reload}
        />
        <SenseLevelRelations
          senseRelations={word.senseRelations}
          canModerate={canModerate}
          onSaved={reload}
        />
        <CompoundPanel
          compounds={word.compounds}
          titleId={word.id}
          canModerate={canModerate}
          onSaved={reload}
        />
        <CommunitySuggestPanel word={word} />

        {Array.isArray(word.related) && word.related.length > 0 && (
          <aside className="mt-16">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink/40 mb-5">
              {text('Túbirles sózler')}
            </p>
            <ul className="flex flex-wrap gap-3">
              {word.related.map((r, idx) => {
                const accents = [
                  'border-teal-600/25 text-teal-950 hover:bg-teal-600',
                  'border-teal-500/25 text-teal-950 hover:bg-teal-500',
                  'border-amber-500/30 text-amber-950 hover:bg-amber-500',
                  'border-sky-500/25 text-sky-950 hover:bg-sky-500',
                  'border-rose-500/25 text-rose-950 hover:bg-rose-500',
                ];
                return (
                  <li key={r.id}>
                    <Link
                      to={`/dictionary/${r.id}`}
                      className={`inline-block rounded-full border bg-white/50 px-5 py-2 font-display text-lg tracking-tight transition-all hover:-translate-y-0.5 hover:text-white hover:shadow-md ${accents[idx % accents.length]}`}
                    >
                      {text(r.soz)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {(word.prev || word.next) && (
          <nav
            className="mt-16 pt-8 border-t border-dashed border-ink/10 flex justify-between gap-4"
            aria-label={text('Álipbe boyınsha júriw')}
          >
            {word.prev ? (
              <Link
                to={`/dictionary/${word.prev.id}`}
                className="group inline-flex items-center gap-3 qp-card px-4 py-3 text-ink/60 transition-all hover:-translate-y-0.5 hover:border-teal-600/30 hover:bg-teal-50/60 hover:text-teal-900 hover:shadow-md"
              >
                <span aria-hidden className="text-teal-700">
                  <AnimChevron count={2} left className="opacity-70" />
                </span>
                <span className="flex flex-col">
                  <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink/30">
                    {text('Aldıńǵı')}
                  </span>
                  <span className="font-display text-lg tracking-tight">
                    {text(word.prev.soz)}
                  </span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {word.next && (
              <Link
                to={`/dictionary/${word.next.id}`}
                className="group inline-flex items-center gap-3 qp-card px-4 py-3 text-ink/60 transition-all hover:-translate-y-0.5 hover:border-teal-600/30 hover:bg-teal-50/60 hover:text-teal-900 hover:shadow-md"
              >
                <span className="flex flex-col text-right">
                  <span className="text-[0.6rem] uppercase tracking-[0.16em] text-ink/30">
                    {text('Keyingi')}
                  </span>
                  <span className="font-display text-lg tracking-tight">
                    {text(word.next.soz)}
                  </span>
                </span>
                <AnimChevron count={2} className="opacity-70" />
              </Link>
            )}
          </nav>
        )}
        </PageEnter>
      </article>
    </main>
    </>
    </ProtectedContent>
  );
}
