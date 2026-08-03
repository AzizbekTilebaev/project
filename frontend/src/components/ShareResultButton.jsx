import { useState } from 'react';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { anim } from '../animations';
import { shareResult } from '../lib/shareResult';

/**
 * Finish-panel share: navigator.share → clipboard + flash.
 */
export default function ShareResultButton({
  title,
  text: body,
  url,
  className = '',
  label,
  compact = false,
}) {
  const { text } = useUiScript();
  const [flash, setFlash] = useState('');

  const onShare = async () => {
    const result = await shareResult({ title, text: body, url });
    if (result === 'copied') {
      setFlash('copied');
      window.setTimeout(() => setFlash(''), 1800);
    } else if (result === 'shared') {
      setFlash('shared');
      window.setTimeout(() => setFlash(''), 1600);
    }
  };

  return (
    <div className={compact ? 'inline-flex flex-col items-center gap-1' : 'inline-flex flex-col items-center gap-1.5'}>
      <button
        type="button"
        onClick={onShare}
        className={
          className ||
          `${anim.shine} inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-950`
        }
      >
        <Icon name={flash ? 'check' : 'share'} />
        {flash
          ? text(KAA.shareResultCopied)
          : text(label || KAA.shareResult)}
      </button>
    </div>
  );
}
