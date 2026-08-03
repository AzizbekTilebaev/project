/**
 * Qaraqalpaq tili affiks inventarı (morfologiyalıq segmenter ushın).
 *
 * Derek / Manba:
 *   1) Apertium apertium-kaa (HFST lexc+twol) — asosiy flektiv paradigma:
 *      https://github.com/apertium/apertium-kaa
 *      LEXICON: PLURAL, POSSESSIVES, CASES*, V-FINITE*, V-PERS*, V-DER, CLIT*
 *      Archiphonemes: {A}→a/e, {I}→ı/i, {D}→d/t, {G}→g/ǵ/k/q, {N}→n, …
 *      Surface formalar usı faylda keńeytilgen (twol nızamları ámelge asırılǵan).
 *   2) Saǵıydullaeva Z. PDF — sóz jasawshı (dórendi) qosımtalar (-shı, -las,
 *      -lıq, -shılıq, -xana, -stan, -ger, -kesh, -man, -zar, -nama, …).
 *
 * Barlıq forma varianttları KANONİK LATIN jazıwında (kishi hárip):
 *   unlılar: a á e i ı o ó u ú   |   digraflar: sh, ch
 *   (qqScript.toLatin() shıǵaratuǵın álipbe menen birdey.)
 *
 * slot / rank — segmenttiń sózdegi ornı (tübirden sırtqa qaray):
 *   verb(0) → seplik(1) → tartım(2) → kóplik(3) → jasaw/baha(4)
 *   Apertium nominal: Root → PLURAL → POSSESSIVES → CASES → clitics
 */

export const SLOT_RANK = {
  verb: 0,
  case: 1,
  possessive: 2,
  plural: 3,
  derivation: 4,
  clitic: 0, // seplik/feyilden keyin (eń sırtqı); strip tártibinde verb menen teń
};

