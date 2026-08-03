import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectScript,
  normalizeApostropheLatin,
  normalizeSource,
  toCyrillic,
  toLatin,
  stripHtmlToPlain,
  slugifyWriterName,
  parseLifeSpan,
  parseBirthFacts,
  parseBioTimeline,
  parsePoemTrailingMeta,
  ensureScriptPair,
} from '../src/utils/qqScript.js';

test('toLatin never leaks Cyrillic from mixed mostly-Latin text', () => {
  const mixed = toLatin('Qaraqalpaq ádebiyatı Ж');
  assert.equal(detectScript(mixed), 'latin');
  assert.equal(mixed.includes('Ж'), false);
  assert.match(mixed, /J/);
});

test('ensureScriptPair latin side has no Cyrillic residues', () => {
  const pair = ensureScriptPair('Qaraqalpaq ádebiyatı Ж');
  assert.equal(detectScript(pair.latin), 'latin');
  assert.equal(/[А-Яа-яӘәӨөҮүҚқҒғҢңЎўҲҳ]/.test(pair.latin), false);
});

test('normalizeSource maps mixed schwa and newlines', () => {
  assert.equal(normalizeSource('Əli\r\nəli'), 'Әli\nәli');
});

test('normalizeApostropheLatin converts g\'/n\'/o\' style', () => {
  assert.equal(normalizeApostropheLatin("gu'z"), 'gúz');
  assert.equal(normalizeApostropheLatin("tan'lamali"), 'tańlamali');
  assert.equal(normalizeApostropheLatin("g'alaba"), 'ǵalaba');
});

test('ensureScriptPair returns both scripts', () => {
  const a = ensureScriptPair('Қарақалпақ');
  assert.equal(a.sourceScript, 'cyrillic');
  assert.match(a.latin, /Qaraqalpaq/i);
  const b = ensureScriptPair("Tańlamalı");
  assert.equal(b.sourceScript, 'latin');
  assert.ok(b.cyrillic.length > 0);
});

test('parsePoemTrailingMeta peels year/place footer', () => {
  const { paragraphs, meta } = parsePoemTrailingMeta([
    'Достым, бүгин мени араңа қоспаң,\nБүгин зыяпаттан қашқан досыңман.',
    '1971-жыл, Нөкис',
  ]);
  assert.equal(paragraphs.length, 1);
  assert.equal(meta.workYear, 1971);
  assert.ok(meta.workDateLabelCyrillic || meta.workPlaceCyrillic);
});

test('parsePoemTrailingMeta preserves a short final poem line', () => {
  const source = ['Биринши шуўмақ.', 'Арманлар'];
  const { paragraphs, meta } = parsePoemTrailingMeta(source);
  assert.deepEqual(paragraphs, source);
  assert.equal(meta.workYear, null);
  assert.equal(meta.workPlaceCyrillic, null);
});

test('parsePoemTrailingMeta peels separate date and place in either order', () => {
  const placeThenDate = parsePoemTrailingMeta(['Қосық мәтни.', 'Нөкис', '1971-жыл']);
  assert.deepEqual(placeThenDate.paragraphs, ['Қосық мәтни.']);
  assert.equal(placeThenDate.meta.workYear, 1971);
  assert.equal(placeThenDate.meta.workPlaceCyrillic, 'Нөкис');

  const dateThenPlace = parsePoemTrailingMeta(['Қосық мәтни.', '1971-жыл', 'Нөкис']);
  assert.deepEqual(dateThenPlace.paragraphs, ['Қосық мәтни.']);
  assert.equal(dateThenPlace.meta.workYear, 1971);
  assert.equal(dateThenPlace.meta.workPlaceCyrillic, 'Нөкис');
});

test('parsePoemTrailingMeta never treats month fragments as place', () => {
  const withDayMonth = parsePoemTrailingMeta(['Қосық мәтни.', '14-июль, 1971-жыл']);
  assert.equal(withDayMonth.meta.workYear, 1971);
  assert.equal(withDayMonth.meta.workPlaceCyrillic, null);
  assert.match(withDayMonth.meta.workDateLabelCyrillic || '', /14-июль/i);

  const monthOnLastLine = parsePoemTrailingMeta(['Қосық мәтни.', "1987-жыл\nФеврал'"]);
  assert.equal(monthOnLastLine.meta.workYear, 1987);
  assert.equal(monthOnLastLine.meta.workPlaceCyrillic, null);
  assert.match(monthOnLastLine.meta.workDateLabelCyrillic || '', /Феврал/i);
});

