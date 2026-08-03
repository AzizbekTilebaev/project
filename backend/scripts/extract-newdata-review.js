/**
 * Telegram HTML export → review pack (NO DB import).
 *
 *   node scripts/extract-newdata-review.js
 *
 * Output: fordata/newdata-review/{index.html, candidates.json, summary.json}
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  detectScript,
  ensureScriptPair,
  normalizeApostropheLatin,
  normalizeSource,
  slugifyWriterName,
  toCyrillic,
  toLatin,
} from '../src/utils/qqScript.js';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'fordata', 'newdata');
const OUT = path.join(ROOT, 'fordata', 'newdata-review');

function hashText(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}

const GENERATOR_VERSION = 2;

function safeFromCodePoint(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return '';
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

function decodeEntities(html) {
  return String(html || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => safeFromCodePoint(Number(n)))
    .replace(/&amp;/gi, '&');
}

function htmlToPlain(html) {
  // Taglardi awırat, soń entities — &lt;...&gt; literal tekst joǵalmawı ushın
  return normalizeSource(
    decodeEntities(
      String(html || '')
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\/\s*div\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    )
  )
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function listHtmlPages() {
  const files = fs
    .readdirSync(SRC)
    .filter((f) => /^messages(\d*)\.html$/i.test(f))
    .sort((a, b) => {
      const na = Number((a.match(/messages(\d*)/) || [])[1] || 1) || 1;
      const nb = Number((b.match(/messages(\d*)/) || [])[1] || 1) || 1;
      return na - nb;
    });
  return files.map((f) => path.join(SRC, f));
}

function parseMessages(html, page) {
  const out = [];
  // Split on message blocks
  const re =
    /<div class="message default clearfix"[^>]*id="message(-?\d+)"[^>]*>([\s\S]*?)(?=<div class="message |$)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = Number(m[1]);
    const block = m[2];
    const dateM =
      block.match(/<div class="[^"]*\bdate\b[^"]*"[^>]*title="([^"]+)"/i) ||
      block.match(/title="([^"]+)"/);
    const fromM = block.match(/<div class="from_name">\s*([\s\S]*?)\s*<\/div>/i);
    const textM = block.match(/<div class="text">\s*([\s\S]*?)\s*<\/div>/i);
    const forwarded = /forwarded body|class="forwarded"/i.test(block);
    const mediaKinds = [];
    if (/Photo/i.test(block) && /Not included/i.test(block)) mediaKinds.push('photo');
    if (/Video file/i.test(block) && /Not included/i.test(block)) mediaKinds.push('video');
    if (/Audio file/i.test(block) && /Not included/i.test(block)) mediaKinds.push('audio');
    if (/Voice message/i.test(block) && /Not included/i.test(block)) mediaKinds.push('voice');
    if (/\bFile\b/i.test(block) && /Not included/i.test(block) && !/Video file|Audio file/i.test(block)) {
      mediaKinds.push('file');
    }

    const textHtml = textM ? textM[1] : '';
    const textPlain = htmlToPlain(textHtml);
    out.push({
      telegramId: id,
      page,
      postedAt: dateM ? dateM[1] : null,
      fromName: fromM ? htmlToPlain(fromM[1]) : null,
      isForwarded: forwarded,
      textPlain,
      hasMedia: mediaKinds.length > 0,
      mediaKinds,
      hashtags: [...textPlain.matchAll(/#[\p{L}\d_]+/gu)].map((x) => x[0]),
    });
  }
  return out;
}

function parseAuthor(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const authorRe =
    /^(?:Автор|Авт|Avtor|AVTOR|Авторлар|Muallif|Муаллиф|Муаллифлар)\s*[:;.\-–]\s*(.+)$/iu;
  // Sońǵı 6 qatar + basındaǵı 2 qatar
  const idxs = [
    ...Array.from({ length: Math.min(6, lines.length) }, (_, i) => lines.length - 1 - i),
    ...Array.from({ length: Math.min(2, lines.length) }, (_, i) => i),
  ];
  for (const i of idxs) {
    const line = lines[i];
    const m = line.match(authorRe);
    if (m) return m[1].replace(/\s+/g, ' ').trim().slice(0, 120);
    const dash = line.match(/^[—–-]\s*([\p{L}][\p{L}\s.'-]{2,60})$/u);
    if (dash) return dash[1].replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  return null;
}

function authorCanonicalKey(author) {
  const folded = searchFold(normalizeAuthorName(author));
  if (!folded) return '';
  // Sóz tártibin birlestiriw: "Toktarbaeva Indira" ≈ "Indira Toqtarbaeva"
  return folded.split(/\s+/).filter(Boolean).sort().join(' ');
}

function normalizeAuthorName(author) {
  return normalizeApostropheLatin(String(author || ''))
    .replace(/^(?:shayır|shayir|шайыр)\s+/iu, '')
    .replace(/\s+(?:shayır|shayir|шайыр)\.?$/iu, '')
    .replace(/\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}.*$/u, '')
    .replace(
      /\s+\d{1,2}\s*[-–.]?\s*(?:январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр|yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentyabr|oktyabr|noyabr|dekabr).*$/iu,
      ''
    )
    .replace(/\s+\d{4}\s*[-–]?\s*(?:jıl|jılı|жыл|жылы).*$/iu, '')
    .replace(/[\s.,;:–-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(msg) {
  const t = msg.textPlain || '';
  const low = t.toLowerCase();
  if (!t && msg.hasMedia) return 'media_stub';
  if (!t) return 'other';
  // Contest / results — promo dan aldın
  if (
    /soraw\s*[:.]|juwap\s*[:.]|javob\s*[:.]/i.test(low) ||
    /^\d+\s*[-.)]?\s*orin/im.test(t) ||
    /\d+\s*[-.]?\s*orindi/i.test(low)
  ) {
    return 'contest';
  }
  if (
    /тест|test|kanal siltemesi|@qqshayirlar|telefon|whatsapp|\+998/i.test(low) ||
    /qo'?sıli[nń]|obuna|subscribe/i.test(low)
  ) {
    if (t.length < 400) return 'promo';
  }
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const author = parseAuthor(t);
  const bodyLines = author
    ? lines.filter(
        (l) =>
          !/^(?:Автор|Авт|Avtor|AVTOR|Muallif|Муаллиф)\s*[:;.\-–]/iu.test(l)
      )
    : lines;
  const longEnough = t.length >= 80 && bodyLines.length >= 4;
  const shortLines = bodyLines.filter((l) => l.length > 0 && l.length < 90);
  const stanzaish =
    shortLines.length >= 4 &&
    shortLines.length / Math.max(1, bodyLines.length) >= 0.55 &&
    !/[.!?]{2,}/.test(t.slice(0, 200)) &&
    !/^\d+\s*[-.)]/m.test(t);
  if (longEnough && (stanzaish || author)) return 'poem';
  if (msg.hasMedia && t.length < 40) return 'media_stub';
  return 'other';
}

function extractPoem(msg) {
  const t = msg.textPlain;
  const authorRaw = parseAuthor(t);
  const authorNormalized = normalizeAuthorName(authorRaw);
  const authorKey = authorNormalized ? authorCanonicalKey(authorNormalized) : null;
  let lines = t.split('\n').map((l) => l.trimEnd());
  // strip author / footer lines
  lines = lines.filter(
    (l) =>
      !/^(?:Автор|Авт|Avtor|AVTOR|Muallif|Муаллиф)\s*[:;.\-–]/iu.test(l.trim()) &&
      !/^@qqshayirlar/i.test(l.trim()) &&
      !/^kanal/i.test(l.trim()) &&
      !/^\*{3,}$/.test(l.trim()) &&
      !/^={3,}$/.test(l.trim())
  );
  const plain = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const chunks = plain.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  let title = chunks[0]?.split('\n')[0]?.trim() || '';
  // Title faqat alohida stanza, qısqa, punktuatsiyasız bolsa
  const looksLikeTitle =
    title &&
    title.length <= 70 &&
    chunks.length > 1 &&
    chunks[0].split('\n').length === 1 &&
    !/[.,;:!?]$/.test(title) &&
    !/\p{Extended_Pictographic}|✍|❤️|👍|👏|👋/u.test(title);
  if (!looksLikeTitle) title = '';
  let body = plain;
  if (title) {
    body = chunks.slice(1).join('\n\n');
  }
  const script = detectScript(body || plain);
  const normBody =
    script === 'latin' ? normalizeApostropheLatin(body || plain) : body || plain;
  const pair = ensureScriptPair(normBody);
  const authorPair = authorNormalized ? ensureScriptPair(authorNormalized) : null;
  const titlePair = title ? ensureScriptPair(title) : null;
  return {
    titleCyrillic: titlePair?.cyrillic || null,
    titleLatin: titlePair?.latin || null,
    authorRaw,
    authorNormalized: authorNormalized || null,
    authorKey: authorKey || null,
    authorCyrillic: authorPair?.cyrillic || null,
    authorLatin: authorPair?.latin || null,
    authorSlug: authorNormalized ? slugifyWriterName(authorNormalized) : null,
    bodyCyrillic: pair.cyrillic,
    bodyLatin: pair.latin,
    sourceScript: pair.sourceScript,
    bodyHash: hashText(searchFold(pair.latin || pair.cyrillic)).slice(0, 24),
  };
}

console.log('📖 Reading Telegram HTML export…');
const pages = listHtmlPages();
if (!pages.length) {
  console.error('No messages*.html under fordata/newdata');
  process.exit(1);
}

const messages = [];
for (const p of pages) {
  const html = fs.readFileSync(p, 'utf8');
  const pageName = path.basename(p);
  messages.push(...parseMessages(html, pageName));
}

const classified = messages.map((msg) => {
  const kind = classify(msg);
  const poem = kind === 'poem' ? extractPoem(msg) : null;
  return {
    ...msg,
    kind,
    poem,
  };
});

const byHash = new Map();
for (const m of classified) {
  if (!m.poem?.bodyHash) continue;
  if (!byHash.has(m.poem.bodyHash)) byHash.set(m.poem.bodyHash, []);
  byHash.get(m.poem.bodyHash).push(m);
}

const candidates = classified
  .filter((m) => m.kind === 'poem')
  .map((m) => {
    const duplicateGroup = byHash.get(m.poem.bodyHash) || [];
    // Prefer an attributed copy as the canonical item, then retain source order.
    const canonical = duplicateGroup.find((item) => item.poem?.authorRaw) || duplicateGroup[0];
    const isDuplicate = Boolean(canonical && canonical !== m);
    return {
      telegramId: m.telegramId,
      postedAt: m.postedAt,
      page: m.page,
      isForwarded: m.isForwarded,
      hasMedia: m.hasMedia,
      mediaKinds: m.mediaKinds,
      hashtags: m.hashtags,
      kind: m.kind,
      bucket: isDuplicate
        ? 'takror'
        : m.poem.authorRaw
          ? 'aniq_muallifli'
          : 'muallifsiz',
      duplicateOf: isDuplicate ? [canonical.telegramId] : [],
      ...m.poem,
      textPlain: m.textPlain,
    };
  });

const noise = classified
  .filter((m) => ['promo', 'contest', 'media_stub'].includes(m.kind))
  .map((m) => ({
    telegramId: m.telegramId,
    postedAt: m.postedAt,
    page: m.page,
    kind: m.kind,
    bucket: 'shovqin',
    textPlain: m.textPlain || '',
    preview: (m.textPlain || '').slice(0, 160),
    hasMedia: m.hasMedia,
    mediaKinds: m.mediaKinds,
  }));

const summary = {
  generatorVersion: GENERATOR_VERSION,
  pages: pages.length,
  messages: messages.length,
  poems: candidates.length,
  withAuthor: candidates.filter((c) => c.authorRaw).length,
  withoutAuthor: candidates.filter((c) => !c.authorRaw).length,
  duplicates: candidates.filter((c) => c.duplicateOf.length).length,
  duplicateGroups: new Set(
    candidates.filter((c) => c.duplicateOf.length).map((c) => c.bodyHash)
  ).size,
  noise: noise.length,
  mediaMissing: classified.filter((m) => m.hasMedia).length,
  byBucket: {
    aniq_muallifli: candidates.filter((c) => c.bucket === 'aniq_muallifli').length,
    muallifsiz: candidates.filter((c) => c.bucket === 'muallifsiz').length,
    takror: candidates.filter((c) => c.bucket === 'takror').length,
    shovqin: noise.length,
  },
  topAuthors: Object.values(
    candidates.reduce((acc, c) => {
      const key = c.authorKey || '(muallifsiz)';
      if (!acc[key]) {
        acc[key] = { name: c.authorLatin || c.authorRaw || '(muallifsiz)', count: 0 };
      }
      acc[key].count += 1;
      // Prefer longer/more complete display name
      const next = c.authorLatin || c.authorRaw || '';
      if (next.length > String(acc[key].name).length) acc[key].name = next;
      return acc;
    }, {})
  )
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 30)
    .map(({ name, count }) => ({ name, count })),
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
fs.writeFileSync(
  path.join(OUT, 'candidates.json'),
  JSON.stringify({ summary, candidates, noise }, null, 2),
  'utf8'
);

const esc = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buckets = ['aniq_muallifli', 'muallifsiz', 'takror', 'shovqin'];
const reviewItems = [
  ...candidates,
  ...noise.map((item) => ({
    ...item,
    titleLatin: `Shovqin: ${item.kind}`,
    bodyLatin: item.textPlain || '(media matnisiz)',
    authorRaw: null,
    duplicateOf: [],
  })),
];
const html = `<!DOCTYPE html>
<html lang="kaa">
<head>
<meta charset="utf-8"/>
<title>newdata review — qqshayirlar</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f6f1e7;color:#1c1917}
  header{padding:1.2rem 1.5rem;background:#134e4a;color:#fff;position:sticky;top:0}
  header h1{margin:0;font-size:1.25rem}
  .stats{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.7rem}
  .chip{background:#0f766e;padding:.25rem .6rem;border-radius:999px;font-size:.8rem}
  .toolbar{padding:1rem 1.5rem;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
  .toolbar button,.toolbar select{padding:.4rem .7rem;border-radius:8px;border:1px solid #d6d3d1;background:#fff}
  .toolbar button.active{background:#134e4a;color:#fff;border-color:#134e4a}
  .list{padding:0 1.5rem 2rem;display:grid;gap:.8rem}
  article{background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:1rem 1.1rem}
  article h3{margin:0 0 .35rem;font-size:1.05rem}
  .meta{font-size:.78rem;color:#78716c;display:flex;flex-wrap:wrap;gap:.5rem}
  pre{white-space:pre-wrap;font-family:Georgia,serif;line-height:1.55;margin:.7rem 0 0;font-size:.95rem}
  .badge{display:inline-block;padding:.15rem .45rem;border-radius:6px;font-size:.7rem;font-weight:700}
  .b-aniq{background:#d1fae5;color:#065f46}
  .b-muallifsiz{background:#fef3c7;color:#92400e}
  .b-takror{background:#e0e7ff;color:#3730a3}
  .b-shovqin{background:#fee2e2;color:#991b1b}
  .decisions{display:flex;gap:.4rem;margin-top:.8rem}
  .decisions button{border:1px solid #d6d3d1;background:#fff;border-radius:7px;padding:.3rem .55rem;cursor:pointer}
  article[data-decision="accept"]{border-color:#10b981;box-shadow:inset 4px 0 #10b981}
  article[data-decision="reject"]{border-color:#ef4444;opacity:.68}
  article[data-decision="pending"]{border-color:#f59e0b}
  .decisions button.active{color:#fff;border-color:transparent}
  .decisions button[data-value="accept"].active{background:#059669}
  .decisions button[data-value="reject"].active{background:#dc2626}
  .decisions button[data-value="pending"].active{background:#d97706}
  .hidden{display:none}
</style>
</head>
<body>
<header>
  <h1>fordata/newdata — tekshirish to‘plami</h1>
  <div class="stats">
    <span class="chip">Post: ${summary.messages}</span>
    <span class="chip">She’r: ${summary.poems}</span>
    <span class="chip">Muallifli: ${summary.withAuthor}</span>
    <span class="chip">Muallifsiz: ${summary.withoutAuthor}</span>
    <span class="chip">Takror: ${summary.duplicates}</span>
    <span class="chip">Shovqin: ${summary.noise}</span>
    <span class="chip">Media yo‘q: ${summary.mediaMissing}</span>
  </div>
</header>
<div class="toolbar">
  <button data-bucket="all" class="active">Hammasi</button>
  ${buckets
    .map(
      (b) =>
        `<button data-bucket="${b}">${b} (${summary.byBucket[b] || 0})</button>`
    )
    .join('\n')}
  <input id="q" placeholder="Qidiruv (muallif / sarlavha)…" style="flex:1;min-width:180px;padding:.4rem .7rem;border-radius:8px;border:1px solid #d6d3d1"/>
  <button id="export-decisions" type="button">Qarorlarni JSON olish</button>
  <span id="decision-stats" class="meta"></span>
</div>
<div class="list" id="list">
${reviewItems
  .map((c) => {
    const title = c.titleLatin || c.titleCyrillic || '(sarlavhasiz)';
    const author = c.authorLatin || c.authorRaw || '—';
    const body = c.bodyLatin || c.bodyCyrillic || c.textPlain || '';
    const reviewId = `${c.page || 'page'}:${c.telegramId}`;
    return `<article data-review-id="${esc(reviewId)}" data-bucket="${c.bucket}" data-search="${esc(
      `${title} ${author} ${body}`.toLowerCase()
    )}">
  <h3>${esc(title)}</h3>
  <div class="meta">
    <span class="badge b-${c.bucket}">${c.bucket}</span>
    <span>#${c.telegramId}</span>
    <span>${esc(c.postedAt || '')}</span>
    <span>Muallif: ${esc(author)}</span>
    ${c.hasMedia ? `<span>media: ${esc(c.mediaKinds.join(','))}</span>` : ''}
    ${c.duplicateOf.length ? `<span>takror: ${c.duplicateOf.join(',')}</span>` : ''}
  </div>
  <pre>${esc(body.slice(0, 1200))}${body.length > 1200 ? '…' : ''}</pre>
  <div class="decisions" aria-label="Tekshirish qarori">
    <button type="button" data-value="accept">Qabul</button>
    <button type="button" data-value="reject">Rad etish</button>
    <button type="button" data-value="pending">Keyinroq</button>
  </div>
</article>`;
  })
  .join('\n')}
</div>
<script>
const buttons=[...document.querySelectorAll('[data-bucket]')];
const q=document.getElementById('q');
const decisionStats=document.getElementById('decision-stats');
const storageKey='qqshayirlar-newdata-review-v1';
let decisions={};
try{decisions=JSON.parse(localStorage.getItem(storageKey)||'{}')||{}}catch{}
let bucket='all';
function renderDecisions(){
  const counts={accept:0,reject:0,pending:0};
  document.querySelectorAll('article[data-review-id]').forEach(a=>{
    const value=decisions[a.dataset.reviewId]||'';
    a.dataset.decision=value;
    a.querySelectorAll('.decisions button').forEach(b=>b.classList.toggle('active',b.dataset.value===value));
    if(counts[value]!==undefined)counts[value]++;
  });
  decisionStats.textContent='Qabul: '+counts.accept+' · Rad: '+counts.reject+' · Keyinroq: '+counts.pending;
}
function apply(){
  const term=(q.value||'').toLowerCase().trim();
  document.querySelectorAll('article').forEach(a=>{
    const okBucket=bucket==='all'||a.dataset.bucket===bucket;
    const okQ=!term||(a.dataset.search||'').includes(term);
    a.classList.toggle('hidden',!(okBucket&&okQ));
  });
}
buttons.forEach(b=>b.addEventListener('click',()=>{
  bucket=b.dataset.bucket;
  buttons.forEach(x=>x.classList.toggle('active',x===b));
  apply();
}));
q.addEventListener('input',apply);
document.querySelectorAll('.decisions button').forEach(button=>button.addEventListener('click',()=>{
  const article=button.closest('article[data-review-id]');
  const id=article.dataset.reviewId;
  const value=button.dataset.value;
  if(decisions[id]===value)delete decisions[id];else decisions[id]=value;
  localStorage.setItem(storageKey,JSON.stringify(decisions));
  renderDecisions();
}));
document.getElementById('export-decisions').addEventListener('click',()=>{
  const payload={
    exportedAt:new Date().toISOString(),
    source:'fordata/newdata-review',
    decisions:Object.entries(decisions).map(([reviewId,decision])=>({reviewId,decision}))
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='newdata-review-decisions.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),0);
});
renderDecisions();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log('\n✅ newdata review yozildi:');
console.log(`   ${path.join(OUT, 'index.html')}`);
console.log(`   ${path.join(OUT, 'candidates.json')}`);
console.log(`   ${path.join(OUT, 'summary.json')}`);
console.log(JSON.stringify(summary, null, 2));
