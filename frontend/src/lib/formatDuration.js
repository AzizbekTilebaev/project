/**
 * Waqıt millisekundta saqlanadı; ekranda s / daq / sa kórsetiledi.
 * Millisekund anıqlıǵı sekund bóleginde (3 belgigshe) saqlanadı.
 */

function trimSec(sec) {
  const n = Math.round(Number(sec) * 1000) / 1000;
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (Number.isInteger(n)) return String(n);
  return n
    .toFixed(3)
    .replace(/\.?0+$/, '');
}

/**
 * @param {number} ms
 * @param {{ compact?: boolean }} [opts]
 * @returns {string} mısalı: "8.347 s", "2 daq 15.2 s", "1 sa 3 daq"
 */
export function formatDurationMs(ms, { compact = false } = {}) {
  const total = Math.max(0, Number(ms) || 0);
  if (total < 1) return compact ? '0s' : '0 s';

  const hours = Math.floor(total / 3600000);
  const afterH = total % 3600000;
  const minutes = Math.floor(afterH / 60000);
  const afterM = afterH % 60000;
  const seconds = afterM / 1000;

  const parts = [];
  if (hours > 0) parts.push(compact ? `${hours}sa` : `${hours} sa`);
  if (minutes > 0) parts.push(compact ? `${minutes}daq` : `${minutes} daq`);

  // Soat+daqıqa bolsa — sekundtı tek 0 emes bolsa kórsetemiz
  if (hours > 0 || minutes > 0) {
    if (seconds >= 0.001) {
      parts.push(compact ? `${trimSec(seconds)}s` : `${trimSec(seconds)} s`);
    }
    return parts.join(compact ? ' ' : ' ');
  }

  // Tek sekund
  return compact ? `${trimSec(seconds)}s` : `${trimSec(seconds)} s`;
}

/** Countdown / timer — pútin sekund (ceil). */
export function formatCountdownSec(totalSeconds) {
  const s = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}