test('parsePoemTrailingMeta splits combined day/year/place footer', () => {
  const { meta } = parsePoemTrailingMeta([
    'Qosıq mátni.',
    '18-iyun, 1992jıl. Biysen awıl.',
  ]);
  assert.equal(meta.workYear, 1992);
  assert.match(meta.workDateLabelLatin || '', /18-iyun/);
  assert.match(meta.workPlaceLatin || '', /Biysen/);
  assert.doesNotMatch(meta.workPlaceLatin || '', /iyun|\d/);
});

test('detectScript distinguishes cyrillic, latin, mixed', () => {
  assert.equal(detectScript('Қарақалпақ'), 'cyrillic');
  assert.equal(detectScript('Qaraqalpaq'), 'latin');
  assert.equal(detectScript('Қара Qara'), 'mixed');
  assert.equal(detectScript('123 — !?'), 'unknown');
  assert.equal(detectScript(''), 'unknown');
  assert.equal(detectScript(null), 'unknown');
});

test('stripHtmlToPlain removes tags safely', () => {
  const plain = stripHtmlToPlain('<br>  Сағыйдулла <b>Аббазов</b> — шайыр.  <br>  Екинши.');
  assert.equal(plain.includes('<'), false);
  assert.ok(plain.includes('Сағыйдулла Аббазов'));
  assert.ok(plain.includes('\n\n'));
});

test('slugifyWriterName produces stable latin slug', () => {
  const slug = slugifyWriterName('Юсупов Ибрайым');
  assert.match(slug, /^[a-z0-9-]+$/);
  assert.ok(slug.length > 3);
  assert.equal(slugifyWriterName('Юсупов Ибрайым'), slug);
});

test('parseBirthFacts extracts day month year and place', () => {
  const bio =
    'Юсупов Ибрайым 1930-жылы 5-майда Тахтакөпир районында туўылған. Шайыр.';
  const facts = parseBirthFacts(bio, '1930-2008');
  assert.equal(facts.birthYear, 1930);
  assert.equal(facts.birthMonth, 5);
  assert.equal(facts.birthDay, 5);
  assert.equal(facts.birthPrecision, 'day');
  assert.equal(facts.birthDate, '1930-05-05');
  assert.match(facts.birthplaceOriginal || '', /Тахтакөпир/i);
  assert.equal(facts.deathYear, 2008);
});

test('parseBirthFacts latin biography', () => {
  const bio = 'Ibrayım Yusupov 1930-jıl 5-mayda Taxtakópir rayonında tuwılǵan.';
  const facts = parseBirthFacts(bio, '');
  assert.equal(facts.birthYear, 1930);
  assert.equal(facts.birthMonth, 5);
  assert.equal(facts.birthDay, 5);
  assert.ok(facts.birthplaceOriginal);
});

