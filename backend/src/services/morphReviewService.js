/**
 * Avtomatik morfologiya qosımta tekseriw — admin inbox + push outbox.
 */
import { pools, DB } from '../config/db.js';

const dictDb = pools.tusindirme;
const usersDb = pools.users;

let schemaReady = false;

function httpError(message, statusCode = 400, error = 'bad_request') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.error = error;
  return err;
}

export async function ensureMorphReviewSchema() {
  if (schemaReady) return;
  await dictDb.query(`
    CREATE TABLE IF NOT EXISTS morph_suffix_reviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      title_id VARCHAR(64) NOT NULL,
      soz VARCHAR(255) NULL,
      display_split VARCHAR(512) NULL,
      suffixes_json JSON NULL,
      status ENUM('pending','done','dismissed') NOT NULL DEFAULT 'pending',
      hit_count INT UNSIGNED NOT NULL DEFAULT 1,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_morph_review_title (title_id),
      KEY idx_morph_review_status (status, last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await usersDb.query(`
    CREATE TABLE IF NOT EXISTS ${DB.users}.admin_push_outbox (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      kind VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body VARCHAR(512) NULL,
      payload_json JSON NULL,
      status ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      PRIMARY KEY (id),
      KEY idx_admin_push_status (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

/**
 * Sóz betinen avtomatik qosımta anıqlansa — adminlerge xabar (dedupe title boyınsha).
 */
export async function reportMorphSuffixReview({
  titleId,
  soz = null,
  displaySplit = null,
  suffixes = [],
} = {}) {
  await ensureMorphReviewSchema();
  const id = String(titleId || '').trim();
  if (!id) throw httpError('titleId kerek');

  const suffixesJson = JSON.stringify(Array.isArray(suffixes) ? suffixes.slice(0, 24) : []);
  const word = soz ? String(soz).slice(0, 255) : null;
  const split = displaySplit ? String(displaySplit).slice(0, 512) : null;

  const [existing] = await dictDb.query(
    `SELECT id, status FROM morph_suffix_reviews WHERE title_id = ? LIMIT 1`,
    [id]
  );

  if (existing[0]) {
    await dictDb.query(
      `UPDATE morph_suffix_reviews
       SET soz = COALESCE(?, soz),
           display_split = COALESCE(?, display_split),
           suffixes_json = ?,
           hit_count = hit_count + 1,
           status = IF(status = 'done', status, 'pending'),
           last_seen_at = CURRENT_TIMESTAMP
       WHERE title_id = ?`,
      [word, split, suffixesJson, id]
    );
    return { ok: true, created: false, titleId: id };
  }

  await dictDb.query(
    `INSERT INTO morph_suffix_reviews
      (title_id, soz, display_split, suffixes_json, status, hit_count)
     VALUES (?, ?, ?, ?, 'pending', 1)`,
    [id, word, split, suffixesJson]
  );

  // Push outbox — FCM worker keyinroq jiberedi
  await usersDb.query(
    `INSERT INTO ${DB.users}.admin_push_outbox (kind, title, body, payload_json, status)
     VALUES ('morph_suffix_review', ?, ?, ?, 'queued')`,
    [
      'Morfologiya: qosımta tekseriw',
      `${word || id} — avtomatik qosımta anıqlandı, bazagа qosıń`,
      JSON.stringify({ titleId: id, soz: word, displaySplit: split }),
    ]
  );

  return { ok: true, created: true, titleId: id };
}

export async function listMorphSuffixReviews({ status = 'pending', limit = 40 } = {}) {
  await ensureMorphReviewSchema();
  const st = ['pending', 'done', 'dismissed', 'all'].includes(String(status))
    ? String(status)
    : 'pending';
  const lim = Math.min(100, Math.max(1, Number(limit) || 40));
  const params = [];
  let where = '';
  if (st !== 'all') {
    where = 'WHERE status = ?';
    params.push(st);
  }
  params.push(lim);
  const [rows] = await dictDb.query(
    `SELECT id, title_id AS titleId, soz, display_split AS displaySplit,
            suffixes_json AS suffixesJson, status, hit_count AS hitCount,
            last_seen_at AS lastSeenAt, created_at AS createdAt
     FROM morph_suffix_reviews
     ${where}
     ORDER BY last_seen_at DESC
     LIMIT ?`,
    params
  );
  return {
    reviews: rows.map((r) => ({
      ...r,
      suffixes:
        typeof r.suffixesJson === 'string'
          ? JSON.parse(r.suffixesJson || '[]')
          : r.suffixesJson || [],
      suffixesJson: undefined,
    })),
  };
}

export async function setMorphSuffixReviewStatus(id, status) {
  await ensureMorphReviewSchema();
  const next = String(status || '').trim();
  if (!['pending', 'done', 'dismissed'].includes(next)) {
    throw httpError('status: pending|done|dismissed');
  }
  const [result] = await dictDb.query(
    `UPDATE morph_suffix_reviews SET status = ? WHERE id = ?`,
    [next, id]
  );
  if (!result.affectedRows) throw httpError('Tabılmadı', 404);
  return { ok: true, id, status: next };
}
