// Morfologiyalıq segmenterdi DB'siz sınaw: node scripts/test-morphology.mjs
// Gold mısal: apertium-kaa test/G-morph-gold.txt
import { analyzeWord } from '../src/services/morphologyService.js';

const KNOWN = new Set([
  'kitap', 'mektep', 'bala', 'diyqan', 'bay', 'oqıw', 'oqı', 'qaraqalpaq',
  'gúl', 'til', 'jol', 'suw', 'úy', 'ata', 'is', 'miynet', 'shárt', 'jaz',
  // apertium gold
  'tarmaq', 'ket', 'soq', 'kel', 'maqala', 'bilezik', 'adam', 'bol',
  'mámleket', 'jıl', 'ish', 'qıl', 'bar',
]);
const isRoot = (latin) => KNOWN.has(latin);

const words = [
  'kitaplarımızda',
  'kitabına',
  'diyqanshılıq',
  'baylıq',
  'oqıwshılar',
  'Qaraqalpaqstan',
  'balalarımnan',
  'kitapxanashılıq',
  'mektepke',
  'gúllerdiń',
  'miynetkeshler',
  'китапларымызда',
  'мектепке',
  'жолдаслар',
  // apertium-kaa gold
  'kitapqa',
  'tilge',
  'kelgen',
  'ketken',
  'bilezigi',
  'bilezikke',
  'tarmaqqa',
  'tarmagı',
  'adamǵa',
  'jılǵa',
  'balamenen',
  'suwsız',
];

function fmt(a) {
  const parts = a.segments.map((s) =>
    s.isRoot ? `[${s.text}${s.isKnown ? '✓' : ''}]` : `+${s.text}(${s.role})`
  );
  return parts.join(' ');
}

const run = async () => {
  for (const mode of ['heuristic', 'dictionary']) {
    console.log(`\n=== ${mode === 'dictionary' ? 'sozlik penen' : 'DB-siz (evristika)'} ===`);
    for (const w of words) {
      const a = await analyzeWord(w, {
        isRoot: mode === 'dictionary' ? isRoot : null,
        script: 'latin',
      });
      console.log(`${w.padEnd(20)} → ${fmt(a)}`);
    }
  }
};

run();
