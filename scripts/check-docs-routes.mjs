#!/usr/bin/env node
/**
 * App.jsx Route path lari FOYDALANUVCHI-SAYTI.md va QANDAY-ISHLAYDI.md da
 * qayd etilganini tekshiradi (insonga tayanmasdan sinxron).
 *
 * Usage: node scripts/check-docs-routes.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJsx = join(root, 'frontend/src/App.jsx');
const docs = [
  join(root, 'docs/FOYDALANUVCHI-SAYTI.md'),
  join(root, 'docs/QANDAY-ISHLAYDI.md'),
];

/** Hub / asosiy — QANDAY jadvalida alohida qator bo‘lishi shart */
const REQUIRED_IN_QANDAY_TABLE = [
  '/games',
  '/literature',
  '/jumbaqlar',
  '/tutor/practice',
  '/community',
  '/facts',
];

function extractRoutes(src) {
  const paths = [];
  const re = /<Route\s+path=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    paths.push(m[1]);
  }
  return [...new Set(paths)];
}

/**
 * Path hujjatda bor-mi: aniq matn, :param, yoki oila belgilari (/admin/*, /dictionary[/*]).
 */
function isDocumented(routePath, doc) {
  if (routePath === '*') return true;
  if (doc.includes(routePath)) return true;

  const segs = routePath.split('/').filter(Boolean);
  if (!segs.length) {
    return doc.includes('`/`') || doc.includes('| `/`') || /\n\/\s+/.test(doc);
  }

  const rootSeg = segs[0];
  const familyPatterns = [
    `/${rootSeg}[/*]`,
    `/${rootSeg}/*`,
    `/${rootSeg}/…`,
    `/${rootSeg}, …`,
  ];
  if (familyPatterns.some((p) => doc.includes(p))) return true;

  // /admin/users ← /admin/*
  if (rootSeg === 'admin' && /\/admin\/?\*/.test(doc)) return true;

  // /quiz/:id ← /quiz
  const staticBase = `/${routePath
    .split('/')
    .filter(Boolean)
    .filter((s) => !s.startsWith(':'))
    .join('/')}`;
  if (staticBase !== '/' && doc.includes(staticBase)) return true;

  // /login, /register, … style
  if (doc.includes(`/${rootSeg},`) || doc.includes(`/${rootSeg} ·`)) return true;

  return false;
}

function main() {
  const appSrc = readFileSync(appJsx, 'utf8');
  const routes = extractRoutes(appSrc);
  if (!routes.length) {
    console.error('check-docs-routes: App.jsx dan Route topilmadi');
    process.exit(1);
  }

  const docBodies = docs.map((p) => ({ path: p, body: readFileSync(p, 'utf8') }));
  let failed = false;

  for (const { path, body } of docBodies) {
    const missing = routes.filter((r) => !isDocumented(r, body));
    if (missing.length) {
      failed = true;
      console.error(`\n❌ ${path.replace(root + '/', '')} da yo‘q / yopilmagan:`);
      for (const r of missing) console.error(`   - ${r}`);
    } else {
      console.log(`✓ ${path.replace(root + '/', '')} — ${routes.length} route qoplangan`);
    }
  }

  const qanday = docBodies.find((d) => d.path.endsWith('QANDAY-ISHLAYDI.md'))?.body || '';
  const tableMissing = REQUIRED_IN_QANDAY_TABLE.filter((p) => {
    // jadval qatorida Brauzer URL sifatida
    return !qanday.includes(`| \`${p}\``) && !qanday.includes(`| ${p} |`);
  });
  if (tableMissing.length) {
    failed = true;
    console.error('\n❌ QANDAY-ISHLAYDI.md §4 jadvalida yo‘q (hub qatorlar):');
    for (const p of tableMissing) console.error(`   - ${p}`);
  } else {
    console.log('✓ QANDAY-ISHLAYDI.md §4 hub qatorlari bor');
  }

  if (failed) {
    console.error('\nRoute o‘zgarsa: App.jsx + docs/FOYDALANUVCHI-SAYTI.md + docs/QANDAY-ISHLAYDI.md');
    process.exit(1);
  }
  console.log('\ncheck-docs-routes: OK');
}

main();
