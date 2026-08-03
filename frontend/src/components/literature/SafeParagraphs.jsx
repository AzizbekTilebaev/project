import { t } from './litLabels';

/**
 * Render biography / body text as plain paragraphs — never as HTML.
 */
export default function SafeParagraphs({
  paragraphs = [],
  className = '',
  paragraphClassName = 'text-base leading-8 text-ink/75',
  script = 'cyrillic',
}) {
  const list = Array.isArray(paragraphs)
    ? paragraphs.map((p) => String(p || '').trim()).filter(Boolean)
    : [];

  if (!list.length) {
    return (
      <p className={`text-sm text-ink/45 ${className}`}>{t('bioNotAdded', script)}</p>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {list.map((p, i) => (
        <p key={i} className={paragraphClassName}>
          {p}
        </p>
      ))}
    </div>
  );
}
