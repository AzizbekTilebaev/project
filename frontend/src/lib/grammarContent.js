/**
 * Jamlangan grammar MD → oqıwshı ushın tazalanǵan HTML.
 * Ishki derek / fayl atları / bet nomerleri kórsetilmeydi.
 */
import { mdToHtml } from './mdToHtml';

import md14 from '../../../fordata/grammar/1-4-klass-tolıq-qoidalar.md?raw';
import md56 from '../../../fordata/grammar/5-6-klass-tolıq-qoidalar.md?raw';
import md79 from '../../../fordata/grammar/7-9-klass-tolıq-qoidalar.md?raw';
import md1011 from '../../../fordata/grammar/10-11-klass-tolıq-qoidalar.md?raw';
import mdJoqari from '../../../fordata/grammar/joqari-tolıq-qoidalar.md?raw';
import mdJoqariImla from '../../../fordata/grammar/joqari-imla-qoidalar.md?raw';
import mdJoqariMorfem from '../../../fordata/grammar/joqari-morfemika-soz-jasaliw-qoidalar.md?raw';
import mdJoqariMorf from '../../../fordata/grammar/joqari-morfologiya-qoidalar.md?raw';
import mdJoqariFon from '../../../fordata/grammar/joqari-fonetika-leksika-qoidalar.md?raw';
import mdJoqariSint from '../../../fordata/grammar/joqari-sintaksis-qoidalar.md?raw';

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
  'jq-tolıq': `
### Derekler (qısqasha)
- Universitet sabaqlıqları: Dáwletovlar 2010, imla jıynaǵı, Patullaeva, Berdimuratov, sintaksis 2009…
- Tolıq dizim — ishki registry; saytta fayl atları kórsetilmeydi.
`,
};

const YEAR_TAG = {
  '5-15': '2015',
  '5-24': '2024',
  '6-17': '2017',
  '6-22': '2022',
};

export function cleanGrammarMarkdown(md) {
  let t = md.replace(/\r\n/g, '\n');

  const start = t.search(/^##\s+/m);
  if (start >= 0) t = t.slice(start);

  t = t.replace(
    /^##\s+(Derek|Derekler|Derek faylları|Ayırım klass faylları).*$/gim,
    '___CUT___'
  );
  t = t.replace(/^###\s+(Derek|Derekler).*$/gim, '___CUT___');
  const cut = t.indexOf('___CUT___');
  if (cut >= 0) t = t.slice(0, cut);

  t = t.replace(/^>(?:.*\n)*?(?=\n(?!>)|\n*$)/gm, (block) => {
    const s = block.toLowerCase();
    if (
      /saytqa|belgis|yillar\.md|fordata|\.md`|skaner|ocr|tiykar:|isbn|eskeriw|matnlı pdf|tolıq extract/.test(
        s
      )
    ) {
      if (/ana tili 2022|basqa tillerde 2019/.test(s) && !/`[^`]+\.md`/.test(block)) {
        return block;
      }
      if (/ana tili 2022/.test(s)) return '> Ana tili 2022 — temalıq bólimler.\n';
      if (/basqa tillerde 2019/.test(s) && /qospa gáp/.test(s)) {
        return '> Basqa tillerde 2019 — qospa gáp.\n';
      }
      if (/basqa tillerde 2019/.test(s) && /tekst|stil/.test(s)) {
        return '> Basqa tillerde 2019 — tekst / stilistika.\n';
      }
      return '';
    }
    return block;
  });

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

  t = t.replace(/`[^`\n]+\.md`/g, '');
  t = t.replace(/`YILLAR\.md`/g, '');
  t = t.replace(/`JOQARI\.md`/g, '');
  t = t.replace(/`joqari-[^`]+\.md`/g, '');
  t = t.replace(/`ocr\/[^`]+`/g, '');

  t = t.replace(/`\s*\[(\d-\d{2})\]\s*`/g, (_, key) => {
    const y = YEAR_TAG[key];
    return y ? `*(${y})*` : '';
  });
  t = t.replace(/`\s*\[\d\]\s*[–\-]\s*\[\d\]\s*`/g, '');
  t = t.replace(/`\s*\[(?:\d{1,2}|A|B|A\+B)\]\s*`/g, '');

  t = t.replace(/\[(\d-\d{2})\]/g, (_, key) => {
    const y = YEAR_TAG[key];
    return y ? `*(${y})*` : '';
  });
  t = t.replace(/\s*\[\d\]\s*[–\-]\s*\[\d\]/g, '');
  t = t.replace(/\s*\[(?:\d{1,2}|A|B|A\+B)\]/g, '');
  t = t.replace(/`\s*`/g, '');

  t = t.replace(
    /##\s*Klass boyınsha\s*[«"]?ne jańa\??[»"]?/gi,
    '## Klass boyınsha jańalıqlar'
  );

  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/ \*(?=\s)/g, '');
  t = t.replace(/\(\s*\)/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/ \./g, '.');
  t = t.replace(/ ,/g, ',');

  return t.trim();
}

export const GRAMMAR_BOOKS = [
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

/** Joqarı oqıw / ilimiy qatlam — maktabdan ayrı */
export const JOQARI_BOOKS = [
  {
    id: 'jq-tolıq',
    label: 'Tolıq',
    title: 'Joqarı — jamlangan',
    subtitle: 'Fonetika → morfemiya → morfologiya → sintaksis → imla',
    markdown: mdJoqari,
  },
  {
    id: 'jq-imla',
    label: 'Imla',
    title: 'Imla qaǵıydaları',
    subtitle: 'Álipbe, túbir+qosımta, qosılıp/bólek/defis',
    markdown: mdJoqariImla,
  },
  {
    id: 'jq-morfem',
    label: 'Morfemika',
    title: 'Morfemika · sóz jasalıw · tartım',
    subtitle: 'Morfema, tiykar, morfonologiya',
    markdown: mdJoqariMorfem,
  },
  {
    id: 'jq-morf',
    label: 'Morfologiya',
    title: 'Morfologiya',
    subtitle: 'Sóz shaqapları (joqarı)',
    markdown: mdJoqariMorf,
  },
  {
    id: 'jq-fon',
    label: 'Leksika',
    title: 'Fonetika hám leksikologiya',
    subtitle: 'Ses, máni, frazeologiya',
    markdown: mdJoqariFon,
  },
  {
    id: 'jq-sint',
    label: 'Sintaksis',
    title: 'Sintaksis hám qospa gáp',
    subtitle: 'Jay / qospa gáp (OCR keńeytiledi)',
    markdown: mdJoqariSint,
  },
];

export function grammarBookHtml(book) {
  const cleaned = cleanGrammarMarkdown(book.markdown);
  const years = YEAR_NOTES[book.id] || '';
  return mdToHtml(`${cleaned}\n\n${years}`);
}
