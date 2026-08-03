import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import LollipopIcon, { NAV_ICON_BY_PATH } from './LollipopIcon';
import { KAA } from '../i18n/kaa';
import { anim } from '../animations';
import { safeMediaUrl } from '../lib/safeUrl';
import GuestSoftContinue from './GuestSoftContinue';

const ACTIVE_NAV = 'bg-teal-900 text-white font-semibold shadow-sm';

/** Asosiy eshiklar — Ádebiyat, Oyınlar va yengil Statistika. */
const PLAY_NAV = [
  { path: '/', label: KAA.basBet, icon: 'home' },
  { path: '/literature', label: KAA.adebiyat, icon: 'scroll' },
  { path: '/games', label: KAA.oyinlar, icon: 'bolt' },
  { path: '/quiz/statistics', label: KAA.statistika, icon: 'chart' },
];

/** Sidebar «Yana» — minimal. */
const MORE_NAV = [
  { path: '/profile', label: KAA.profil, icon: 'user' },
  { path: '/community', label: KAA.jamiyet, icon: 'user' },
  { path: '/qoidalar', label: KAA.qoidalarShort, icon: 'book' },
  { path: '/english', label: KAA.englishShort, icon: 'grammar' },
  { path: '/facts', label: KAA.qiziqarliShort, icon: 'sparkle' },
  { path: '/faq', label: KAA.faqShort, icon: 'sparkle' },
];

