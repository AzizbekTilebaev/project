import { t } from './litLabels';
import { useUiScript } from '../../contexts/UiScriptContext';

/**
 * Toggle between Cyrillic and Latin Karakalpak script.
 * Synced with global UiScriptContext so Header КИР/LAT stays in lockstep.
 * Value: 'cyrillic' | 'latin' (legacy 'original' accepted as cyrillic).
 */
export default function ScriptToggle({ value, onChange, className = '' }) {
  const { script: globalScript, setScript } = useUiScript();
  const script = (value ?? globalScript) === 'latin' ? 'latin' : 'cyrillic';
  const isLatin = script === 'latin';

  const select = (next) => {
    setScript(next);
    onChange?.(next);
  };

  return (
    <div
      className={`inline-flex rounded-full border border-ink/10 bg-white/55 p-1 text-xs font-semibold ${className}`}
      role="group"
      aria-label={t('scriptGroup', script)}
    >
      <button
        type="button"
        onClick={() => select('cyrillic')}
        className={`rounded-full px-3 py-1.5 transition-all ${
          !isLatin
            ? 'bg-teal-800 text-white shadow-sm'
            : 'text-ink/50 hover:text-teal-900'
        }`}
      >
        {t('cyrillicBtn', script)}
      </button>
      <button
        type="button"
        onClick={() => select('latin')}
        className={`rounded-full px-3 py-1.5 transition-all ${
          isLatin
            ? 'bg-teal-800 text-white shadow-sm'
            : 'text-ink/50 hover:text-teal-900'
        }`}
      >
        {t('latinBtn', script)}
      </button>
    </div>
  );
}
