/**
 * kk_logs.app_errors ga xato/loglarni yozadi. Hech qachon so‘rovni bloklamaydi:
 * yozish xatosi yutiladi (log yoza olmaslik ilovani buzmasligi kerak).
 */
import { pools } from '../config/db.js';

function truncate(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * @param {object} entry
 * @param {'error'|'warn'|'info'} [entry.level]
 * @param {string} [entry.source]
 * @param {string} [entry.method]
 * @param {string} [entry.path]
 * @param {number} [entry.statusCode]
 * @param {string} [entry.message]
 * @param {string} [entry.stack]
 * @param {object} [entry.context]
 * @param {string} [entry.actorKey]
 */
export async function logAppError({
  level = 'error',
  source = null,
  method = null,
  path = null,
  statusCode = null,
  message = null,
  stack = null,
  context = null,
  actorKey = null,
} = {}) {
  try {
    await pools.logs.query(
      `INSERT INTO app_errors
       (level, source, method, path, status_code, message, stack, context_json, actor_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ['error', 'warn', 'info'].includes(level) ? level : 'error',
        truncate(source, 120),
        truncate(method, 10),
        truncate(path, 500),
        statusCode != null ? Number(statusCode) : null,
        truncate(message, 4000),
        truncate(stack, 60000),
        context ? JSON.stringify(context).slice(0, 60000) : null,
        truncate(actorKey, 64),
      ]
    );
  } catch {
    // Log yoza olmaslik hech qachon asosiy oqimni buzmaydi.
  }
}

export default logAppError;
