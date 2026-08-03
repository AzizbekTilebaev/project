import { safeInternalPath } from './safeUrl';
import { getGuestLocalSummary } from './guestLocalSummary';

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

function isAuthPath(path) {
  if (!path || typeof path !== 'string') return true;
  const p = path.split('?')[0];
  return AUTH_PATHS.some((a) => p === a || p.startsWith(`${a}/`));
}

/**
 * Login/register keyin: state.from → guest primary → /profile.
 * Auth betlerge qaytıp ketpeydi.
 */
export function postAuthDestination(from) {
  const primary = getGuestLocalSummary()?.primary?.href || '/profile';
  let dest = safeInternalPath(from, primary);
  if (isAuthPath(dest)) {
    dest = safeInternalPath(primary, '/profile');
  }
  if (isAuthPath(dest)) return '/profile';
  return dest;
}
