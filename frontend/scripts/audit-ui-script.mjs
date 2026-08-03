/**
 * JSX ishinde `text(...)` siz qalǵan kórinetuǵın tekstlerdi tabadı.
 * Bul statikalıq audit: nátiyjeler qol menen tekseriledi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import * as espree from 'espree';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const visibleAttrs = new Set(['aria-label', 'title', 'placeholder', 'alt']);
const ignoredFiles = new Set([
  path.join(src, 'components', 'literature', 'litLabels.js'),
]);
const issues = [];

function hasWords(value) {
  return /[\p{L}]{2,}/u.test(String(value || '').trim());
}

function walk(node, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXText' && hasWords(node.value)) {
    issues.push({ file, line: node.loc.start.line, kind: 'JSXText', value: node.value.trim() });
  }
  if (
    node.type === 'JSXAttribute' &&
    visibleAttrs.has(node.name?.name) &&
    node.value?.type === 'Literal' &&
    hasWords(node.value.value)
  ) {
    issues.push({
      file,
      line: node.loc.start.line,
      kind: node.name.name,
      value: String(node.value.value),
    });
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, file);
    } else if (value && typeof value === 'object' && value.type) {
      walk(value, file);
    }
  }
}

for (const relative of globSync('**/*.{jsx,js}', { cwd: src })) {
  const file = path.join(src, relative);
  if (ignoredFiles.has(file)) continue;
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = espree.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
      loc: true,
    });
  } catch (error) {
    console.error(`${relative}: parse qáteligi: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  walk(ast, relative);
}

for (const issue of issues) {
  console.log(`${issue.file}:${issue.line} [${issue.kind}] ${issue.value}`);
}
console.log(`\nJámisi: ${issues.length} múmkin bolǵan qattı jazılǵan UI teksti.`);
if (process.argv.includes('--strict') && issues.length) process.exitCode = 1;
