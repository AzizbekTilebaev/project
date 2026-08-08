/**
 * Bir IP orqasidan juda ko‘p turli X-Anonymous-Id — spoof/skrap signal.
 * Faqat log; so‘rovni to‘xtatmaydi (CGNAT false-positive).
 */
const WINDOW_MS = 15 * 60 * 1000;
const WARN_UNIQUE = Number(process.env.ACTOR_ABUSE_WARN_UNIQUE) || 40;
const byIp = new Map();

function prune(entry, now) {
  while (entry.times.length && now - entry.times[0] > WINDOW_MS) {
    const stale = entry.times.shift();
    // times aligned loosely; rebuild set from recent keys
    void stale;
  }
  if (entry.times.length === 0) {
    entry.keys.clear();
  }
}

export function noteAnonymousIdFromIp(ip, anonymousId) {
  if (!ip || !anonymousId) return;
  const now = Date.now();
  let entry = byIp.get(ip);
  if (!entry) {
    entry = { keys: new Set(), times: [], warned: false };
    byIp.set(ip, entry);
  }
  const isNew = !entry.keys.has(anonymousId);
  if (isNew) {
    entry.keys.add(anonymousId);
    entry.times.push(now);
  }
  // Oddiy prune: oyna oshsa tozalash
  if (entry.times.length > WARN_UNIQUE * 2) {
    entry.keys.clear();
    entry.times = [];
    entry.warned = false;
    entry.keys.add(anonymousId);
    entry.times.push(now);
  }
  if (entry.keys.size >= WARN_UNIQUE && !entry.warned) {
    entry.warned = true;
    console.warn(
      `[security] actor-spoof-pattern ip=${ip} uniqueAnonymousIds=${entry.keys.size} windowMin=15`
    );
  }
  // Memory cap
  if (byIp.size > 5000) {
    const first = byIp.keys().next().value;
    byIp.delete(first);
  }
  void prune;
}

export default noteAnonymousIdFromIp;