export default function Header() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated, user } = useAuth();
  const menuBtnRef = useRef(null);
  const firstLinkRef = useRef(null);

  const tabLinks = useMemo(() => PLAY_NAV, []);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => firstLinkRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/literature') {
      return (
        location.pathname.startsWith('/literature') ||
        location.pathname.startsWith('/writers') ||
        location.pathname.startsWith('/books') ||
        location.pathname.startsWith('/jumbaqlar') ||
        (location.pathname.startsWith('/dictionary') &&
          !location.pathname.startsWith('/dictionary/game'))
      );
    }
    if (path === '/games') {
      return (
        location.pathname.startsWith('/games') ||
        (location.pathname.startsWith('/quiz') &&
          !location.pathname.startsWith('/quiz/statistics')) ||
        location.pathname.startsWith('/crossword') ||
        location.pathname.startsWith('/dictionary/game') ||
        location.pathname.startsWith('/tutor')
      );
    }
    if (path === '/quiz/statistics') {
      return location.pathname.startsWith('/quiz/statistics');
    }
    if (path === '/profile') {
      return location.pathname.startsWith('/profile');
    }
    if (path === '/community') {
      return location.pathname.startsWith('/community');
    }
    if (path === '/qoidalar') {
      return location.pathname.startsWith('/qoidalar');
    }
    if (path === '/english') {
      return location.pathname.startsWith('/english');
    }
    if (path === '/facts') {
      return location.pathname.startsWith('/facts');
    }
    if (path === '/faq') {
      return location.pathname.startsWith('/faq');
    }
    return location.pathname === path;
  };

  const onAccount =
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register');
  const onSettings = location.pathname.startsWith('/settings');

  const accountHref = '/profile';
  const accountLabel = isAuthenticated ? KAA.profil : KAA.profileGuestNav;

  return (
    <>
      <header className="qp-header-glass theme-chrome fixed top-0 left-0 right-0 z-50 h-16 md:h-20">
        <div className="relative mx-auto flex h-full max-w-6xl items-center justify-between px-4 md:px-10">
          <Link to="/" className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-2xl tracking-tight text-ink md:text-3xl">
              {text(KAA.qaraqalpaq)}
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 rounded-2xl border border-white/60 bg-white/45 p-1 shadow-qp-soft backdrop-blur-xl md:flex"
            aria-label={text(KAA.tiykargiMenyu)}
          >
            {PLAY_NAV.map((link) => {
              const on = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  title={text(link.label)}
                  className={`lollipop-nav-link ${anim.underlineGrow} group inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm tracking-wide transition-colors ${
                    on
                      ? `${ACTIVE_NAV} is-active`
                      : 'font-medium text-ink/50 hover:bg-white/70 hover:text-ink'
                  }`}
                >
                  <LollipopIcon name={link.icon} active={on} size={18} />
                  <span className="hidden lg:inline">{text(link.label)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <div
              className="theme-focus-hide flex rounded-full border border-white/60 bg-white/50 p-0.5 text-[0.65rem] font-bold backdrop-blur-sm"
              role="group"
              aria-label={text(KAA.jaziwTuri)}
            >
              <button
                type="button"
                onClick={() => setScript('cyrillic')}
                className={`rounded-full px-2.5 py-1 transition ${
                  script === 'cyrillic' ? 'bg-teal-900 text-white' : 'text-ink/45 hover:text-ink'
                }`}
                aria-pressed={script === 'cyrillic'}
              >
                {text({ cyrillic: 'КИР', latin: 'KIR' })}
              </button>
              <button
                type="button"
                onClick={() => setScript('latin')}
                className={`rounded-full px-2.5 py-1 transition ${
                  script === 'latin' ? 'bg-teal-900 text-white' : 'text-ink/45 hover:text-ink'
                }`}
                aria-pressed={script === 'latin'}
              >
                {text({ cyrillic: 'ЛАТ', latin: 'LAT' })}
              </button>
            </div>

            <Link
              to="/settings"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/40 transition-colors backdrop-blur-sm ${
                onSettings
                  ? 'text-teal-950 shadow-sm'
                  : 'text-ink/55 hover:bg-white/70 hover:text-ink'
              }`}
              aria-label={text(KAA.sazlawlar)}
              title={text(KAA.sazlawlar)}
            >
              <LollipopIcon name="settings" active={onSettings} size={18} />
            </Link>

            <Link
              to={accountHref}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-white/50 bg-white/45 px-1.5 transition-colors backdrop-blur-sm sm:px-2.5 ${
                onAccount
                  ? 'text-teal-950 shadow-sm'
                  : 'text-ink/55 hover:bg-white/75 hover:text-ink'
              }`}
              aria-label={text(accountLabel)}
              title={text(accountLabel)}
            >
              {isAuthenticated && safeMediaUrl(user?.avatarUrl) ? (
                <img
                  src={safeMediaUrl(user.avatarUrl)}
                  alt=""
                  className="h-7 w-7 rounded-full border border-ink/10 object-cover"
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-white">
                  <LollipopIcon name="user" active={onAccount} size={16} />
                </span>
              )}
              <span className="hidden text-sm font-medium xl:inline">{text(accountLabel)}</span>
            </Link>

            <button
              ref={menuBtnRef}
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/40 text-ink backdrop-blur-sm hover:bg-white/70 md:hidden"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-expanded={sidebarOpen}
              aria-controls="mobile-nav"
              aria-label={text(sidebarOpen ? KAA.menyuJabiw : KAA.menyuAshiw)}
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      <nav
        className="lollipop-tabbar fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
        aria-label={text(KAA.tiykargiMenyu)}
      >
        <div className="mx-auto flex max-w-lg items-end justify-between gap-1 rounded-[1.75rem] border border-white/55 bg-white/70 px-2 py-2 shadow-[0_12px_40px_-18px_rgba(28,42,36,0.4)] backdrop-blur-xl">
          {tabLinks.map((link) => {
            const on = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`lollipop-tab flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1 text-[0.62rem] font-semibold transition-colors ${
                  on ? 'text-teal-950' : 'text-ink/40'
                }`}
              >
                <LollipopIcon
                  name={link.icon || NAV_ICON_BY_PATH[link.path]}
                  active={on}
                  size={22}
                />
                <span className="max-w-[4.5rem] truncate">{text(link.label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <aside
        id="mobile-nav"
        aria-hidden={!sidebarOpen}
        className={`fixed left-0 top-0 z-40 h-screen w-[4.75rem] overflow-hidden border-r-0 bg-[var(--qp-rail)] pt-20 text-parchment shadow-qp-soft transition-transform duration-300 ease-out sm:w-72 sm:rounded-r-[1.75rem] ${
          sidebarOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
        }`}
      >
        <ul className="flex flex-col gap-1 px-2 py-6 pb-28 sm:px-5">
          {PLAY_NAV.map((link, i) => (
            <li key={link.path}>
              <Link
                ref={i === 0 ? firstLinkRef : undefined}
                to={link.path}
                tabIndex={sidebarOpen ? 0 : -1}
                className={`flex items-center gap-3 rounded-2xl px-2.5 py-3 text-base transition-colors sm:px-3 ${
                  isActive(link.path)
                    ? 'bg-white text-teal-950 font-semibold'
                    : 'text-parchment/75 hover:bg-white/10 hover:text-parchment'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <LollipopIcon name={link.icon} active={isActive(link.path)} size={20} />
                <span className="hidden sm:inline">{text(link.label)}</span>
              </Link>
            </li>
          ))}
          <li className="mt-3 border-t border-white/15 pt-3">
            <p className="mb-1 hidden px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-parchment/45 sm:block">
              {text(KAA.navMore)}
            </p>
          </li>
          {MORE_NAV.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                tabIndex={sidebarOpen ? 0 : -1}
                className={`flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-sm transition-colors sm:px-3 ${
                  isActive(link.path)
                    ? 'bg-white text-teal-950 font-semibold'
                    : 'text-parchment/70 hover:bg-white/10'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <LollipopIcon name={link.icon} active={isActive(link.path)} size={18} />
                <span className="hidden sm:inline">{text(link.label)}</span>
              </Link>
            </li>
          ))}
          <li className="mt-3 border-t border-white/15 pt-3">
            <Link
              to="/settings"
              tabIndex={sidebarOpen ? 0 : -1}
              className={`flex items-center gap-3 rounded-2xl px-2.5 py-3 text-base transition-colors sm:px-3 ${
                onSettings
                  ? 'bg-white text-teal-950 font-semibold'
                  : 'text-parchment/75 hover:bg-white/10'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <LollipopIcon name="settings" active={onSettings} size={20} />
              <span className="hidden sm:inline">{text(KAA.sazlawlar)}</span>
            </Link>
          </li>
          {!isAuthenticated && (
            <li className="mt-2 hidden px-3 sm:block">
              <GuestSoftContinue
                compact
                titleKey="authGuestFreeTitle"
                tabIndex={sidebarOpen ? 0 : -1}
                onNavigate={() => setSidebarOpen(false)}
              />
            </li>
          )}
        </ul>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/25 md:hidden"
          aria-label={text(KAA.menyuJabiw)}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