test('parseBioTimeline extracts events, works and memberships', () => {
  const bio = [
    'М. Дәрибаев 1909-жылы Қоңырат районында туўылған.',
    'Ол 1929-жылы педагогикалық курсты питкерип, өз аўылында муғаллим болып ислейди.',
    '1935-жылы Ташкенттеги Орта Азия аўыл хожалық мектебин питкереди, соң "Қызыл Қарақалпақстан" газетасында мәденият бөлимин басқарады.',
    'Жазыўшылар аўқамына 1938-жылы ағза болды.',
    'Жазыўшы 1942-жылы самолёт апатынан мезгилсиз қайтыс болды.',
    'Оның «Қосықлар» (1930), «Жеңилмегенлер» (1940), «Гүреске» (1942) деген топламлары басылып шықты.',
  ].join(' ');

  const { events, works } = parseBioTimeline(bio);

  // Works with years
  assert.ok(works.some((w) => w.title === 'Қосықлар' && w.year === 1930));
  assert.ok(works.some((w) => w.title === 'Жеңилмегенлер' && w.year === 1940));
  assert.equal(works.length, 3);

  // Event kinds
  const kindOf = (year) => events.find((e) => e.year === year)?.kind;
  assert.equal(kindOf(1909), 'birth');
  assert.equal(kindOf(1929), 'education');
  assert.equal(kindOf(1935), 'education');
  assert.equal(kindOf(1938), 'membership');
  assert.ok(events.some((e) => e.year === 1942 && e.kind === 'death'));

  // Sorted by year
  const years = events.map((e) => e.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
});

test('parseBioTimeline splits birth and death in one sentence', () => {
  const bio = 'Шайыр 1832-жылы туўылып, 1897-жылы қайтыс болған.';
  const { events } = parseBioTimeline(bio);
  assert.equal(events.length, 2);
  assert.equal(events[0].year, 1832);
  assert.equal(events[0].kind, 'birth');
  assert.equal(events[1].year, 1897);
  assert.equal(events[1].kind, 'death');
});

test('parseBioTimeline empty bio returns empty result', () => {
  assert.deepEqual(parseBioTimeline(''), { events: [], works: [] });
  assert.deepEqual(parseBioTimeline('Шайыр ҳәм жазыўшы.'), { events: [], works: [] });
});

test('parseBirthFacts year-only fallback from lifeSpan', () => {
  const facts = parseBirthFacts('Шайыр болған.', '1920-1980');
  assert.equal(facts.birthYear, 1920);
  assert.equal(facts.deathYear, 1980);
  assert.equal(facts.birthPrecision, 'year');
  assert.equal(facts.birthDay, null);
});

describe('qqScript.toLatin', () => {
  it('kirill -> latın tiykarǵı háripler', () => {
    assert.equal(toLatin('Жақсы сөз'), 'Jaqsı sóz');
    assert.equal(toLatin('Қарақалпақстан'), 'Qaraqalpaqstan');
    assert.equal(toLatin('Күнхожа'), 'Kúnxoja');
    assert.equal(toLatin('Аўыл хожалығы'), 'Awıl xojalıǵı');
  });

  it('digraflar hám registr', () => {
    assert.equal(toLatin('Шайыр'), 'Shayır');
    assert.equal(toLatin('яр'), 'yar');
    assert.equal(toLatin('Юсупов'), 'Yusupov');
  });

  it('lossy jaǵdaylar best-effort', () => {
    assert.equal(toLatin('дүнья'), 'dúnya'); // ь túsip qaladı
  });

  it('punktuatsiya hám qatar boluwları saqlanadı', () => {
    const src = 'Бир, еки — үш!\nТөрт? (Бес)\n\nАлты...';
    const lat = toLatin(src);
    assert.equal(lat, 'Bir, eki — úsh!\nTórt? (Bes)\n\nAltı...');
    assert.equal((lat.match(/\n/g) || []).length, (src.match(/\n/g) || []).length);
  });
});

describe('qqScript.toCyrillic', () => {
  it('latın -> kirill tiykarǵı háripler', () => {
    assert.equal(toCyrillic('Jaqsı sóz'), 'Жақсы сөз');
    assert.equal(toCyrillic('Júrgen jeri mereke'), 'Жүрген жери мереке');
    assert.equal(toCyrillic('Adamnıń janı'), 'Адамның жаны');
  });

  it('digraflar registrge qaramastan tanıladı', () => {
    assert.equal(toCyrillic('Shayır'), 'Шайыр');
    assert.equal(toCyrillic('chaqa'), 'чақа');
    assert.equal(toCyrillic('yar'), 'яр');
  });

  it('kirill háripler ózgerissiz qaladı (aralas tekst qáwipsiz)', () => {
    assert.equal(toCyrillic('Жақсы hám jaman'), 'Жақсы ҳәм жаман');
  });
});

describe('qqScript round-trip', () => {
  const cyrSamples = [
    'Жақсы сөз – жан азығы.',
    'Қарақалпақстан Республикасы',
    'Аўыл хожалығы хызметкерлери',
    'Күнхожа, Бердақ ҳәм Әжинияз',
    'Тыңла мени, қуштарым!',
    'Бәҳәр келди және айланып.',
    'Ығбалың шым қара еди.',
  ];

  for (const s of cyrSamples) {
    it(`kirill -> latın -> kirill: ${s.slice(0, 24)}...`, () => {
      assert.equal(toCyrillic(toLatin(s)), s);
    });
  }

  const latSamples = [
    'Júrgen jeri mereke',
    'Qızıl altınǵa bermes jumbaq.',
    'Adamnıń janı',
    'Ashılmaǵan urada,\nPishilmegen ton jatır.',
    'Tólepbergen Qayıpbergenov',
  ];

  for (const s of latSamples) {
    it(`latın -> kirill -> latın: ${s.slice(0, 24)}...`, () => {
      assert.equal(toLatin(toCyrillic(s)), s);
    });
  }

  it('kóp qatarlı qosıq round-trip (qatar sanı saqlanadı)', () => {
    const stanza = 'Тағы бизиң еллерге,\nАлтын жаз келди.\nҚашшан ғаз келди!';
    assert.equal(toCyrillic(toLatin(stanza)), stanza);
  });

  it('jazıwshı atları round-trip', () => {
    const sample = 'Әжинияз Қосыбай улы — шайыр.';
    const latin = toLatin(sample);
    assert.match(latin, /Ájiniyaz/i);
    assert.match(latin, /shayı/i);
    assert.equal(toCyrillic(latin), sample);
  });

  it('hújjetlengen lossy jaǵday: йа -> я (orfografiyalıq forma)', () => {
    assert.equal(toCyrillic(toLatin('дәрйа')), 'дәря');
  });
});
