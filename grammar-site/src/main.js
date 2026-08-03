import { marked } from 'marked';
import './styles.css';

import md14 from '../../fordata/grammar/1-4-klass-tolıq-qoidalar.md?raw';
import md56 from '../../fordata/grammar/5-6-klass-tolıq-qoidalar.md?raw';
import md79 from '../../fordata/grammar/7-9-klass-tolıq-qoidalar.md?raw';
import md1011 from '../../fordata/grammar/10-11-klass-tolıq-qoidalar.md?raw';

/** Jıllar boyınsha ózgeris — ishki fayl atları / betler joq */
const YEAR_NOTES = {
  'k1-4': `
### Jıllar boyınsha
- **1–3 klass** — tiykarǵı orfografiya hám sóz shaqapları basqıshma-basqısh keniydi.
- **4-klass (2017 / 2019)** — 2017 Ana tili tolıǵıraq (seplik, tartım, kelbetlik); 2019 basqa tillerde — qısqaraq, tema+qoida usılı.
`,
  'k5-6': `
### Jıllar boyınsha
- **5-klass 2015** — dástúriy sistema (fonetika → sintaksis).
- **5-klass 2024** — jańa standart; tema ishinde grammatika; sepleniw, meyil/máhál, tallaw úlgileri.
- **6-klass 2017** — eń tolıq morfologiya (únleslik, feyil dárejeleri, almasıq túrleri).
- **6-klass 2022** — Ana tili kompetenciya; meyil, sanlıq, ráwish — tema ishinde.
`,
  'k7-9': `
### Jıllar boyınsha
- **7** — kómekshi shaqaplar, jay gáp aǵzaları.
- **8** — sóz dizbegi, birgelkili/qaratpa/kiris, punktuaciya.
- **9** — qospa gáp (dizbekli, baǵınıńqılı, dánekersiz, aralas), tuwra gáp.
- **2025** jańa basılımlar — kompetenciya usılı; dástúriy qoida qabatı tiykarınan 2017–2019 menen birdey.
`,
  'k10-11': `
### Jıllar boyınsha
- **10 (2017)** — stilistika (awızeki / jazba stiller).
- **10 (2022)** Ana tili — temalıq; stilistika «Tilim – baylıǵım» ishinde.
- **10 basqa tillerde (2019)** — tiykarınan qospa gáp (stilistika emes).
- **11 (2018)** — sóylew mádeniyatı (durıslıq, anıqlıq, logikalılıq, tazalıq, baylıq, tásirsheńlik) + is qaǵazları.
- **11 basqa tillerde (2019)** — tekst, stilistika, is qaǵazları.
`,
};

const BOOKS = [
  {
    id: 'k1-4',
    label: '1–4',
    title: '1–4 klass',
    subtitle: 'Ses, túbir, atlıq, feyil, gáp',
    markdown: md14,
  },
  {
    id: 'k5-6',
    label: '5–6',
    title: '5–6 klass',
    subtitle: 'Morfologiya, leksika, únleslik',
    markdown: md56,
  },
  {
    id: 'k7-9',
    label: '7–9',
    title: '7–9 klass',
    subtitle: 'Kómekshi, sintaksis, qospa gáp',
    markdown: md79,
  },
  {
    id: 'k10-11',
    label: '10–11',
    title: '10–11 klass',
    subtitle: 'Stilistika, sóylew mádeniyatı',
    markdown: md1011,
  },
];

marked.setOptions({
  gfm: true,
  breaks: false,
});

const YEAR_TAG = {
  '5-15': '2015',
  '5-24': '2024',
  '6-17': '2017',
  '6-22': '2022',
};