// role — segmenttiń grammatikalıq roli (qaraqalpaq latın; UI kerek bolsa kirillge awdaradı)
export const AFFIXES = [
  // ─────────────────────────── KÓPLIK (plural) ───────────────────────────
  {
    id: 'pl',
    slot: 'plural',
    role: 'kóplik',
    gloss: 'kóplik jalǵawı',
    forms: ['lar', 'ler', 'dar', 'der', 'tar', 'ter'],
    examples: ['kitap-lar', 'gúl-ler', 'qus-tar'],
  },

  // ─────────────────────────── TARTIM (possessive) ────────────────────────
  {
    id: 'poss1sg',
    slot: 'possessive',
    role: 'tartım (I jaq)',
    gloss: 'meniki',
    forms: ['ımız', 'imiz', 'umız', 'úmiz', 'mız', 'miz', 'ım', 'im', 'um', 'úm', 'm'],
    examples: ['kitab-ım', 'úy-im', 'til-imiz'],
  },
  {
    id: 'poss2',
    slot: 'possessive',
    role: 'tartım (II jaq)',
    gloss: 'seniki / siziki',
    // Apertium: {I}ń, {I}ń{I}z (frm), {I}ńl{A}r (pl), {I}ń{I}zl{A}r (frm pl)
    forms: [
      'ıńızlar', 'ińizler', 'ıńız', 'ińiz', 'uńız', 'úńiz',
      'ıńlar', 'ińler', 'ńız', 'ńiz',
      'ıń', 'iń', 'uń', 'úń', 'ń',
    ],
    examples: ['kitab-ıń', 'úy-iń', 'til-ińiz', 'bala-ńızlar'],
  },
  {
    id: 'poss3',
    slot: 'possessive',
    role: 'tartım (III jaq)',
    gloss: 'oniki',
    // Apertium px3sp: {s}{I}{n} → sı/si (+n before case), or bare {I}
    forms: ['ları', 'leri', 'sın', 'sin', 'sun', 'sún', 'sı', 'si', 'su', 'sú', 'ı', 'i', 'u', 'ú'],
    examples: ['kitab-ı', 'ata-sı', 'úy-i'],
  },

  // ─────────────────────────── SEPLIK (case) ──────────────────────────────
  {
    id: 'gen',
    slot: 'case',
    role: 'iyelik seplik',
    gloss: '-niń (kimniń/neniń)',
    forms: ['nıń', 'niń', 'dıń', 'diń', 'tıń', 'tiń'],
    examples: ['kitap-tıń', 'bala-nıń', 'gúl-diń'],
  },
  {
    id: 'dat',
    slot: 'case',
    role: 'barıs seplik',
    gloss: '-ǵa (kimge/qayaqqa)',
    forms: ['ǵa', 'ge', 'qa', 'ke', 'na', 'ne', 'a', 'e'],
    examples: ['kitap-qa', 'úy-ge', 'bala-ǵa'],
  },
  {
    id: 'acc',
    slot: 'case',
    role: 'tabıs seplik',
    gloss: '-nı (kimdi/nені)',
    forms: ['nı', 'ni', 'dı', 'di', 'tı', 'ti', 'n'],
    examples: ['kitap-tı', 'bala-nı', 'gúl-di'],
  },
  {
    id: 'loc',
    slot: 'case',
    role: 'jatıs seplik',
    gloss: '-da (qayerde)',
    forms: ['nda', 'nde', 'da', 'de', 'ta', 'te'],
    examples: ['kitap-ta', 'úy-de', 'bala-da'],
  },
  {
    id: 'abl',
    slot: 'case',
    role: 'shıǵıs seplik',
    gloss: '-dan (qayerden)',
    forms: ['nan', 'nen', 'dan', 'den', 'tan', 'ten'],
    examples: ['kitap-tan', 'úy-den', 'bala-dan'],
  },
  // Apertium CASES-COMMON: %<ins%> → {M}enen / {M}en
  {
    id: 'ins',
    slot: 'case',
    role: 'kómekshi seplik',
    gloss: '-menen (kim menen)',
    forms: ['menen', 'benen', 'penen', 'men', 'ben', 'pen'],
    examples: ['bala-menen', 'qol-men'],
  },
  // Similative (Apertium %<sim%> / -day) — kóbinese seplik ornında
  {
    id: 'sim',
    slot: 'case',
    role: 'uqsaslıq',
    gloss: '-day: sıyaqlı',
    forms: ['day', 'dey', 'tay', 'tey'],
    examples: ['bala-day', 'suw-day'],
  },

  // ───────────────── SÓZ JASAWSHI QOSIMTALAR (derivation) ──────────────────
  // Atawısh sózlerden atlıq jasawshı (PDF I-bap)
  {
    id: 'der-shi',
    slot: 'derivation',
    role: 'kásip iesi',
    gloss: '-shı: is/kásip iesi',
    forms: ['shı', 'shi'],
    examples: ['pada-shı', 'suw-shı', 'diyqan-shı'],
  },
  {
    id: 'der-las',
    slot: 'derivation',
    role: 'sheriklik',
    gloss: '-las: birge/sherik',
    forms: ['las', 'les', 'das', 'des', 'tas', 'tes'],
    examples: ['jol-das', 'qárın-das', 'sabaq-las'],
  },
  {
    id: 'der-shiliq',
    slot: 'derivation',
    role: 'abstrakt/jıynaqlaw',
    gloss: '-shılıq: abstrakt túsinik',
    forms: ['shılıq', 'shilik'],
    examples: ['diyqan-shılıq', 'kem-shilik', 'joq-shılıq'],
  },
  {
    id: 'der-liq',
    slot: 'derivation',
    role: 'qásiyet/abstrakt',
    gloss: '-lıq: qásiyet, ataw',
    forms: ['lıq', 'lik', 'lık', 'liq', 'dıq', 'dik', 'tıq', 'tik'],
    examples: ['bay-lıq', 'teń-lik', 'jaman-lıq'],
  },
  {
    id: 'der-xana',
    slot: 'derivation',
    role: 'orın atı',
    gloss: '-xana: arnalǵan orın',
    forms: ['xana', 'qana'],
    examples: ['mal-xana', 'shay-xana', 'awrıw-xana'],
  },
  {
    id: 'der-stan',
    slot: 'derivation',
    role: 'orın/ólke atı',
    gloss: '-stan: ólke, orın',
    forms: ['stan'],
    examples: ['Qaraqalpaq-stan', 'gúli-stan'],
  },
  {
    id: 'der-ger',
    slot: 'derivation',
    role: 'kásip iesi',
    gloss: '-ger/-ker: kásip penen shuǵıllanıwshı',
    forms: ['ger', 'ker', 'gar', 'kar'],
    examples: ['sawda-ger', 'pal-ker', 'zer-ger'],
  },
  {
    id: 'der-kesh',
    slot: 'derivation',
    role: 'kásip iesi',
    gloss: '-kesh: kásipke baylanıslı adam',
    forms: ['kesh'],
    examples: ['arba-kesh', 'miynet-kesh'],
  },
  {
    id: 'der-man',
    slot: 'derivation',
    role: 'kásip iesi',
    gloss: '-man/-ban: kásip iesi',
    forms: ['man', 'ban', 'pan'],
    examples: ['baǵ-man', 'qoraz-ban'],
  },
  {
    id: 'der-zar',
    slot: 'derivation',
    role: 'ósimlik orını',
    gloss: '-zar: ósetuǵın orın',
    forms: ['zar'],
    examples: ['gúl-zar', 'kóklem-zar'],
  },
  {
    id: 'der-nama',
    slot: 'derivation',
    role: 'hújjet atı',
    gloss: '-nama: hújjet, jazba',
    forms: ['nama'],
    examples: ['shárt-nama', 'jıl-nama', 'ádep-nama'],
  },
  {
    id: 'der-zada',
    slot: 'derivation',
    role: 'shıǵıw/tegi',
    gloss: '-zada/-zat: adam, teg',
    forms: ['zada', 'zat'],
    examples: ['beg-zada', 'adam-zat', 'shax-zada'],
  },
  // Feyilden atlıq jasawshı (PDF I-bap)
  {
    id: 'der-ma',
    slot: 'derivation',
    role: 'feyilden atlıq',
    gloss: '-ma: háreket nátiyjesi/buyım',
    forms: ['ma', 'me', 'ba', 'be', 'pa', 'pe'],
    examples: ['bas-ma', 'tapsır-ma', 'kórset-pe'],
  },
  {
    id: 'der-maq',
    slot: 'derivation',
    role: 'feyilden atlıq',
    gloss: '-maq: qural/awqat/oyın atı',
    forms: ['maq', 'mek', 'baq', 'bek', 'paq', 'pek'],
    examples: ['oy-maq', 'quy-maq', 'jum-baq'],
  },
  {
    id: 'der-iw',
    slot: 'derivation',
    role: 'atawısh feyil',
    gloss: '-ıw: is-háreket atı',
    forms: ['ıw', 'iw', 'uw', 'úw'],
    examples: ['oq-ıw', 'jaz-ıw', 'kel-iw'],
  },
  {
    id: 'der-ish',
    slot: 'derivation',
    role: 'feyilden atlıq',
    gloss: '-ısh: háreket/hal atı',
    forms: ['ısh', 'ish', 'ush', 'úsh'],
    examples: ['ókin-ish', 'sez-ish', 'quwan-ısh'],
  },
  {
    id: 'der-im',
    slot: 'derivation',
    role: 'feyilden atlıq',
    gloss: '-ım: háreket nátiyjesi',
    forms: ['ım', 'im', 'um', 'úm'],
    examples: ['bil-im', 'ól-im', 'keshir-im'],
  },
  {
    id: 'der-in',
    slot: 'derivation',
    role: 'feyilden atlıq',
    gloss: '-ın: zat/nátiyje atı',
    forms: ['ın', 'in', 'un', 'ún'],
    examples: ['eg-in', 'ót-in'],
  },
  {
    id: 'der-qish',
    slot: 'derivation',
    role: 'ásbap atı',
    gloss: '-ǵısh/-qısh: qural, ásbap',
    forms: ['ǵısh', 'gish', 'qısh', 'kish', 'ǵısh'],
    examples: ['súz-gi', 'tut-qısh', 'juw-ǵısh'],
  },
  // Subъektiv baha / kishireytiw formaları (PDF I-bap)
  {
    id: 'dim-sha',
    slot: 'derivation',
    role: 'kishireytiw',
    gloss: '-sha: kishireytiw',
    forms: ['sha', 'she'],
    examples: ['kitap-sha', 'qálem-she', 'bel-she'],
  },
  {
    id: 'dim-shiq',
    slot: 'derivation',
    role: 'kishireytiw',
    gloss: '-shıq: kishireytiw',
    forms: ['shıq', 'shik'],
    examples: ['oyın-shıq', 'tóbe-shik'],
  },
  {
    id: 'dim-shaq',
    slot: 'derivation',
    role: 'kishireytiw/erkelew',
    gloss: '-shaq: erkelew',
    forms: ['shaq', 'shek'],
    examples: ['kelin-shek', 'tayın-shaq'],
  },
  {
    id: 'dim-alaq',
    slot: 'derivation',
    role: 'kishireytiw',
    gloss: '-alaq: kishireytiw',
    forms: ['alaq', 'elek'],
    examples: ['qız-alaq', 'quma-laq'],
  },
  {
    id: 'dim-laq',
    slot: 'derivation',
    role: 'kishireytiw',
    gloss: '-laq: kishireytiw',
    forms: ['laq', 'lek'],
    examples: ['bota-laq', 'tay-laq'],
  },

  // ───────────────────── FEYIL JALǴAWLARI (verb) — Apertium V-* ───────────
  {
    id: 'v-neg',
    slot: 'verb',
    role: 'bolımsız',
    gloss: '-ma: bolımsız feyil',
    forms: ['ma', 'me', 'pa', 'pe', 'ba', 'be'],
    examples: ['kel-me', 'bar-ma'],
  },
  {
    id: 'v-tense-past',
    slot: 'verb',
    role: 'ótken máhál',
    gloss: '-dı: ótken máhál (ifi)',
    forms: ['dı', 'di', 'tı', 'ti'],
    examples: ['kel-di', 'bar-dı', 'ket-ti'],
  },
  {
    id: 'v-part-gan',
    slot: 'verb',
    role: 'ótken zaman kelbetlik feyili',
    gloss: '-ǵan: past (gpr/ger)',
    forms: ['ǵan', 'gen', 'qan', 'ken'],
    examples: ['kel-gen', 'bar-ǵan', 'ket-ken'],
  },
  {
    id: 'v-pres',
    slot: 'verb',
    role: 'házirgi/awısıq máhál',
    gloss: '-adı: aorist ({E})',
    forms: ['adı', 'edi', 'ydı', 'ydi', 'aydı', 'eydi'],
    examples: ['bar-adı', 'kel-edi', 'oqı-ydı'],
  },
  {
    id: 'v-conv',
    slot: 'verb',
    role: 'hal feyil',
    gloss: '-ıp: gna_perf / ifi_evid',
    forms: ['ıp', 'ip', 'up', 'úp'],
    examples: ['kel-ip', 'bar-ıp'],
  },
  {
    id: 'v-fut',
    slot: 'verb',
    role: 'kelesi máhál/maqsat',
    gloss: '-atuǵın: gpr_impf',
    forms: ['atuǵın', 'etuǵın', 'ytuǵın', 'atuğın', 'etuğın'],
    examples: ['bar-atuǵın', 'kel-etuǵın'],
  },
  {
    id: 'v-fut-ar',
    slot: 'verb',
    role: 'kelesi máhál',
    gloss: '-ar: future verbal adjective',
    // Qısqa -ar/-er óte qáwipsiz — tek 2+ hárip qosımta (ar/er) sózlik rejiminde
    forms: ['ar', 'er'],
    examples: ['bar-ar', 'kel-er'],
  },
  {
    id: 'v-fut-plan',
    slot: 'verb',
    role: 'niyet/maqsat',
    gloss: '-maq: fut_plan',
    forms: ['maqshi', 'mekshi', 'maq', 'mek'],
    examples: ['bar-maq', 'kel-mek'],
  },
  {
    id: 'v-cond',
    slot: 'verb',
    role: 'shárt máhál',
    gloss: '-sa: gna_cond',
    forms: ['sa', 'se'],
    examples: ['bar-sa', 'kel-se'],
  },
  // Apertium V-DER / voice
  {
    id: 'v-pass',
    slot: 'verb',
    role: 'passiv',
    gloss: '-ıl: pass',
    forms: ['ıl', 'il', 'ul', 'úl'],
    examples: ['jaz-ıl', 'kór-il'],
  },
  {
    id: 'v-caus',
    slot: 'verb',
    role: 'sebepshilik',
    gloss: '-dır/-t: caus',
    // -ız/-iz óte qáwipsiz (suw-sız → suws+ız); tek -dır/-tir usı inventarda
    forms: ['dır', 'dir', 'tır', 'tir'],
    examples: ['jaz-dır', 'kel-tir'],
  },
  {
    id: 'v-coop',
    slot: 'verb',
    role: 'birgelikte',
    gloss: '-ıs: coop',
    forms: ['ıs', 'is', 'us', 'ús'],
    examples: ['jaz-ıs', 'kel-is'],
  },
  {
    id: 'v-opt',
    slot: 'verb',
    role: 'tilek/buyrıq',
    gloss: '-ayın/-sın: opt',
    forms: ['ayın', 'eyin', 'ayıq', 'eyik', 'sın', 'sin'],
    examples: ['bar-ayın', 'kel-sin'],
  },
  {
    id: 'v-imp-pl',
    slot: 'verb',
    role: 'buyrıq (kóplik)',
    gloss: '-ıńlar: imp p2 pl',
    forms: ['ıńızlar', 'ińizler', 'ıńlar', 'ińler'],
    examples: ['bar-ıńlar', 'kel-ińler'],
  },
  // Apertium ABESSIVE / LI postpositions
  {
    id: 'post-siz',
    slot: 'derivation',
    role: 'josızlıq',
    gloss: '-sız: abessive',
    forms: ['sız', 'siz'],
    examples: ['suw-sız', 'bas-sız'],
  },
  {
    id: 'post-li',
    slot: 'derivation',
    role: 'barlılıq',
    gloss: '-lı: li-postposition',
    // Tek {l}{I} — {D}{I} variantları seplik/feyil penen qataǵıspaq (tı/di)
    forms: ['lı', 'li'],
    examples: ['suw-lı', 'kúsh-li'],
  },
  {
    id: 'adj-comp',
    slot: 'derivation',
    role: 'salıstırma',
    gloss: '-ıraq: comparative',
    forms: ['ıraq', 'irek', 'uraq', 'úrek'],
    examples: ['úlken-irek', 'jaqsı-raq'],
  },
  // Soraw shılaýı (CLIT-QST-MA) — feyil sońında; inventarda v-neg menen birdey forma
  {
    id: 'clit-qst',
    slot: 'clitic',
    role: 'soraw shılaýı',
    gloss: '-ma: soraw',
    forms: ['ma', 'me'],
    examples: ['baradı-ma', 'keldi-me'],
  },
];

// Barlıq unlılar (residuе'de unlı bar-joqlıǵın tekseriw ushın)
export const VOWELS = new Set(['a', 'á', 'e', 'i', 'ı', 'o', 'ó', 'u', 'ú']);

export default { AFFIXES, SLOT_RANK, VOWELS };
