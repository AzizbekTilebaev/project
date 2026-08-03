import { useEffect } from 'react';

function isInputTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  if (el.closest?.('input, textarea, select, [contenteditable="true"], [data-allow-copy="1"]')) {
    return true;
  }
  return false;
}

const BLOCKED_KEYS = new Set(['p', 'P', 's', 'S', 'a', 'A', 'u', 'U', 'c', 'C', 'x', 'X']);

/**
 * Global anti-copy (bir marta AppShell da). Form/admin inputlar ochiq.
 */
export default function ContentProtection() {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isInputTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      if (mod && BLOCKED_KEYS.has(e.key) && !shift) {
        e.preventDefault();
        return;
      }
      if (
        mod &&
        shift &&
        (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')
      ) {
        e.preventDefault();
        return;
      }
      if (e.key === 'F12') e.preventDefault();
    };

    const block = (e) => {
      if (isInputTarget(e.target)) return;
      e.preventDefault();
    };

    const onBeforePrint = () => document.body.classList.add('kk-print-block');
    const onAfterPrint = () => document.body.classList.remove('kk-print-block');

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', block, true);
    document.addEventListener('cut', block, true);
    document.addEventListener('contextmenu', block, true);
    document.addEventListener('selectstart', block, true);
    document.addEventListener('dragstart', block, true);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('copy', block, true);
      document.removeEventListener('cut', block, true);
      document.removeEventListener('contextmenu', block, true);
      document.removeEventListener('selectstart', block, true);
      document.removeEventListener('dragstart', block, true);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove('kk-print-block');
    };
  }, []);

  return null;
}
