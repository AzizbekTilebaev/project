const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  loader: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M18 2v4h4" /></>,
  left: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
  right: <><path d="m9 18 6-6-6-6" /><path d="M4 12h11" /></>,
  share: <><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  'x-circle': <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5Z" /></>,
  gamepad: <><path d="M7 8h10a5 5 0 0 1 4.7 6.7l-1 2.8a2 2 0 0 1-3.2.8L15 16H9l-2.5 2.3a2 2 0 0 1-3.2-.8l-1-2.8A5 5 0 0 1 7 8Z" /><path d="M7 12v4m-2-2h4m7-1h.01m2 2h.01" /></>,
  flame: <path d="M12 22c4 0 7-3 7-7 0-3-1.5-5.5-4.5-8 .2 2-1 3.5-2 4.2C12 7.5 10 4 7 2c.2 4-2 6-2 9 0 2.2.8 4 2.2 5.3-.1-2 1-3.7 2.8-5.3-.2 2.5 2 3 2 5 0 1.5-.7 2.5-2 3.5.7.3 1.3.5 2 .5Z" />,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  transfer: <><path d="M17 3l4 4-4 4" /><path d="M3 7h18M7 21l-4-4 4-4" /><path d="M21 17H3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  scroll: <><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  grammar: <><path d="M4 20h16" /><path d="m6 16 6-12 6 12" /><path d="M8.5 11h7" /></>,
  trophy: <><path d="M8 21h8m-4-4v4" /><path d="M7 4h10v6a5 5 0 0 1-10 0Z" /><path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 4 3.8M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-4 3.8" /></>,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  sparkle: <><path d="M12 3v4m0 10v4m9-9h-4M7 12H3" /><path d="m17.7 6.3-2.5 2.5M8.8 15.2l-2.5 2.5m11.4 0-2.5-2.5M8.8 8.8 6.3 6.3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.6A6 6 0 0 1 21 20" /></>,
  tutor: <><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M16 4.5 18 3M8 4.5 6 3" /></>,
  chart: <><path d="M4 19h16" /><path d="M7 16V10M12 16V6M17 16v-4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
};

export default function Icon({ name, className = '', filled = false }) {
  const content = paths[name] || paths.search;
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
}
