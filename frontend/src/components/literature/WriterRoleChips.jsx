import { t } from './litLabels';

/**
 * @param {{ roles?: string[], script?: string, limit?: number, className?: string }} props
 */
export default function WriterRoleChips({
  roles = [],
  script = 'cyrillic',
  limit = 0,
  className = '',
}) {
  const list = Array.isArray(roles) ? roles.filter(Boolean) : [];
  if (!list.length) return null;
  const shown = limit > 0 ? list.slice(0, limit) : list;
  const more = limit > 0 ? Math.max(0, list.length - shown.length) : 0;

  return (
    <ul
      className={`mt-2 flex flex-wrap gap-1.5 ${className}`.trim()}
      aria-label={t('writerRoles', script)}
    >
      {shown.map((role) => (
        <li key={role}>
          <span className="inline-flex rounded-lg border border-amber-800/15 bg-amber-50/90 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-950">
            {t(`role_${role}`, script) || role}
          </span>
        </li>
      ))}
      {more > 0 ? (
        <li>
          <span className="inline-flex rounded-lg px-2 py-0.5 text-[0.7rem] font-semibold text-ink/40">
            +{more}
          </span>
        </li>
      ) : null}
    </ul>
  );
}
