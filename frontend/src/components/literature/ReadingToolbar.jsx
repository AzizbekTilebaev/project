import Icon from '../Icon';
import ScriptToggle from './ScriptToggle';
import { useUiScript } from '../../contexts/UiScriptContext';

const THEMES = [
  { id: 'day', label: 'Kún' },
  { id: 'sepia', label: 'Sepiya' },
  { id: 'dark', label: 'Tún' },
];

/**
 * Reader controls: TOC toggle, font size, theme, script.
 */
export default function ReadingToolbar({
  prefs,
  onPrefsChange,
  tocOpen,
  onTocToggle,
  title,
  sectionLabel,
  className = '',
}) {
  const { text } = useUiScript();

  const bumpFont = (delta) => {
    onPrefsChange?.({
      ...prefs,
      fontSize: Math.min(28, Math.max(14, (prefs.fontSize || 18) + delta)),
    });
  };

  return (
    <div
      className={`sticky top-[4.5rem] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur-md ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onTocToggle}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/50 px-3 py-2 text-xs font-semibold text-ink/70 transition hover:bg-white hover:text-teal-900"
          aria-expanded={tocOpen}
        >
          <Icon name="layers" /> {text('Mazmunı')}
        </button>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink/80">{title ? text(title) : null}</p>
          {sectionLabel ? (
            <p className="truncate text-[0.65rem] text-ink/45">{text(sectionLabel)}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-ink/10 bg-white/50 p-0.5">
          <button
            type="button"
            onClick={() => bumpFont(-2)}
            className="rounded-full px-2.5 py-1 text-sm font-bold text-ink/55 hover:text-teal-900"
            aria-label={text('Kishi shrift')}
          >
            A−
          </button>
          <span className="px-1 text-[0.65rem] tabular-nums text-ink/40">{prefs.fontSize}px</span>
          <button
            type="button"
            onClick={() => bumpFont(2)}
            className="rounded-full px-2.5 py-1 text-base font-bold text-ink/55 hover:text-teal-900"
            aria-label={text('Úlken shrift')}
          >
            A+
          </button>
        </div>

        <div className="inline-flex rounded-full border border-ink/10 bg-white/50 p-0.5">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onPrefsChange?.({ ...prefs, theme: theme.id })}
              className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide transition ${
                prefs.theme === theme.id
                  ? 'bg-teal-800 text-white'
                  : 'text-ink/45 hover:text-teal-900'
              }`}
            >
              {text(theme.label)}
            </button>
          ))}
        </div>

        <ScriptToggle
          value={prefs.script}
          onChange={(script) => onPrefsChange?.({ ...prefs, script })}
        />
      </div>
    </div>
  );
}
