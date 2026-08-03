/**
 * FAQ / Footer / About — deep-link CTAs (hub-first; kam ortiqcha eshik).
 */

/** @typedef {{ to: string, labelKey: string, icon?: string, tone?: 'primary'|'amber'|'soft' }} FaqCta */

/** @type {Record<string, FaqCta[]>} */
export const FAQ_CTAS = {
  guest: [
    { to: '/literature', labelKey: 'adebiyat', icon: 'book', tone: 'primary' },
    { to: '/games', labelKey: 'oyinlar', icon: 'trophy' },
  ],
  practice: [
    { to: '/games', labelKey: 'oyinlar', icon: 'trophy', tone: 'primary' },
    { to: '/literature', labelKey: 'adebiyat', icon: 'book' },
  ],
  tutor: [
    { to: '/games', labelKey: 'oyinlar', icon: 'trophy', tone: 'primary' },
    { to: '/tutor', labelKey: 'uyretiwshi', icon: 'tutor' },
  ],
  adaptive: [
    { to: '/games', labelKey: 'oyinlar', icon: 'trophy', tone: 'primary' },
    { to: '/quiz', labelKey: 'faqTryQuiz', icon: 'trophy' },
  ],
  points: [
    { to: '/profile', labelKey: 'profil', icon: 'users', tone: 'primary' },
    { to: '/games', labelKey: 'oyinlar', icon: 'trophy' },
  ],
  immersion: [
    { to: '/dictionary/immersion', labelKey: 'dawisliSozler', icon: 'sparkle', tone: 'primary' },
    { to: '/games', labelKey: 'oyinlar', icon: 'gamepad' },
  ],
  favorites: [
    { to: '/dictionary/favorites', labelKey: 'yoqtirilganlar', icon: 'heart', tone: 'primary' },
    { to: '/games', labelKey: 'oyinlar', icon: 'gamepad' },
  ],
  books: [
    { to: '/literature', labelKey: 'adebiyat', icon: 'book', tone: 'primary' },
    { to: '/books', labelKey: 'faqTryBooks', icon: 'scroll' },
  ],
  contribute: [
    { to: '/community', labelKey: 'jamiyet', icon: 'users', tone: 'primary' },
    { to: '/literature', labelKey: 'adebiyat', icon: 'book' },
  ],
  wod: [
    { to: '/#kun-sozi', labelKey: 'kunSozi', icon: 'sparkle', tone: 'primary' },
    { to: '/games', labelKey: 'oyinlar', icon: 'gamepad' },
  ],
  search: [{ to: '/dictionary', labelKey: 'faqTryDict', icon: 'search', tone: 'primary' }],
  what: [
    { to: '/about', labelKey: 'aboutShort', icon: 'book' },
    { to: '/games', labelKey: 'oyinlar', icon: 'trophy', tone: 'primary' },
  ],
  script: [{ to: '/settings', labelKey: 'sazlawlar', icon: 'layers', tone: 'primary' }],
};

/** Footer «sheksiz» strip — 2 hub eshigi (Ádebiyat + Oyınlar). */
export const FOOTER_FREE_LINKS = [
  { to: '/literature', labelKey: 'adebiyat', icon: 'book' },
  { to: '/games', labelKey: 'oyinlar', icon: 'trophy', tone: 'primary' },
];

/** Footer nav columns — hub-first. */
export const FOOTER_NAV = [
  {
    id: 'play',
    titleKey: 'footerColPlay',
    links: [
      { to: '/games', labelKey: 'oyinlar' },
      { to: '/quiz', labelKey: 'testler' },
      { to: '/crossword', labelKey: 'krossvord' },
    ],
  },
  {
    id: 'learn',
    titleKey: 'footerColLearn',
    links: [
      { to: '/literature', labelKey: 'adebiyat' },
      { to: '/dictionary', labelKey: 'sozlik' },
      { to: '/qoidalar', labelKey: 'qoidalarShort' },
      { to: '/english', labelKey: 'englishShort' },
      { to: '/facts', labelKey: 'qiziqarliShort' },
      { to: '/books', labelKey: 'faqTryBooks' },
    ],
  },
  {
    id: 'account',
    titleKey: 'footerColMore',
    links: [
      { to: '/profile', labelKey: 'profil' },
      { to: '/community', labelKey: 'jamiyet' },
      { to: '/faq', labelKey: 'faqShort' },
      { to: '/about', labelKey: 'aboutShort' },
      { to: '/settings', labelKey: 'sazlawlar' },
    ],
  },
];

/** Footer → FAQ hash shortcuts (ball/points jump yo‘q). */
export const FOOTER_FAQ_JUMPS = [
  { to: '/faq#guest', labelKey: 'faqJumpGuest' },
  { to: '/faq#contribute', labelKey: 'faqJumpCommunity' },
];
