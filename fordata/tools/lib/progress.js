import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TOOLS_ROOT = path.resolve(__dirname, '..');
export const FORDATA_ROOT = path.resolve(TOOLS_ROOT, '..');
export const PROGRESS_PATH = path.join(TOOLS_ROOT, 'progress.jsonl');

export function appendProgress(record) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
  fs.appendFileSync(PROGRESS_PATH, line, 'utf8');
}

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function resolvePagePath(relOrAbs) {
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  const fromFordata = path.resolve(FORDATA_ROOT, relOrAbs);
  if (fs.existsSync(fromFordata)) return fromFordata;
  return path.resolve(process.cwd(), relOrAbs);
}

export function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

/** Relative path from fordata root for logging */
export function relFromFordata(absPath) {
  return path.relative(FORDATA_ROOT, absPath).replace(/\\/g, '/');
}
