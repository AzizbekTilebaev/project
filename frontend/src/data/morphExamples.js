/**
 * Túbir + qosımta oqıtıw úlgileri (fordata/grammar/úlgi-10-sóz.md).
 * Oqıwshı UI — ishki fayl atları joq.
 */
export const MORPH_EXAMPLES = [
  {
    word: 'kitaplardıń',
    parts: ['kitap', 'lar', 'dıń'],
    root: 'kitap',
    affixes: [
      { form: '-lar', role: 'kóplik' },
      { form: '-dıń', role: 'iyelik seplik' },
    ],
    rule: 'Atlıq kóplik + seplik jalǵawı. Túbir — tiykarǵı máni.',
    level: '3–4 klass',
  },
  {
    word: 'awıldan',
    parts: ['awıl', 'dan'],
    root: 'awıl',
    affixes: [{ form: '-dan', role: 'shıǵıs seplik (qayerden?)' }],
    rule: 'Seplik jalǵawı túbirge qosıladı; túbir saqlanadı.',
    level: '4–6 klass',
  },
  {
    word: 'balıqshı',
    parts: ['balıq', 'shı'],
    root: 'balıq',
    affixes: [{ form: '-shı', role: 'sóz jasawshı — kásip / is iesi' }],
    rule: 'Túbir + jasawshı qosımta → dórendi sóz.',
    level: '3–4 klass',
  },
  {
    word: 'mektepte',
    parts: ['mektep', 'te'],
    root: 'mektep',
    affixes: [{ form: '-te', role: 'jatıs seplik (qayerde?)' }],
    rule: 'Jatıs seplik; únleslik boyınsha `-da/-de/-ta/-te`.',
    level: '1–6 klass',
  },
  {
    word: 'basshı',
    parts: ['bas', 'shı'],
    root: 'bas',
    affixes: [{ form: '-shı', role: 'jasawshı' }],
    rule: 'Túbirles qatar: bas → basshı, baslıq, baslama…',
    level: '4 klass',
  },
  {
    word: 'oqıwshılar',
    parts: ['oqıw', 'shı', 'lar'],
    root: 'oqıw',
    affixes: [
      { form: '-shı', role: 'jasawshı' },
      { form: '-lar', role: 'kóplik' },
    ],
    rule: 'Dáslep jasawshı, keyin kóplik (sırtqa qaray).',
    level: '3–4 klass',
  },
  {
    word: 'gáplerdiń',
    parts: ['gáp', 'ler', 'diń'],
    root: 'gáp',
    affixes: [
      { form: '-ler', role: 'kóplik (jińishke)' },
      { form: '-diń', role: 'iyelik' },
    ],
    rule: 'Jińishke túbir → `-ler` / `-diń` (únleslik).',
    level: '5–6 klass',
  },
  {
    word: 'kitabımızda',
    parts: ['kitab', 'ımız', 'da'],
    root: 'kitab',
    lemma: 'kitap',
    affixes: [
      { form: '-ımız', role: 'tartım (I jaq kóplik)' },
      { form: '-da', role: 'jatıs' },
    ],
    rule: 'Tartım + seplik; geyde túbir aqırı ózgeredi (kitap → kitab-).',
    level: '4–6 klass',
  },
  {
    word: 'jasaǵan',
    parts: ['jasa', 'ǵan'],
    root: 'jasa',
    affixes: [{ form: '-ǵan', role: 'ótken zaman kelbetlik feyili' }],
    rule: 'Feyil + kelbetlik / máhál qosımtaları.',
    level: '5–6 klass',
  },
  {
    word: 'túsiriń',
    parts: ['túsir', 'iń'],
    root: 'túsir',
    affixes: [{ form: '-iń', role: 'II jaq (buyrıq yamasa tartım)' }],
    rule: 'Kontekstte kóbinese buyrıq: Este túsiriń!',
    note: 'Motor geyde tartım dep belgilenedi — kontekstke qarań.',
    level: '4–5 klass',
  },
];
