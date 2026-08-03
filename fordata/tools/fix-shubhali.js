#!/usr/bin/env node
/**
 * Auto-fix common shubhali issues, write repaired JSON next to original
 * under sibling `togri_repaired/` or overwrite via --inplace into togri/.
 *
 * Usage:
 *   node fix-shubhali.js [--all] [--file path] [--write]
 *
 * Without --write: dry report only.
 * With --write: saves repaired entries to <parent>/togri_repaired/<name>.json
 */
import fs from 'fs';
import path from 'path';
import {
  FORDATA_ROOT,
  readJson,
  resolvePagePath,
  relFromFordata,
  appendProgress,
} from './lib/progress.js';

function walkShubhali(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkShubhali(p, acc);
    else if (e.name.endsWith('.json') && p.includes(`${path.sep}shubhali${path.sep}`)) {
      acc.push(p);
    }
  }
  return acc;
}

/** Recover definition text from full_text after title + categories. */
function recoverDefFromFullText(entry) {
  let ft = (entry.full_text || '').trim();
  if (!ft) return null;
  const title = (entry.title || '').trim();
  if (title && ft.toUpperCase().startsWith(title.toUpperCase())) {
    ft = ft.slice(title.length).trim();
  }
  // strip leading POS tokens
  ft = ft.replace(/^((?:[\p{L}]{1,12}\.)+\s*)+/u, '').trim();
  // strip leading sense number
  ft = ft.replace(/^\d+\.\s*/, '').trim();
  if (ft.length < 2 || ft === '.') return null;
  return ft;
}

/** Split a long idiom dump into phrase + gloss (best effort). */
function splitLongIdiom(phrase) {
  const p = (phrase || '').trim();
  if (!p) return { idiom: '', idiom_text: '' };

  // "phrase gloss..." — take first clause as idiom if short enough
  const m = p.match(/^(.{3,60}?)[\s.]+(.+)$/s);
  if (m && m[1].split(/\s+/).length <= 8) {
    return { idiom: m[1].trim(), idiom_text: m[2].trim() };
  }

  // Split on first period
  const dot = p.indexOf('.');
  if (dot > 3 && dot < 80) {
    return {
      idiom: p.slice(0, dot).trim(),
      idiom_text: p.slice(dot + 1).trim(),
    };
  }

  return { idiom: p.slice(0, 80), idiom_text: p.slice(80).trim() || p };
}

function fixEntry(entry) {
  const reasons = new Set(entry._suspicious_reasons || []);
  const fixed = { ...entry, definitions: (entry.definitions || []).map((d) => ({ ...d, categorys: [...(d.categorys || [])], idioms: (d.idioms || []).map((x) => ({ ...x })) })) };
  const notes = [];

  // Fix categories that swallowed the definition
  for (const def of fixed.definitions) {
    const badCats = [];
    const goodCats = [];
    for (const c of def.categorys) {
      if (/[а-яәғқңөүұһіА-Я]{4,}/.test(c) && !c.includes('.')) {
        badCats.push(c);
      } else {
        goodCats.push(c);
      }
    }
    if (badCats.length && !(def.text || '').trim()) {
      def.text = badCats.join(' ');
      def.categorys = goodCats;
      notes.push('moved_category_words_to_text');
      reasons.delete('empty_def');
    } else {
      def.categorys = goodCats;
    }
  }

  // empty_def recovery
  if (reasons.has('empty_def') || fixed.definitions.some((d) => !(d.text || '').trim())) {
    const recovered = recoverDefFromFullText(entry);
    if (recovered) {
      for (const def of fixed.definitions) {
        if (!(def.text || '').trim() || def.text === '.') {
          def.text = recovered;
          notes.push('recovered_def_from_full_text');
        }
      }
      reasons.delete('empty_def');
      reasons.delete('dot_only_text');
    }
  }

  // long_idiom_phrase
  for (const def of fixed.definitions) {
    def.idioms = (def.idioms || []).map((idm) => {
      const phrase = (idm.idiom || '').trim();
      const gloss = (idm.idiom_text || '').trim();
      if (phrase.length > 80 && !gloss) {
        const split = splitLongIdiom(phrase);
        notes.push('split_long_idiom');
        reasons.delete('long_idiom_phrase');
        return { ...idm, idiom: split.idiom, idiom_text: split.idiom_text };
      }
      return idm;
    });
  }

  // order_gap — renumber
  if (reasons.has('order_gap') || fixed.definitions.length) {
    fixed.definitions.forEach((d, i) => {
      d.order_sort = i + 1;
    });
    reasons.delete('order_gap');
    notes.push('renumbered_order_sort');
  }

  // very_short_fulltext + empty — keep as ref-only marker
  if (reasons.has('very_short_fulltext') && fixed.definitions.every((d) => !(d.text || '').trim())) {
    if (fixed.ref || fixed.ref_word) {
      notes.push('kept_as_ref_only');
    } else if (fixed.ref_word || /к\./i.test(fixed.full_text || '')) {
      notes.push('likely_cross_ref');
    }
  }

  if (reasons.size === 0) {
    delete fixed._suspicious_reasons;
  } else {
    fixed._suspicious_reasons = [...reasons];
  }

  return { entry: fixed, notes, remaining: [...reasons] };
}

function fixPage(entries) {
  const out = [];
  const report = [];
  entries.forEach((e, i) => {
    const { entry, notes, remaining } = fixEntry(e);
    out.push(entry);
    report.push({ index: i, title: e.title, notes, remaining });
  });
  return { entries: out, report };
}

const write = process.argv.includes('--write');
const all = process.argv.includes('--all');
const fileIdx = process.argv.indexOf('--file');
const single = fileIdx >= 0 ? resolvePagePath(process.argv[fileIdx + 1]) : null;

let files = [];
if (single) files = [single];
else if (all) files = walkShubhali(FORDATA_ROOT);
else {
  console.error('Usage: node fix-shubhali.js --all [--write] | --file path [--write]');
  process.exit(1);
}

const summary = { files: files.length, repaired: 0, stillSuspicious: 0 };

for (const file of files) {
  const rel = relFromFordata(file);
  const data = readJson(file);
  const { entries, report } = fixPage(data);
  const still = report.filter((r) => r.remaining.length > 0).length;
  const clean = report.filter((r) => r.remaining.length === 0).length;

  console.log(`\n=== ${rel} ===`);
  console.log(`entries=${entries.length} clean=${clean} still_suspicious=${still}`);
  for (const r of report.slice(0, 8)) {
    console.log(`  [${r.index}] ${r.title}: notes=${r.notes.join('|') || '-'} remaining=${r.remaining.join(',') || 'ok'}`);
  }

  if (write) {
    const parent = path.dirname(file); // .../shubhali
    const catDir = path.dirname(parent); // .../01_with_compound
    const outDir = path.join(catDir, 'togri_repaired');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, path.basename(file));
    fs.writeFileSync(outFile, JSON.stringify(entries, null, 2), 'utf8');
    console.log(`  wrote ${relFromFordata(outFile)}`);
    appendProgress({ action: 'fix-shubhali', file: rel, out: relFromFordata(outFile), clean, still });
  }

  summary.repaired += clean;
  summary.stillSuspicious += still;
}

console.log('\n' + JSON.stringify(summary, null, 2));
appendProgress({ action: 'fix-shubhali-done', ...summary, write });
