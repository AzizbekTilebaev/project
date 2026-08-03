/** Offline → online recovery — event name + dispatch. */

export const BACK_ONLINE_EVENT = 'qp:back-online';

export function dispatchBackOnline() {
  try {
    window.dispatchEvent(new CustomEvent(BACK_ONLINE_EVENT));
  } catch {
    /* ignore */
  }
}
