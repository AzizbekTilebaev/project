/**
 * Biografiyadan jazıwshı rolların ajıratıw (шайыр / жазыўшы / …).
 * Seed skripti hám API birdey qádelerden paydalanadı.
 */

export const WRITER_ROLE_RULES = [
  { tag: 'balalar_shayiri', re: /балалар\s+шайыр/ },
  { tag: 'balalar_jaziwshisi', re: /балалар\s+жазыўшы/ },
  { tag: 'xaliq_shayiri', re: /халық\s+шайыр/ },
  { tag: 'belgili_shayir', re: /белгили\s+шайыр|атақлы\s+(халық\s+)?шайыр/ },
  { tag: 'lirik_shayir', re: /лирик\s+шайыр/ },
  { tag: 'jawinger_shayir', re: /жаўынгер\s+шайыр/ },
  { tag: 'shayir', re: /шайыр|шаир/ },
  { tag: 'satirik_jaziwshi', re: /сатирик\s+жазыўшы|юморист\s+жазыўшы/ },
  { tag: 'fantast_jaziwshi', re: /фантаст\s+жазыўшы/ },
  { tag: 'romanist', re: /романист/ },
  { tag: 'prozaik', re: /прозаик|прозасы/ },
  { tag: 'jaziwshi', re: /жазыўшы|жазуўшы|жазыушы/ },
  { tag: 'dramaturg', re: /драм+атург|драмагургия|драматургия/ },
  { tag: 'jurnalist', re: /журналист/ },
  { tag: 'publicist', re: /публицист/ },
  { tag: 'dilmash', re: /дилмаш|аўдармашы/ },
  { tag: 'sinshi', re: /сыншы/ },
  { tag: 'adebiyat_izertlewshisi', re: /әдебият\s+изертлеўши|әдебиятшы|әдебияттаныў/ },
  { tag: 'folklorist', re: /фольклорист|фольклор\s+изертлеў/ },
  { tag: 'alim', re: /\bалым\b|илимпаз/ },
  { tag: 'pedagog', re: /педагог/ },
  { tag: 'kompozitor', re: /композитор/ },
  { tag: 'rejissor', re: /режиссёр|режиссер/ },
  { tag: 'tilshi', re: /тилши/ },
  // Joy atı «… жыраў атындағы» — jeke rol emes
  { tag: 'jiraw', re: /(?<!атындағы\s)(?<!атыӊдағы\s)жыраў|(?<!атындағы\s)жир[аә]ў/i },
  { tag: 'poet_vakili', re: /поэзиясы/ },
  { tag: 'jemiyetlik_isker', re: /жәмийетлик\s+искер/ },
];

function stripHtml(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function openingClause(plain) {
  const m = plain.match(/^(.{0,220}?)[—\-–]\s*([^.!?]{3,220})/);
  if (m) return m[2].trim();
  const s = plain.match(/^([^.!?]{10,300})/);
  return (s ? s[1] : plain.slice(0, 220)).trim();
}

/** @returns {{ roles: string[], evidence: string }} */
export function extractWriterRoles(biography) {
  const plain = stripHtml(biography);
  if (!plain) return { roles: [], evidence: '' };
  const clause = openingClause(plain);
  const src = clause.toLowerCase();
  const head = plain.slice(0, 400).toLowerCase();

  // Jıraw: joy atı false-positive
  const placeJiraw = /жыраў\s+аты|жир[аә]ў\s+аты/i.test(head);

  let roles = [];
  for (const { tag, re } of WRITER_ROLE_RULES) {
    if (tag === 'jiraw' && placeJiraw) continue;
    if (re.test(src)) roles.push(tag);
  }
  if (!roles.length) {
    for (const { tag, re } of WRITER_ROLE_RULES) {
      if (tag === 'jiraw' && placeJiraw) continue;
      if (re.test(head)) roles.push(tag);
    }
  }
  roles = [...new Set(roles)];
  return { roles, evidence: clause.slice(0, 200) };
}