function cleanMarkdown(md) {
  let t = md.replace(/\r\n/g, '\n');

  // start at first ##
  const start = t.search(/^##\s+/m);
  if (start >= 0) t = t.slice(start);

  // drop internal/source sections
  t = t.replace(
    /^##\s+(Derek|Derekler|Derek faylları|Ayırım klass faylları).*$/gim,
    '___CUT___'
  );
  t = t.replace(
    /^###\s+(Derek|Derekler).*$/gim,
    '___CUT___'
  );
  const cut = t.indexOf('___CUT___');
  if (cut >= 0) t = t.slice(0, cut);

  // drop whole blockquotes that are meta
  t = t.replace(
    /^>(?:.*\n)*?(?=\n(?!>)|\n*$)/gm,
    (block) => {
      const s = block.toLowerCase();
      if (
        /saytqa|belgis|yillar\.md|fordata|\.md`|skaner|ocr|tiykar:|isbn|eskeriw|matnlı pdf|tolıq extract/.test(
          s
        )
      ) {
        // keep year-content quotes without filenames
        if (/ana tili 2022|basqa tillerde 2019/.test(s) && !/`[^`]+\\.md`/.test(block)) {
          return block;
        }
        // rewrite quotes that have useful year note + md path
        if (/ana tili 2022/.test(s)) {
          return '> Ana tili 2022 — temalıq bólimler.\n';
        }
        if (/basqa tillerde 2019/.test(s) && /qospa gáp/.test(s)) {
          return '> Basqa tillerde 2019 — qospa gáp.\n';
        }
        if (/basqa tillerde 2019/.test(s) && /tekst|stil/.test(s)) {
          return '> Basqa tillerde 2019 — tekst / stilistika.\n';
        }
        return '';
      }
      return block;
    }
  );

  // remove lines that are only md filenames / paths
  t = t
    .split('\n')
    .filter((line) => {
      const s = line.trim();
      if (/^Jıllar:\s*`/i.test(s)) return false;
      if (/fordata\//i.test(s)) return false;
      if (/^[-*]\s*`[^`]+\.md`/.test(s)) return false;
      if (/^[-*].*\.md`/.test(s) && /klass|taqqos|meta|tolıq/.test(s)) return false;
      if (/Saytqa qosılmaǵan/i.test(s)) return false;
      if (/^\*\*Usınıs:\*\*/i.test(s)) return false;
      return true;
    })
    .join('\n');

  // strip inline `something.md` and `YILLAR.md`
  t = t.replace(/`[^`\n]+\.md`/g, '');
  t = t.replace(/`YILLAR\.md`/g, '');

  // `` `[5-15]` `` → *(2015)* ; klass-only `` `[7]` `` → drop
  t = t.replace(/`\s*\[(\d-\d{2})\]\s*`/g, (_, key) => {
    const y = YEAR_TAG[key];
    return y ? `*(${y})*` : '';
  });
  t = t.replace(/`\s*\[\d\]\s*[–\-]\s*\[\d\]\s*`/g, '');
  t = t.replace(/`\s*\[(?:\d{1,2}|A|B|A\+B)\]\s*`/g, '');

  // bare [5-15] / [1]–[4] / [7]
  t = t.replace(/\[(\d-\d{2})\]/g, (_, key) => {
    const y = YEAR_TAG[key];
    return y ? `*(${y})*` : '';
  });
  t = t.replace(/\s*\[\d\]\s*[–\-]\s*\[\d\]/g, '');
  t = t.replace(/\s*\[(?:\d{1,2}|A|B|A\+B)\]/g, '');

  // leftover empty backticks
  t = t.replace(/`\s*`/g, '');

  // rename section for clarity
  t = t.replace(
    /##\s*Klass boyınsha\s*[«"]?ne jańa\??[»"]?/gi,
    '## Klass boyınsha jańalıqlar'
  );

  // tidy leftover empties / double spaces around punctuation
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/ \*(?=\s)/g, '');
  t = t.replace(/\(\s*\)/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/ \./g, '.');
  t = t.replace(/ ,/g, ',');

  return t.trim();
}

function renderBook(book) {
  const cleaned = cleanMarkdown(book.markdown);
  const years = YEAR_NOTES[book.id] || '';
  const body = marked.parse(cleaned + '\n\n' + years);
  return `
    <section class="book" id="${book.id}" data-book="${book.id}">
      <header class="book__head">
        <p class="book__eyebrow">${book.label} klass</p>
        <h2 class="book__title">${book.title}</h2>
        <p class="book__sub">${book.subtitle}</p>
      </header>
      <div class="book__body prose">${body}</div>
    </section>
  `;
}

function mount() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="atmosphere" aria-hidden="true"></div>

    <header class="top">
      <a class="brand" href="#top">Qaraqalpaq tili</a>
      <nav class="rail" aria-label="Klass toparları">
        ${BOOKS.map(
          (b) => `<a class="rail__link" href="#${b.id}" data-nav="${b.id}">${b.label}</a>`
        ).join('')}
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <p class="hero__brand">Qaraqalpaq tili</p>
        <h1 class="hero__title">Qoidalar</h1>
        <p class="hero__lead">
          Grammatika qoidaları hám mısallar — klass boyınsha, bir sahifada.
        </p>
        <a class="hero__cta" href="#k1-4">Baslaw</a>
      </section>

      <div class="stream">
        ${BOOKS.map(renderBook).join('')}
      </div>
    </main>

    <footer class="foot">
      <p>Qaraqalpaq tili · Qoidalar</p>
    </footer>
  `;

  const links = [...document.querySelectorAll('.rail__link')];
  const sections = BOOKS.map((b) => document.getElementById(b.id));

  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === visible.target.id));
    },
    { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] }
  );
  sections.forEach((s) => s && io.observe(s));

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('is-in');
      });
    },
    { threshold: 0.08 }
  );
  document.querySelectorAll('.book').forEach((el) => reveal.observe(el));
}

mount();
