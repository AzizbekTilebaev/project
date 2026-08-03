import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const pairs = [
  { type: 'antonym', left: 'КЕЛИЎ', right: 'КЕТИЎ', note: 'qarama-qarshi baǵıt' },
  { type: 'antonym', left: 'КӨТЕРИЎ', right: 'ТҮСИРИЎ', note: 'joqarılatıw / tómenletiw' },
  { type: 'synonym', left: 'ҚЫЙНАЛЫЎ', right: 'АЗАПЛАНЫЎ', note: 'azap shegiw' },
];

await db.query(`
  CREATE TABLE IF NOT EXISTS word_relations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source_title_id VARCHAR(64) NOT NULL,
    target_title_id VARCHAR(64) NOT NULL,
    relation_type ENUM('synonym', 'antonym') NOT NULL,
    note VARCHAR(255) NULL,
    source_kind ENUM('verified', 'manual', 'imported') NOT NULL DEFAULT 'verified',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_word_relation (source_title_id, target_title_id, relation_type),
    KEY idx_relation_source (source_title_id, relation_type),
    KEY idx_relation_target (target_title_id, relation_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

async function resolve(word) {
  const [rows] = await db.query(
    `SELECT id, soz
     FROM titles
     WHERE status = 1 AND soz = ?
     ORDER BY \`order\`
     LIMIT 1`,
    [word]
  );
  return rows[0] || null;
}

let added = 0;
for (const pair of pairs) {
  const [left, right] = await Promise.all([resolve(pair.left), resolve(pair.right)]);
  if (!left || !right) {
    console.log(`O‘TKAZILDI: ${pair.left} ↔ ${pair.right} (so‘z topilmadi)`);
    continue;
  }

  // Bir juftlik bitta qator: id larni barqaror tartibda saqlaymiz.
  const [source, target] =
    String(left.id).localeCompare(String(right.id)) <= 0 ? [left, right] : [right, left];
  const [result] = await db.query(
    `INSERT IGNORE INTO word_relations
       (source_title_id, target_title_id, relation_type, note, source_kind)
     VALUES (?, ?, ?, ?, 'verified')`,
    [source.id, target.id, pair.type, pair.note]
  );
  added += result.affectedRows;
  console.log(
    `${result.affectedRows ? 'QO‘SHILDI' : 'MAVJUD'}: ${left.soz} ↔ ${right.soz} (${pair.type})`
  );
}

const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM word_relations');
console.log(`Jami munosabat: ${total}; yangi: ${added}.`);
await db.end();
