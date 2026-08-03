import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const antonyms = [
  ['ЖАҚСЫ', 'ЖАМАН'],
  ['ҮЛКЕН', 'КИШИ'],
  ['УЗЫН', 'ҚЫСҚА'],
  ['БИЙИК', 'ПӘС'],
  ['КӨП', 'АЗ'],
  ['ТЕЗ', 'ӘСТЕ'],
  ['ЫССЫ', 'СУЎЫҚ'],
  ['ЖАҢА', 'ЕСКИ'],
  ['АҚ', 'ҚАРА'],
  ['КҮН', 'ТҮН'],
  ['БАР', 'ЖОҚ'],
  ['АЛДЫ', 'АРТЫ'],
  ['АУЫР', 'ЖЕҢИЛ'],
  ['БАЙ', 'ЖАРЛЫ'],
  ['ТАЗА', 'ПАТАС'],
  ['ҚАТТЫ', 'ЖУМСАҚ'],
  ['КЕҢ', 'ТАР'],
  ['ТЕРЕҢ', 'САЯЗ'],
  ['ЕРТЕ', 'КЕШ'],
  ['ТИРИ', 'ӨЛИ'],
];

const synonyms = [
  ['ЖАҚСЫ', 'ТӘЎИР'],
  ['ЖАМАН', 'НАШАР'],
  ['ҮЛКЕН', 'ИРИ'],
  ['КИШИ', 'КИШКЕНЕ'],
  ['ТЕЗ', 'ЖЫЛДАМ'],
  ['ӘДЕМИ', 'СУЛЫЎ'],
  ['ДОС', 'ЖОРА'],
  ['ҚУЎАНЫШ', 'ШОДЛЫҚ'],
  ['АШЫЎ', 'ҒӘЗЕП'],
  ['БАТЫР', 'ҚАҲАРМАН'],
  ['АҚЫЛЛЫ', 'ДАНА'],
  ['МӘРТ', 'БАТЫР'],
  ['ҚОРҚЫЎ', 'СЕС КЕНИЎ'],
  ['СӨЙЛЕЎ', 'АЙТЫЎ'],
  ['КӨМЕК', 'ЖӘРДЕМ'],
];

async function resolve(word) {
  const [exact] = await db.query(
    `SELECT id, soz
     FROM titles
     WHERE status = 1 AND soz = ?
     ORDER BY \`order\`
     LIMIT 1`,
    [word]
  );
  if (exact[0]) return exact[0];

  const [homonym] = await db.query(
    `SELECT id, soz
     FROM titles
     WHERE status = 1
       AND soz REGEXP CONCAT('^', ?, '[[:space:]](I|II|III|IV|V|VI|VII|VIII|І|ІІ|ІІІ)$')
     ORDER BY \`order\`
     LIMIT 1`,
    [word]
  );
  return homonym[0] || null;
}

for (const [type, pairs] of [
  ['antonym', antonyms],
  ['synonym', synonyms],
]) {
  console.log(`\n=== ${type.toUpperCase()} ===`);
  for (const [left, right] of pairs) {
    const [a, b] = await Promise.all([resolve(left), resolve(right)]);
    console.log(
      `${a ? '✓' : '×'} ${left}${a ? ` => ${a.soz}` : ''}  ↔  ` +
        `${b ? '✓' : '×'} ${right}${b ? ` => ${b.soz}` : ''}`
    );
  }
}

await db.end();
