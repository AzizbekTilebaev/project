/**
 * OCR PDF → frontend/public/data/naqillar.json (faqat PDF)
 *
 *   pdftotext "new/kitapxana.com_naqil (1).pdf" new/naqil-ocr.txt
 *   node scripts/parse-naqil-pdf.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const TOC = [
  { id: 'miynet', title: 'Мийнет ҳаққында', match: /^МИЙНЕТ\s+ҲАҚҚЫНДА/ },
  { id: 'diyqan', title: 'Дийқаншылық кәсиби ҳаққында', match: /^ДИЙҚАНШЫЛЫҚ\s+КӘСИБИ/ },
  { id: 'mal', title: 'Мал шарўашылық кәсиби ҳаққында', match: /^МАЛ\s+ШАРЎАШЫЛЫҚ/ },
  { id: 'balyq', title: 'Балықшылық кәсиби ҳаққында', match: /^БАЛЫҚШЫЛЫҚ\s+КӘСИБИ/ },
  { id: 'anshy', title: 'Аңшылық кәсиби ҳаққында', match: /^АҢШЫЛЫҚ\s+КӘСИБИ/ },
  { id: 'sawda', title: 'Саўда-сатық ҳаққында', match: /^САЎДА\s+САТЫҚ/ },
  { id: 'moral', title: 'Жәмийетлик мораль, ақыл-нәсият', match: /^ЖӘМИЙЕТЛИК\s+МОРАЛЬ/ },
  { id: 'ata-ana', title: 'Ата-ана, туўысқанлар (нәсият)', match: /^АТА-АНА,\s+ТУЎЫСҚАН/ },
  { id: 'dastur', title: 'Дәстүр, үрип-әдетлер ҳаққында', match: /^ДӘСТҮР,\s+ҮРИП-ӘДЕТ/ },
  { id: 'oner', title: 'Өнер-билим алыў ҳаққында', match: /^ҲӘР\s+ТҮРЛИ\s+ӨНЕР/ },
  { id: 'til', title: 'Тил, сөз өнери ҳаққында', match: /^ТИЛ,\s+СӨЗ\s+ӨНЕРИ/ },
  { id: 'juwap', title: 'Жуўап-айтыс ҳәм ойын дәлкек', match: /^НАҚЫЛ-МАҚАЛЛАРДЫҢ\s+ЖУЎАП/ },
  { id: 'densawliq', title: 'Ден саўлық, тазалық ҳәм азық-аўқат', match: /^ДЕН\s+САЎЛЫҚ/ },
  { id: 'watan', title: 'Ўатан, ел-халықты сүйиў', match: /^ЎАТАН,\s+ЕЛ-ХАЛЫҚ/ },
  { id: 'dostliq', title: 'Дослық ҳәм муҳаббат', match: /^ДОСЛЫҚ\s+ҲӘМ\s+МУҲАББАТ/ },
  { id: 'awyz', title: 'Аўызбиршилиқ, сыр сақлаў', match: /^АЎЫЗБИРШИЛИК,\s+СЫР/ },
  { id: 'batyr', title: 'Батыр, ер-азаматлық', match: /^БАТЫР,\s+ЕР-АЗАМАТ/ },
  { id: 'tabiyat', title: 'Жыл мәўсимлери ҳәм тәбият', match: /^ЖЫЛ\s+МӘЎСИМЛЕРИ/ },
  { id: 'hakim', title: 'Ҳәкимшиликке қарсы', match: /^ҲӘКИМШИЛИККЕ\s+ҚАРСЫ/ },
  { id: 'berdaq', title: 'Шайырлар: Бердақ', match: /БЕРДАҚ/ },
  { id: 'majıtov', title: 'Шайырлар: Сейфулғабит Мәжитов', match: /СЕЙФУЛҒАБИТ|МӘЖИТОВТАН/ },
  { id: 'dabylov', title: 'Шайырлар: Аббаз Дабылов', match: /АББАЗ\s+ДАБЫЛОВ/ },
  { id: 'sovet', title: 'Совет дәўиринде дөреген нақыл-афоризмлер', match: /^СОВЕТ\s+ДӘЎИРИНДЕ/ },
];

const NOISE = [
  /^kitapxana\.com/i,
  /^Халық\s*[-–]/,
  /^Қарақалпақ фольклоры/,
  /^Мазмуны:/,
  /^\d+$/,
  /^Халық$/,
];

function isNoise(line) {
  const t = line.trim();
  if (!t) return true;
  return NOISE.some((r) => r.test(t));
}

function matchSection(merged) {
  for (let i = 0; i < TOC.length; i++) {
    if (TOC[i].match.test(merged)) return i;
  }
  return -1;
}

function parsePdf(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/\u000c/g, '').trim());
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^МИЙНЕТ\s+ҲАҚҚЫНДА\s+НАҚЫЛ-МАҚАЛЛАР$/.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && isNoise(lines[j])) j++;
      if (j < lines.length && !/^\d+$/.test(lines[j]) && lines[j].length > 15) {
        start = i;
        break;
      }
    }
  }

  const sections = TOC.map((t) => ({ ...t, items: [] }));
  let secIdx = -1;
  let buf = [];
  const used = new Set();

  function flush() {
    if (!buf.length || secIdx < 0) {
      buf = [];
      return;
    }
    const text = buf.join('\n').trim();
    buf = [];
    if (text.length < 8) return;
    const k = text.replace(/\s+/g, ' ').toLowerCase();
    if (used.has(k)) return;
    used.add(k);
    sections[secIdx].items.push(text);
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (isNoise(line)) continue;

    let j = i;
    let matched = matchSection(line);
    if (matched < 0 && /НАҚЫЛ|ШАЙЫР|АФОРИЗМ|ДИДАКТИКАЛЫҚ|МӘЖИТОВ|ДАБЫЛОВ|БЕРДАҚ/.test(line)) {
      let look = line;
      let k = i + 1;
      while (k < lines.length && k < i + 4) {
        const nxt = lines[k];
        if (isNoise(nxt)) {
          k++;
          continue;
        }
        if (nxt.length > 90 || /[.!?]$/.test(nxt)) break;
        if (/[а-яәөүғқңҳўі]/.test(nxt) && !/[А-ЯӘӨҮҒҚҢҲЎІ]{5}/.test(nxt)) break;
        look += ` ${nxt}`;
        matched = matchSection(look);
        if (matched >= 0) {
          j = k;
          break;
        }
        k++;
      }
    }

    if (matched >= 0) {
      flush();
      secIdx = matched;
      i = j;
      continue;
    }

    if (secIdx < 0) continue;
    if (/kitapxana/i.test(line)) continue;
    if (/^НАҚЫЛ-МАҚАЛЛАР$/.test(line)) continue;

    buf.push(line);
    if (/[.!?…]["»]?$/.test(line)) flush();
  }
  flush();

  return sections
    .filter((s) => s.items.length > 0)
    .map((s) => ({ id: s.id, title: s.title, count: s.items.length, items: s.items }));
}

const ocrPath = path.join(root, 'new/naqil-ocr.txt');
if (!fs.existsSync(ocrPath)) {
  console.error('Missing', ocrPath, '— run pdftotext first');
  process.exit(1);
}

const sections = parsePdf(fs.readFileSync(ocrPath, 'utf8'));
const payload = {
  source: 'kitapxana.com — Қарақалпақ фольклоры. Нақыл-мақаллар (PDF)',
  language: 'kaa',
  script: 'cyrillic',
  total: sections.reduce((a, s) => a + s.count, 0),
  sections,
};

const out = path.join(root, 'frontend/public/data/naqillar.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload));
console.log('Wrote', out);
console.log('sections', sections.length, 'total', payload.total);
for (const s of sections) console.log(`  ${String(s.count).padStart(4)}  ${s.title}`);
