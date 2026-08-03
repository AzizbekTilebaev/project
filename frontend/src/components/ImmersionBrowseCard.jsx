import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  fetchWordImmersion,
  seedImmersionListen,
  submitImmersionProduce,
} from '../api/immersion';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import {
  applyImmersionPracticeResults,
  isImmersionWordQueued,
  recordImmersionListen,
  touchImmersionContinue,
} from '../lib/immersionProgress';
import { gradeImmersionProduceLocal } from '../lib/produceGrade';
import { safeMediaUrl } from '../lib/safeUrl';
import GuestSoftContinue from './GuestSoftContinue';
import FreePlayCtaRow from './FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';

/**
 * Browse list row + inline listen/produce (WordDetail ImmersionBlock happy-path).
 */
export default function ImmersionBrowseCard({
  word,
  expanded,
  onToggle,
  queued: queuedProp,
  onListen,
}) {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const titleId = word?.titleId;
  const soz = word?.soz || '';
  const queued = queuedProp ?? isImmersionWordQueued(titleId);

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [listened, setListened] = useState(queued);
  const [produceText, setProduceText] = useState('');
  const [produceBusy, setProduceBusy] = useState(false);
  const [produceResult, setProduceResult] = useState(null);
  const [guestSoft, setGuestSoft] = useState(false);
  const markedRef = useRef(queued);

  useEffect(() => {
    if (!expanded || !titleId) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setProduceText('');
    setProduceResult(null);
    setGuestSoft(false);
    const already = isImmersionWordQueued(titleId);
    setListened(already);
    markedRef.current = already;
    touchImmersionContinue({ id: titleId, soz });
    fetchWordImmersion(titleId)
      .then((d) => {
        if (!cancelled) setAssets(d.assets || []);
      })
      .catch(() => {
        if (!cancelled) {
          setAssets([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, titleId, soz]);

  const markListened = () => {
    if (!titleId || markedRef.current) return;
    markedRef.current = true;
    const res = recordImmersionListen(titleId, { soz });
    setListened(true);
    onListen?.(res);
    seedImmersionListen(titleId, { prompt: soz || null }).catch(() => {});
  };

  const onTimeUpdate = (e) => {
    if (Number(e.currentTarget?.currentTime) >= 2) markListened();
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
      applyImmersionPracticeResults([{ id: String(titleId), correct: Boolean(graded.correct) }]);
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
      applyImmersionPracticeResults([
        { id: String(titleId), correct: Boolean(res.correct) },
      ]);
    } catch {
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

  const audioAssets = assets.filter(
    (a) => a.kind === 'audio' && safeMediaUrl(a.fileAccess?.url)
  );
  const videoAssets = assets.filter(
    (a) => a.kind === 'video' && safeMediaUrl(a.fileAccess?.url)
  );
  const playable = audioAssets[0] || videoAssets[0] || null;
  const playUrl = playable ? safeMediaUrl(playable.fileAccess?.url) : '';

  const kindHint = word.hasAudio
    ? text(KAA.audioBar)
    : text(KAA.mediaBar);

  return (
    <li className="rounded-2xl border border-teal-800/10 bg-white/70 transition hover:border-teal-700/25">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => onToggle(titleId)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="block truncate font-display text-lg text-ink">
                {text(soz)}
              </span>
              {queued || listened ? (
                <span className="rounded-full border border-teal-700/20 bg-teal-50 px-2 py-0.5 text-[0.65rem] font-bold text-teal-900">
                  {queued ? text(KAA.immersionBrowseQueued) : text(KAA.immersionBrowseHeardBadge)}
                </span>
              ) : null}
            </span>
            <span className="text-[0.7rem] text-ink/40">
              {kindHint}
              {word.assetCount > 1 ? ` · ${word.assetCount}` : ''}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline text-xs font-bold text-teal-900">
              {text(KAA.immersionBrowsePlay)}
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal-800 text-white">
              <Icon name={expanded ? 'up' : 'sparkle'} />
            </span>
          </span>
        </button>
        <Link
          to={`/dictionary/${encodeURIComponent(titleId)}`}
          className="flex items-center border-l border-teal-800/10 px-3 text-teal-900/70 hover:bg-teal-50/80 hover:text-teal-950"
          title={text(KAA.immersionBrowseOpenWord)}
          aria-label={text(KAA.immersionBrowseOpenWord)}
        >
          <AnimChevron count={2} className="opacity-80" />
        </Link>
      </div>

      {expanded && (
        <div className="border-t border-teal-800/10 px-4 py-4">
          <p className="mb-3 text-xs text-ink/50">{text(KAA.immersionBrowseInlineHint)}</p>

          {loading && (
            <p className="inline-flex items-center gap-2 text-sm text-ink/45">
              <Icon name="loader" className="animate-spin" />
              {text(KAA.immersionBrowseMediaLoading)}
            </p>
          )}

          {!loading && loadError && (
            <p className="text-sm text-rose-800">{text(KAA.immersionBrowseMediaFail)}</p>
          )}

          {!loading && !loadError && playUrl && playable?.kind === 'audio' && (
            <audio
              controls
              autoPlay
              className="mb-3 w-full"
              src={playUrl}
              preload="metadata"
              onEnded={markListened}
              onTimeUpdate={onTimeUpdate}
            >
              <track kind="captions" />
            </audio>
          )}

          {!loading && !loadError && playUrl && playable?.kind === 'video' && (
            <video
              controls
              autoPlay
              className="mb-3 w-full rounded-xl bg-ink/5 aspect-video object-cover"
              src={playUrl}
              preload="metadata"
              onEnded={markListened}
              onTimeUpdate={onTimeUpdate}
            />
          )}

          {!loading && !loadError && !playUrl && (
            <p className="mb-3 text-sm text-ink/50">{text(KAA.immersionBrowseMediaFail)}</p>
          )}

          {listened && !produceResult?.correct ? (
            <form onSubmit={onProduceSubmit} className="mb-3 space-y-2">
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
                  className="rounded-full bg-teal-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {text(KAA.immersionProduceSubmit)}
                </button>
              </div>
              {produceResult && !produceResult.correct ? (
                <p className="text-sm font-semibold text-rose-800" role="status">
                  {text(KAA.tutorWrongMsg)}
                </p>
              ) : null}
            </form>
          ) : null}

          {produceResult?.correct ? (
            <p
              className={`mb-3 text-sm font-semibold text-emerald-800 ${anim.checkinPop}`}
              role="status"
            >
              {produceResult.nearMiss
                ? text(KAA.tutorNearMissMsg)
                : text(KAA.tutorCorrectMsg)}
            </p>
          ) : null}

          {guestSoft ? (
            <GuestSoftContinue
              className="mb-3 text-left"
              titleKey={null}
              bodyKey="immersionBrowseGuestProduce"
              compact
            />
          ) : null}

          {listened ? (
            <p className={`mb-2 text-sm font-semibold text-teal-950 ${anim.checkinPop}`}>
              {produceResult?.correct
                ? text(KAA.immersionProduceDone)
                : text(KAA.immersionQueuedHint)}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              to="/quiz"
              onClick={() => markListened()}
              className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-4 py-2 text-xs font-bold text-white`}
            >
              <Icon name="trophy" /> {text(KAA.immersionPracticeNow)}
            </Link>
            <Link
              to={`/dictionary/${encodeURIComponent(titleId)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
            >
              {text(KAA.immersionBrowseOpenWord)}
            </Link>
            <Link
              to="/tutor/practice?from=immersion"
              onClick={() => markListened()}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white/80 px-3.5 py-2 text-xs font-semibold text-ink/55"
            >
              <Icon name="bolt" /> {text(KAA.immersionLater)}
            </Link>
          </div>
          {listened ? (
            <>
              <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.immersionListenFree)}
              </p>
              <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-2" compact />
            </>
          ) : null}
        </div>
      )}
    </li>
  );
}
