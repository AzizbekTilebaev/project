/**
 * So'z turkumlari (POS) va avtomatik mavzular — faqat server whitelist.
 * Theme categorys_id ni o'zgartirmaydi; read-only kalit so'z qoidalari.
 */

export const POS_LIST = [
  { slug: 'at', label: 'Atlıq', match: ['ат.', 'атлық'], like: ['ат.%', 'атлық%'] },
  { slug: 'f', label: 'Feyil', match: ['ф.', 'фейил'], like: ['ф.%', 'фейил%'] },
  { slug: 'kel', label: 'Kelbetlik', match: ['кел.', 'келбетлик'], like: ['кел.%', 'келбетлик%'] },
  { slug: 'san', label: 'Sanlıq', match: ['сан.', 'санлық'], like: ['сан.%', 'санлық%'] },
  { slug: 'r', label: 'Ráwish', match: ['р.', 'рәўиш', 'рәуіш'], like: ['р.%', 'рәўиш%', 'рәуіш%'] },
  { slug: 'forma', label: 'Grammatikalıq forma', match: ['грамм. форма'], like: ['грамм. форма%'] },
  { slug: 'belgisiz', label: 'Belgisiz', match: ['белгисиз'], like: ['белгисиз%'], nullCategory: true },
];

export const THEME_LIST = [
  {
    slug: 'tabiat',
    label: 'Tábiyat',
    blurb: 'Ósimlik, haywan, jer-suw',
    // category abbrev + description keywords
    categoryLikes: ['%бот.%', '%зоол.%', '%геогр.%', '%астр.%'],
    textLikes: [
      '%өсимлик%', '%шөп%', '%ағаш%', '%хайўан%', '%қуслар%', '%қуш%',
      '%суў%', '%таў%', '%тоғай%', '%дала%', '%жер%', '%көл%', '%теңиз%',
    ],
  },
  {
    slug: 'odam',
    label: 'Adam / tana',
    blurb: 'Dene, sezim, insan',
    categoryLikes: ['%анат.%', '%мед.%', '%физиол.%'],
    textLikes: [
      '%бас%', '%көз%', '%қол%', '%аяқ%', '%жүрек%', '%дене%', '%адам%',
      '%киси%', '%бала%', '%ана%', '%ата%', '%тұқым%',
    ],
  },
  {
    slug: 'jamiyat',
    label: 'Jámiyet',
    blurb: 'Turmısh, qatnas, urıp-ádet',
    categoryLikes: ['%этногр.%', '%соц.%', '%юрид.%'],
    textLikes: [
      '%үй%', '%ауыл%', '%халық%', '%той%', '%дост%', '%дуспан%',
      '%мәмлекет%', '%заң%', '%үрп%', '%әдет%', '%жұмыс%',
    ],
  },
  {
    slug: 'madaniyat',
    label: 'Mádeniyat',
    blurb: 'Ádebiyat, kórkem, til',
    categoryLikes: ['%лит.%', '%муз.%', '%иск.%'],
    textLikes: [
      '%өлең%', '%шығарма%', '%кітап%', '%ән%', '%музыка%', '%би%',
      '%тіл%', '%сөз%', '%шайыр%', '%жазуўшы%', '%театр%',
    ],
  },
  {
    slug: 'ilm',
    label: 'Ilm / texnika',
    blurb: 'Pán, texnika, san',
    categoryLikes: ['%тех.%', '%физ.%', '%хим.%', '%мат.%', '%биол.%'],
    textLikes: [
      '%машина%', '%құрал%', '%наука%', '%ғылым%', '%техника%',
      '%сан%', '%өлшем%', '%энергия%', '%электри%',
    ],
  },
  {
    slug: 'kasb',
    label: 'Kásip-óner',
    blurb: 'Kásipler hám óner',
    categoryLikes: ['%проф.%'],
    textLikes: [
      '%уста%', '%дихан%', '%балықшы%', '%саўгер%', '%мұғаллим%',
      '%доктор%', '%дәрігер%', '%қойшы%', '%малшы%', '%кәсіп%',
    ],
  },
];

export function getPosBySlug(slug) {
  return POS_LIST.find((p) => p.slug === slug) || null;
}

export function getThemeBySlug(slug) {
  return THEME_LIST.find((t) => t.slug === slug) || null;
}
