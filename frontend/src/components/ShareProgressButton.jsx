import { useMemo, useState } from 'react';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { anim } from '../animations';
import { shareResult } from '../lib/shareResult';
import { buildProgressShare } from '../lib/progressShare';

/**
 * Week / streak progress share — Profile, Stats, WeeklyReview.
 */
export default function ShareProgressButton({
  review = null,
  streak = null,
  local = null,
  claimedToday = false,
  url,
  className = '',
  label,
  compact = false,
}) {
  const { text } = useUiScript();
  const [flash, setFlash] = useState('');

  const payload = useMemo(
    () =>
      buildProgressShare({
        text,
        KAA,
        review,
        streak,
        local,
        claimedToday,
        url,
      }),
    [text, review, streak, local, claimedToday, url]
  );

  if (!payload) return null;

  const onShare = async () => {
    const result = await shareResult(payload);
    if (result === 'copied') {
      setFlash('copied');
      window.setTimeout(() => setFlash(''), 1800);
    } else if (result === 'shared') {
      setFlash('shared');
      window.setTimeout(() => setFlash(''), 1600);
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className={
        className ||
        (compact
          ? 'inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white/90 px-3 py-1.5 text-xs font-bold text-teal-950'
          : `${anim.shine} inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-sm font-bold text-teal-950`)
      }
    >
      <Icon name={flash ? 'check' : 'share'} />
      {flash
        ? text(KAA.shareResultCopied)
        : text(label || (compact ? KAA.shareProgressShort : KAA.shareProgress))}
    </button>
  );
}
