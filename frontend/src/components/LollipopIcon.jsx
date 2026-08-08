/**
 * Lollipop-style animated nav icons (Dribbble-inspired tabbar feel).
 * Rounded stroke, soft bounce on active, pink accent fill.
 */
const PATHS = {
  home: <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />,
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5Z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5Z" />
    </>
  ),
  scroll: (
    <>
      <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  tutor: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M16 4.5 18 3M8 4.5 6 3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19h16" />
      <path d="M7 16V10M12 16V6M17 16v-4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4m0 10v4m9-9h-4M7 12H3" />
      <path d="m17.7 6.3-2.5 2.5M8.8 15.2l-2.5 2.5m11.4 0-2.5-2.5M8.8 8.8 6.3 6.3" />
    </>
  ),
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  grammar: (
    <>
      <path d="M5 4h14v3H5zM7 10h3v10H7zM14 10h3v10h-3z" />
      <path d="M5 20h14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
    </>
  ),
};

const ACCENTS = {
  home: '#0f5c56',
  book: '#059669',
  scroll: '#0284c7',
  tutor: '#c026d3',
  chart: '#4f46e5',
  sparkle: '#d97706',
  bolt: '#0f766e',
  grammar: '#0f766e',
  user: '#e11d48',
  settings: '#64748b',
};

export default function LollipopIcon({
  name = 'home',
  active = false,
  className = '',
  size = 22,
}) {
  const content = PATHS[name] || PATHS.home;
  const accent = ACCENTS[name] || '#e11d48';

  return (
    <span
      className={`lollipop-icon ${active ? 'is-active' : ''} ${className}`}
      style={{ '--lollipop-accent': accent, width: size + 18, height: size + 18 }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lollipop-icon__svg"
      >
        {content}
      </svg>
    </span>
  );
}

export const NAV_ICON_BY_PATH = {
  '/': 'home',
  '/literature': 'scroll',
  '/games': 'bolt',
  '/dictionary': 'book',
  '/dictionary/immersion': 'sparkle',
  '/tutor/practice': 'bolt',
  '/tutor': 'tutor',
  '/quiz': 'bolt',
  '/crossword': 'bolt',
  '/quiz/statistics': 'chart',
  '/qoidalar': 'grammar',
  '/english': 'grammar',
  '/settings': 'settings',
  '/profile': 'user',
  '/login': 'user',
  '/register': 'user',
};
