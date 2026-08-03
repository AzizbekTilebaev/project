import Icon from '../Icon';

export default function FavoriteButton({
  active,
  onToggle,
  size = 'md',
  className = '',
  labelAdd = 'Unatıw',
  labelRemove = 'Unatqanlardan alıw',
}) {
  const sizeClass = size === 'lg' ? 'w-11 h-11 text-2xl' : 'w-9 h-9 text-xl';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.();
      }}
      aria-pressed={active}
      aria-label={active ? labelRemove : labelAdd}
      title={active ? labelRemove : labelAdd}
      className={`inline-flex items-center justify-center rounded-full border transition-colors shrink-0 ${sizeClass} ${
        active
          ? 'border-teal-800/40 bg-teal-900 text-parchment'
          : 'border-ink/10 bg-white/50 text-ink/40 hover:text-teal-900 hover:border-teal-800/30'
      } ${className}`}
    >
      <Icon name="heart" filled={active} />
    </button>
  );
}
