import crypto from 'crypto';
import { pools } from '../config/db.js';
import searchFold from '../utils/searchFold.js';

const db = pools.tusindirme;

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function findDescription(descriptionId) {
  const [[row]] = await db.query(
    `SELECT d.id, d.titles_id AS titleId, d.description, t.soz, t.status
     FROM description d
     JOIN titles t ON t.id = d.titles_id
     WHERE d.id = ? LIMIT 1`,
    [descriptionId]
  );
  return row || null;
}

async function findTitleByWord(word) {
  const [[row]] = await db.query(
    `SELECT id, soz, status FROM titles
     WHERE soz = ? OR normalized = ? OR search_key = ?
     ORDER BY status DESC LIMIT 1`,
    [word, word, word]
  );
  return row || null;
}

/** Sof: stub anıqlama matni (public status=1 ushın). */
export function suggestionStubDescription(word, senseHint = null) {
  const w = String(word || '').trim() || 'sóz';
  const hint = String(senseHint || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (hint) {
    const clip = hint.length > 120 ? `${hint.slice(0, 119)}…` : hint;
    return `${clip} — baylanıslı (jámiyet usınısı)`;
  }
  return `«${w}» — jámiyet usınısı (moderatsiya)`;
}

/** Eski `(usınıs:…)` yamasa jańa «jámiyet usınısı» stub — cleanup status=0 dan ajıratıw. */
export function isCommunityGhostStub(description) {
  const s = String(description || '');
  return /^\(usınıs:/i.test(s) || /jámiyet\s+usınısı/i.test(s);
}

const GHOST_STUB_SQL = `(d.description LIKE '(usınıs:%' OR d.description LIKE '%jámiyet usınısı%')`;

/**
 * Usınıs sózi → title. Prefer active; inactive → activate; joq → status=1 yaratıw.
 * (Eski status=0 ghostlar endi publicqa shıǵadı.)
 */
export async function resolveOrCreateSuggestionTitle(word, { senseHint = null } = {}) {
  const raw = String(word || '').trim();
  if (!raw) throw httpError('suggestedWord kerek');
  const existing = await findTitleByWord(raw);
  if (existing) {
    if (Number(existing.status) !== 1) {
      await db.query(`UPDATE titles SET status = 1 WHERE id = ?`, [existing.id]);
      return { ...existing, status: 1, activated: true, created: false };
    }
    return { ...existing, status: 1, activated: false, created: false };
  }
  const id = crypto.randomUUID();
  const normalized = raw.toLocaleLowerCase('uz');
  const searchKey = searchFold(raw) || normalized;
  const [[ord]] = await db.query(`SELECT COALESCE(MAX(\`order\`), 0) AS maxOrd FROM titles`);
  await db.query(
    `INSERT INTO titles (id, soz, normalized, search_key, status, st_let, \`order\`)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [id, raw, normalized, searchKey, raw.charAt(0).toUpperCase() || '#', Number(ord?.maxOrd || 0) + 1]
  );
  return { id, soz: raw, status: 1, activated: true, created: true, senseHint };
}

async function ensureDescriptionForTitle(conn, title, { word, senseHint = null } = {}) {
  const [[existingDesc]] = await conn.query(
    `SELECT id, description FROM description WHERE titles_id = ? ORDER BY sort_order LIMIT 1`,
    [title.id]
  );
  if (existingDesc) {
    if (isCommunityGhostStub(existingDesc.description) && senseHint) {
      await conn.query(`UPDATE description SET description = ? WHERE id = ?`, [
        suggestionStubDescription(word || title.soz, senseHint),
        existingDesc.id,
      ]);
    }
    return existingDesc.id;
  }
  const targetDescId = crypto.randomUUID();
  await conn.query(
    `INSERT INTO description (id, titles_id, description, sort_order) VALUES (?, ?, ?, 0)`,
    [targetDescId, title.id, suggestionStubDescription(word || title.soz, senseHint)]
  );
  return targetDescId;
}

export async function getSenseRelationsForTitle(titleId) {
  const [descs] = await db.query(
    `SELECT id, description, sort_order AS sortOrder
     FROM description WHERE titles_id = ? ORDER BY sort_order, id`,
    [titleId]
  );
  if (!descs.length) return [];

  const result = [];
  for (const d of descs) {
    const [synRows] = await db.query(
      `SELECT t.id AS titleId, t.soz, d2.id AS descriptionId, d2.description AS meaning
       FROM synonym_group_descriptions sgd1
       JOIN synonym_group_descriptions sgd2
         ON sgd1.group_id = sgd2.group_id AND sgd2.description_id != sgd1.description_id
       JOIN description d2 ON d2.id = sgd2.description_id
       JOIN titles t ON t.id = d2.titles_id AND t.status = 1
       WHERE sgd1.description_id = ?
       ORDER BY t.soz`,
      [d.id]
    );

    const [antRows] = await db.query(
      `SELECT t.id AS titleId, t.soz, d2.id AS descriptionId, d2.description AS meaning
       FROM description_antonyms da
       JOIN description d2 ON d2.id = IF(da.description_id_a = ?, da.description_id_b, da.description_id_a)
       JOIN titles t ON t.id = d2.titles_id AND t.status = 1
       WHERE da.description_id_a = ? OR da.description_id_b = ?
       ORDER BY t.soz`,
      [d.id, d.id, d.id]
    );

    result.push({
      descriptionId: d.id,
      description: d.description,
      synonyms: synRows,
      antonyms: antRows,
    });
  }
  return result;
}

export async function getCompoundsForTitle(titleId) {
  const [components] = await db.query(
    `SELECT cw.id AS relationId, t.id, t.soz, cw.sort_order AS sortOrder, t.status
     FROM compound_words cw
     JOIN titles t ON t.id = cw.component_title_id
     WHERE cw.main_title_id = ?
     ORDER BY cw.sort_order, t.soz`,
    [titleId]
  );
  const [asComponent] = await db.query(
    `SELECT cw.id AS relationId, t.id, t.soz, cw.sort_order AS sortOrder
     FROM compound_words cw
     JOIN titles t ON t.id = cw.main_title_id AND t.status = 1
     WHERE cw.component_title_id = ?
     ORDER BY t.soz`,
    [titleId]
  );
  return { components, usedIn: asComponent };
}

async function resolveActiveTitleWithSense(word) {
  const raw = String(word || '').trim();
  if (!raw) throw httpError('word kerek');
  const title = await findTitleByWord(raw);
  if (!title) throw httpError('Sóz tabılmadı', 404);
  if (Number(title.status) !== 1) throw httpError('Sóz public emes (status≠1)', 409);
  const [[desc]] = await db.query(
    `SELECT id FROM description WHERE titles_id = ? ORDER BY sort_order, id LIMIT 1`,
    [title.id]
  );
  if (!desc) throw httpError('Sózde anıqlama joq', 409);
  return { title, descriptionId: desc.id };
}

/** Moderator: anıqlama dárejesinde sinonim. */
export async function addSenseSynonym(descriptionId, { word } = {}) {
  const sourceId = String(descriptionId || '').trim();
  if (!sourceId) throw httpError('descriptionId kerek');
  const source = await findDescription(sourceId);
  if (!source) throw httpError('Túsindirme tabılmadı', 404);
  const { title, descriptionId: targetId } = await resolveActiveTitleWithSense(word);
  if (targetId === sourceId) throw httpError('Ózine sinonim qosıw múmkin emes');

  const [[existingGroup]] = await db.query(
    `SELECT group_id AS groupId FROM synonym_group_descriptions WHERE description_id = ? LIMIT 1`,
    [sourceId]
  );
  let groupId = existingGroup?.groupId || null;
  if (!groupId) {
    const [[targetGroup]] = await db.query(
      `SELECT group_id AS groupId FROM synonym_group_descriptions WHERE description_id = ? LIMIT 1`,
      [targetId]
    );
    groupId = targetGroup?.groupId || null;
  }
  if (!groupId) {
    const [groupRes] = await db.query(`INSERT INTO synonym_groups (note) VALUES (?)`, [
      'moderator direct',
    ]);
    groupId = groupRes.insertId;
    await db.query(
      `INSERT IGNORE INTO synonym_group_descriptions (group_id, description_id) VALUES (?, ?)`,
      [groupId, sourceId]
    );
  }
  await db.query(
    `INSERT IGNORE INTO synonym_group_descriptions (group_id, description_id) VALUES (?, ?)`,
    [groupId, targetId]
  );
  return { descriptionId: sourceId, targetDescriptionId: targetId, titleId: title.id, word: title.soz };
}

export async function removeSenseSynonym(descriptionId, targetDescriptionId) {
  const a = String(descriptionId || '').trim();
  const b = String(targetDescriptionId || '').trim();
  if (!a || !b) throw httpError('descriptionId hám targetDescriptionId kerek');
  const [shared] = await db.query(
    `SELECT sgd1.group_id AS groupId
     FROM synonym_group_descriptions sgd1
     JOIN synonym_group_descriptions sgd2 ON sgd1.group_id = sgd2.group_id
     WHERE sgd1.description_id = ? AND sgd2.description_id = ?`,
    [a, b]
  );
  if (!shared.length) throw httpError('Sinonim baylanıs tabılmadı', 404);
  for (const g of shared) {
    await db.query(
      `DELETE FROM synonym_group_descriptions WHERE group_id = ? AND description_id = ?`,
      [g.groupId, b]
    );
  }
  return { descriptionId: a, targetDescriptionId: b, deleted: true };
}

export async function addSenseAntonym(descriptionId, { word } = {}) {
  const sourceId = String(descriptionId || '').trim();
  if (!sourceId) throw httpError('descriptionId kerek');
  const source = await findDescription(sourceId);
  if (!source) throw httpError('Túsindirme tabılmadı', 404);
  const { title, descriptionId: targetId } = await resolveActiveTitleWithSense(word);
  if (targetId === sourceId) throw httpError('Ózine antonim qosıw múmkin emes');
  const left = sourceId < targetId ? sourceId : targetId;
  const right = sourceId < targetId ? targetId : sourceId;
  await db.query(
    `INSERT IGNORE INTO description_antonyms (description_id_a, description_id_b, note) VALUES (?, ?, ?)`,
    [left, right, 'moderator direct']
  );
  return { descriptionId: sourceId, targetDescriptionId: targetId, titleId: title.id, word: title.soz };
}

export async function removeSenseAntonym(descriptionId, targetDescriptionId) {
  const a = String(descriptionId || '').trim();
  const b = String(targetDescriptionId || '').trim();
  if (!a || !b) throw httpError('descriptionId hám targetDescriptionId kerek');
  const left = a < b ? a : b;
  const right = a < b ? b : a;
  const [result] = await db.query(
    `DELETE FROM description_antonyms WHERE description_id_a = ? AND description_id_b = ?`,
    [left, right]
  );
  if (!Number(result.affectedRows)) throw httpError('Antonim baylanıs tabılmadı', 404);
  return { descriptionId: a, targetDescriptionId: b, deleted: true };
}

export async function addCompoundComponent(mainTitleId, { word } = {}) {
  const mainId = String(mainTitleId || '').trim();
  if (!mainId) throw httpError('mainTitleId kerek');
  const [[main]] = await db.query(`SELECT id, soz FROM titles WHERE id = ? LIMIT 1`, [mainId]);
  if (!main) throw httpError('Tiykarǵı sóz tabılmadı', 404);
  const { title } = await resolveActiveTitleWithSense(word);
  if (title.id === mainId) throw httpError('Ózin bólek etiwi múmkin emes');
  const [[ord]] = await db.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrd FROM compound_words WHERE main_title_id = ?`,
    [mainId]
  );
  await db.query(
    `INSERT IGNORE INTO compound_words (main_title_id, component_title_id, sort_order) VALUES (?, ?, ?)`,
    [mainId, title.id, Number(ord?.maxOrd || 0) + 1]
  );
  const [[row]] = await db.query(
    `SELECT id AS relationId FROM compound_words WHERE main_title_id = ? AND component_title_id = ? LIMIT 1`,
    [mainId, title.id]
  );
  return { relationId: row?.relationId, mainTitleId: mainId, componentTitleId: title.id, word: title.soz };
}

export async function removeCompound(relationId) {
  const id = Number(relationId);
  if (!Number.isInteger(id) || id < 1) throw httpError('relationId kerek');
  const [result] = await db.query(`DELETE FROM compound_words WHERE id = ?`, [id]);
  if (!Number(result.affectedRows)) throw httpError('Qurma baylanıs tabılmadı', 404);
  return { relationId: id, deleted: true };
}

export async function addWordRelation(titleId, { word, type } = {}) {
  const sourceId = String(titleId || '').trim();
  if (!sourceId) throw httpError('titleId kerek');
  if (!['synonym', 'antonym'].includes(type)) throw httpError('type: synonym | antonym');
  const [[source]] = await db.query(`SELECT id FROM titles WHERE id = ? AND status = 1 LIMIT 1`, [
    sourceId,
  ]);
  if (!source) throw httpError('Sóz tabılmadı', 404);
  const { title } = await resolveActiveTitleWithSense(word);
  if (title.id === sourceId) throw httpError('Ózine baylanıs qosıw múmkin emes');
  await db.query(
    `INSERT IGNORE INTO word_relations (source_title_id, target_title_id, relation_type, source_kind, note)
     VALUES (?, ?, ?, 'manual', ?)`,
    [sourceId, title.id, type, 'moderator direct']
  );
  const [[row]] = await db.query(
    `SELECT id AS relationId FROM word_relations
     WHERE source_title_id = ? AND target_title_id = ? AND relation_type = ?
     LIMIT 1`,
    [sourceId, title.id, type]
  );
  return { relationId: row?.relationId, titleId: sourceId, targetTitleId: title.id, word: title.soz, type };
}

export async function removeWordRelation(relationId) {
  const id = Number(relationId);
  if (!Number.isInteger(id) || id < 1) throw httpError('relationId kerek');
  const [result] = await db.query(`DELETE FROM word_relations WHERE id = ?`, [id]);
  if (!Number(result.affectedRows)) throw httpError('Baylanıs tabılmadı', 404);
  return { relationId: id, deleted: true };
}

const SUGGESTION_STATUSES = new Set(['pending', 'approved', 'rejected']);
const SUGGESTION_TYPES = new Set(['synonym', 'antonym', 'compound']);

export async function listPendingSuggestions({
  descriptionId = null,
  mainTitleId = null,
  limit = 20,
  viewerActorKey = null,
} = {}) {
  const lim = Math.min(50, Math.max(1, Number(limit) || 20));
  let sql = `SELECT cs.id,
                    cs.actor_key AS actorKey,
                    cs.suggestion_type AS suggestionType,
                    cs.description_id AS descriptionId,
                    cs.main_title_id AS mainTitleId,
                    cs.suggested_word AS suggestedWord,
                    cs.upvotes, cs.downvotes, cs.status,
                    cs.created_at AS createdAt,
                    src.id AS sourceTitleId,
                    src.soz AS sourceWord,
                    d.description AS senseSnippet,
                    mt.soz AS mainWord
             FROM community_suggestions cs
             LEFT JOIN description d ON d.id = cs.description_id
             LEFT JOIN titles src ON src.id = d.titles_id
             LEFT JOIN titles mt ON mt.id = cs.main_title_id
             WHERE cs.status = 'pending'`;
  const params = [];
  if (descriptionId) {
    sql += ' AND cs.description_id = ?';
    params.push(descriptionId);
  }
  if (mainTitleId) {
    sql += ' AND cs.main_title_id = ?';
    params.push(mainTitleId);
  }
  sql += ' ORDER BY cs.created_at DESC LIMIT ?';
  params.push(lim);
  const [rows] = await db.query(sql, params);

  const viewer = viewerActorKey ? String(viewerActorKey) : null;
  const voteMap = {};
  if (viewer && rows.length) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const [votes] = await db.query(
      `SELECT suggestion_id AS id, vote
       FROM community_suggestion_votes
       WHERE actor_key = ? AND suggestion_id IN (${placeholders})`,
      [viewer, ...ids]
    );
    for (const v of votes || []) {
      voteMap[v.id] = v.vote;
    }
  }

  return rows.map((r) => {
    const { actorKey, ...rest } = r;
    return {
      ...rest,
      senseSnippet: r.senseSnippet
        ? String(r.senseSnippet).replace(/\s+/g, ' ').trim().slice(0, 160)
        : null,
      myVote: voteMap[r.id] || null,
      isMine: Boolean(viewer && actorKey && String(actorKey) === viewer),
      sourceHref: r.sourceTitleId
        ? `/dictionary/${r.sourceTitleId}`
        : r.mainTitleId
          ? `/dictionary/${r.mainTitleId}`
          : null,
      sourceLabel: r.sourceWord || r.mainWord || null,
    };
  });
}

/** Learner: meniń usınıslarım (pending / approved / rejected / all). */
export async function listMySuggestions({
  actorKey,
  status = 'all',
  limit = 30,
} = {}) {
  const key = String(actorKey || '').trim();
  if (!key) return [];
  const lim = Math.min(50, Math.max(1, Number(limit) || 30));
  const params = [key];
  let statusSql = '';
  const statusKey = String(status || 'all').trim().toLowerCase();
  if (SUGGESTION_STATUSES.has(statusKey)) {
    statusSql = ' AND cs.status = ?';
    params.push(statusKey);
  }

  const [rows] = await db.query(
    `SELECT cs.id,
            cs.suggestion_type AS suggestionType,
            cs.description_id AS descriptionId,
            cs.main_title_id AS mainTitleId,
            cs.suggested_word AS suggestedWord,
            cs.upvotes, cs.downvotes, cs.status,
            cs.moderator_note AS moderatorNote,
            cs.created_at AS createdAt,
            cs.resolved_at AS resolvedAt,
            src.id AS sourceTitleId,
            src.soz AS sourceWord,
            d.description AS senseSnippet,
            mt.soz AS mainWord
     FROM community_suggestions cs
     LEFT JOIN description d ON d.id = cs.description_id
     LEFT JOIN titles src ON src.id = d.titles_id
     LEFT JOIN titles mt ON mt.id = cs.main_title_id
     WHERE cs.actor_key = ?${statusSql}
     ORDER BY cs.created_at DESC
     LIMIT ?`,
    [...params, lim]
  );

  return rows.map((r) => ({
    ...r,
    senseSnippet: r.senseSnippet
      ? String(r.senseSnippet).replace(/\s+/g, ' ').trim().slice(0, 160)
      : null,
    moderatorNote: r.moderatorNote || '',
    isMine: true,
    myVote: null,
    sourceHref: r.sourceTitleId
      ? `/dictionary/${r.sourceTitleId}`
      : r.mainTitleId
        ? `/dictionary/${r.mainTitleId}`
        : null,
    sourceLabel: r.sourceWord || r.mainWord || null,
  }));
}

/** Moderator inbox + tariyx. */
export async function listModeratorSuggestions({
  status = 'pending',
  type = '',
  page = 1,
  limit = 30,
} = {}) {
  const safeLimit = Math.min(80, Math.max(1, Number(limit) || 30));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  const statusKey = String(status || 'pending').trim().toLowerCase();
  if (statusKey === 'all') {
    /* no status filter */
  } else if (SUGGESTION_STATUSES.has(statusKey)) {
    where.push('cs.status = ?');
    params.push(statusKey);
  } else {
    where.push(`cs.status = 'pending'`);
  }

  const typeKey = String(type || '').trim().toLowerCase();
  if (typeKey && SUGGESTION_TYPES.has(typeKey)) {
    where.push('cs.suggestion_type = ?');
    params.push(typeKey);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM community_suggestions cs ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT cs.id,
            cs.suggestion_type AS suggestionType,
            cs.description_id AS descriptionId,
            cs.main_title_id AS mainTitleId,
            cs.suggested_word AS suggestedWord,
            cs.upvotes, cs.downvotes, cs.status,
            cs.moderator_note AS moderatorNote,
            cs.created_at AS createdAt,
            cs.resolved_at AS resolvedAt,
            src.id AS sourceTitleId,
            src.soz AS sourceWord,
            d.description AS senseSnippet,
            mt.soz AS mainWord
     FROM community_suggestions cs
     LEFT JOIN description d ON d.id = cs.description_id
     LEFT JOIN titles src ON src.id = d.titles_id
     LEFT JOIN titles mt ON mt.id = cs.main_title_id
     ${whereSql}
     ORDER BY COALESCE(cs.resolved_at, cs.created_at) DESC, cs.id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    items: rows.map((r) => ({
      ...r,
      senseSnippet: r.senseSnippet
        ? String(r.senseSnippet).replace(/\s+/g, ' ').trim().slice(0, 160)
        : null,
      moderatorNote: r.moderatorNote || '',
    })),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
  };
}

export async function createSuggestion(actorKey, body) {
  const type = body?.suggestionType;
  const word = String(body?.suggestedWord || '').trim();
  if (!['synonym', 'antonym', 'compound'].includes(type)) {
    throw httpError('suggestionType: synonym | antonym | compound');
  }
  if (!word || word.length > 100) throw httpError('suggestedWord kerek (≤100)');

  if (type === 'compound') {
    const mainTitleId = body?.mainTitleId;
    if (!mainTitleId) throw httpError('mainTitleId kerek');
    const [[main]] = await db.query('SELECT id FROM titles WHERE id = ?', [mainTitleId]);
    if (!main) throw httpError('Tiykarǵı sóz tabılmadı', 404);
    const [result] = await db.query(
      `INSERT INTO community_suggestions
       (actor_key, suggestion_type, main_title_id, suggested_word, component_sort_order, status)
       VALUES (?, 'compound', ?, ?, ?, 'pending')`,
      [actorKey, mainTitleId, word, Number(body?.sortOrder) || 1]
    );
    return { id: result.insertId, status: 'pending' };
  }

  const descriptionId = body?.descriptionId;
  if (!descriptionId) throw httpError('descriptionId kerek');
  const desc = await findDescription(descriptionId);
  if (!desc) throw httpError('Túsindirme tabılmadı', 404);

  const [dup] = await db.query(
    `SELECT id FROM community_suggestions
     WHERE suggestion_type = ? AND description_id = ? AND suggested_word = ?
       AND status = 'pending' LIMIT 1`,
    [type, descriptionId, word]
  );
  if (dup.length) throw httpError('Bul usınıs aldınnan kútilip tur', 409);

  const [result] = await db.query(
    `INSERT INTO community_suggestions
     (actor_key, suggestion_type, description_id, suggested_word, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [actorKey, type, descriptionId, word]
  );
  return { id: result.insertId, status: 'pending' };
}

export async function voteSuggestion(actorKey, suggestionId, vote) {
  if (!['up', 'down'].includes(vote)) throw httpError('vote: up | down');
  const [[sug]] = await db.query(
    `SELECT id, actor_key AS actorKey, status FROM community_suggestions WHERE id = ?`,
    [suggestionId]
  );
  if (!sug) throw httpError('Usınıs tabılmadı', 404);
  if (sug.status !== 'pending') throw httpError('Tek kútilip turǵan usınısqa dawıs beriledi', 409);
  if (sug.actorKey === actorKey) throw httpError('Óz usınısıńızǵa dawıs bere almaysız', 403);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[existing]] = await conn.query(
      `SELECT id, vote FROM community_suggestion_votes
       WHERE suggestion_id = ? AND actor_key = ? FOR UPDATE`,
      [suggestionId, actorKey]
    );
    if (existing) {
      if (existing.vote === vote) {
        const [[counts]] = await conn.query(
          `SELECT upvotes AS upvotes, downvotes AS downvotes, status FROM community_suggestions WHERE id = ?`,
          [suggestionId]
        );
        await conn.commit();
        return { unchanged: true, myVote: vote, ...counts };
      }
      await conn.query(
        `UPDATE community_suggestion_votes SET vote = ? WHERE id = ?`,
        [vote, existing.id]
      );
      if (vote === 'up') {
        await conn.query(
          `UPDATE community_suggestions SET upvotes = upvotes + 1, downvotes = GREATEST(downvotes - 1, 0) WHERE id = ?`,
          [suggestionId]
        );
      } else {
        await conn.query(
          `UPDATE community_suggestions SET downvotes = downvotes + 1, upvotes = GREATEST(upvotes - 1, 0) WHERE id = ?`,
          [suggestionId]
        );
      }
    } else {
      await conn.query(
        `INSERT INTO community_suggestion_votes (suggestion_id, actor_key, vote) VALUES (?, ?, ?)`,
        [suggestionId, actorKey, vote]
      );
      if (vote === 'up') {
        await conn.query(`UPDATE community_suggestions SET upvotes = upvotes + 1 WHERE id = ?`, [
          suggestionId,
        ]);
      } else {
        await conn.query(`UPDATE community_suggestions SET downvotes = downvotes + 1 WHERE id = ?`, [
          suggestionId,
        ]);
      }
    }
    // Auto-approve yoqilmagan (anonymous Sybil risk)
    await conn.commit();
    const [[counts]] = await db.query(
      `SELECT upvotes AS upvotes, downvotes AS downvotes, status FROM community_suggestions WHERE id = ?`,
      [suggestionId]
    );
    return { ...counts, myVote: vote, unchanged: false };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Eski maqullawdan qalǵan status=0 «ghost» titlelar (jámiyet stub anıqlama).
 * Cleanup skriptleri óshirgen (status=0) sózlerdi kórsetpeydi.
 */
export async function listGhostTitles({ page = 1, limit = 25, q = '' } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const lim = Math.min(50, Math.max(1, Number(limit) || 25));
  const offset = (p - 1) * lim;
  const needle = String(q || '').trim().slice(0, 80);
  const params = [];
  let where = `t.status = 0 AND ${GHOST_STUB_SQL}`;
  if (needle) {
    where += ' AND (t.soz LIKE ? OR t.normalized LIKE ? OR t.search_key LIKE ?)';
    const like = `%${needle}%`;
    params.push(like, like, like);
  }
  const [[countRow]] = await db.query(
    `SELECT COUNT(DISTINCT t.id) AS total
     FROM titles t
     INNER JOIN description d ON d.titles_id = t.id
     WHERE ${where}`,
    params
  );
  const [rows] = await db.query(
    `SELECT t.id, t.soz AS word, t.created_at AS createdAt,
            d.id AS descriptionId,
            d.description AS stubSnippet
     FROM titles t
     INNER JOIN description d ON d.id = (
       SELECT d2.id FROM description d2
       WHERE d2.titles_id = t.id
         AND (d2.description LIKE '(usınıs:%' OR d2.description LIKE '%jámiyet usınısı%')
       ORDER BY d2.sort_order, d2.id
       LIMIT 1
     )
     WHERE t.status = 0
     ${needle ? 'AND (t.soz LIKE ? OR t.normalized LIKE ? OR t.search_key LIKE ?)' : ''}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    needle
      ? [`%${needle}%`, `%${needle}%`, `%${needle}%`, lim, offset]
      : [lim, offset]
  );
  const total = Number(countRow?.total) || 0;
  return {
    items: rows.map((r) => {
      const full = r.stubSnippet ? String(r.stubSnippet).replace(/\s+/g, ' ').trim() : '';
      return {
        id: r.id,
        word: r.word,
        createdAt: r.createdAt,
        descriptionId: r.descriptionId,
        description: full.slice(0, 4000),
        stubSnippet: full ? full.slice(0, 160) : null,
      };
    }),
    total,
    page: p,
    pages: Math.max(1, Math.ceil(total / lim)),
    limit: lim,
  };
}

/**
 * Moderator: túsindirme tekstin jańalaw.
 * activate=true → title status=1 (stub regexsiz — tekst ózgertilgennen keyin de ishleydi).
 */
export function validateDescriptionBody(description) {
  const text = String(description ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, error: 'description kerek' };
  if (text.length > 4000) return { ok: false, error: 'description tım uzın (≤4000)' };
  return { ok: true, text };
}

/** Mısal / fraza ushın qısqa tekst (≤1000). */
export function validateShortText(value, { field = 'tekst', max = 1000 } = {}) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return { ok: false, error: `${field} kerek` };
  if (text.length > max) return { ok: false, error: `${field} tım uzın (≤${max})` };
  return { ok: true, text };
}

export async function updateDescriptionText(
  descriptionId,
  { description, activate = false, category } = {}
) {
  const id = String(descriptionId || '').trim();
  if (!id) throw httpError('descriptionId kerek');

  const hasDescription = description !== undefined && description !== null;
  const hasCategory = category !== undefined;
  if (!hasDescription && !hasCategory) {
    throw httpError('description yamasa category kerek');
  }

  const desc = await findDescription(id);
  if (!desc) throw httpError('Túsindirme tabılmadı', 404);

  let text = String(desc.description || '');
  if (hasDescription) {
    const checked = validateDescriptionBody(description);
    if (!checked.ok) throw httpError(checked.error);
    text = checked.text;
  }

  let categoryId;
  let categoryName = null;
  if (hasCategory) {
    const rawCat = category == null ? '' : String(category).trim();
    if (!rawCat) {
      categoryId = null;
      categoryName = null;
    } else {
      categoryId = await findOrCreateCategoryId(rawCat);
      categoryName = rawCat;
    }
  }

  if (hasDescription && hasCategory) {
    await db.query(`UPDATE description SET description = ?, categorys_id = ? WHERE id = ?`, [
      text,
      categoryId,
      id,
    ]);
  } else if (hasDescription) {
    await db.query(`UPDATE description SET description = ? WHERE id = ?`, [text, id]);
  } else {
    await db.query(`UPDATE description SET categorys_id = ? WHERE id = ?`, [categoryId, id]);
  }

  let activated = false;
  if (activate && Number(desc.status) !== 1) {
    const [result] = await db.query(
      `UPDATE titles SET status = 1 WHERE id = ? AND status = 0`,
      [desc.titleId]
    );
    activated = Number(result.affectedRows) > 0;
  }

  return {
    id,
    titleId: desc.titleId,
    word: desc.soz,
    description: text,
    ...(hasCategory ? { category: categoryName } : {}),
    activated,
    public: Number(desc.status) === 1 || activated,
  };
}

export async function updateExampleText(exampleId, { example } = {}) {
  const id = String(exampleId || '').trim();
  if (!id) throw httpError('exampleId kerek');
  const checked = validateShortText(example, { field: 'example', max: 2000 });
  if (!checked.ok) throw httpError(checked.error);

  const [[row]] = await db.query(
    `SELECT id, descriptions_id AS descriptionsId FROM examples WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) throw httpError('Mısal tabılmadı', 404);

  await db.query(`UPDATE examples SET example = ? WHERE id = ?`, [checked.text, id]);
  return { id, descriptionsId: row.descriptionsId, example: checked.text };
}

export async function updateIdiomPhrase(idiomId, { phrase } = {}) {
  const id = String(idiomId || '').trim();
  if (!id) throw httpError('idiomId kerek');
  const checked = validateShortText(phrase, { field: 'phrase', max: 255 });
  if (!checked.ok) throw httpError(checked.error);

  const [[row]] = await db.query(`SELECT id FROM idioms WHERE id = ? LIMIT 1`, [id]);
  if (!row) throw httpError('Frazeologizm tabılmadı', 404);

  await db.query(`UPDATE idioms SET phrase = ? WHERE id = ?`, [checked.text, id]);
  return { id, phrase: checked.text };
}

export async function updateIdiomDescText(idiomDescId, { description } = {}) {
  const id = String(idiomDescId || '').trim();
  if (!id) throw httpError('idiomDescId kerek');
  const checked = validateDescriptionBody(description);
  if (!checked.ok) throw httpError(checked.error);

  const [[row]] = await db.query(
    `SELECT id, idioms_id AS idiomId FROM idiom_desc WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) throw httpError('Frazeologizm túsindirmesi tabılmadı', 404);

  await db.query(`UPDATE idiom_desc SET description = ? WHERE id = ?`, [checked.text, id]);
  return { id, idiomId: row.idiomId, description: checked.text };
}

export async function createExample(descriptionId, { example, author = null } = {}) {
  const descId = String(descriptionId || '').trim();
  if (!descId) throw httpError('descriptionId kerek');
  const checked = validateShortText(example, { field: 'example', max: 2000 });
  if (!checked.ok) throw httpError(checked.error);

  const desc = await findDescription(descId);
  if (!desc) throw httpError('Túsindirme tabılmadı', 404);

  let authorText = null;
  if (author != null && String(author).trim()) {
    const a = validateShortText(author, { field: 'author', max: 255 });
    if (!a.ok) throw httpError(a.error);
    authorText = a.text;
  }

  const [[ord]] = await db.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrd FROM examples WHERE descriptions_id = ?`,
    [descId]
  );
  const id = crypto.randomUUID();
  const sortOrder = Number(ord?.maxOrd || 0) + 1;
  await db.query(
    `INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, descId, checked.text, authorText, sortOrder]
  );
  return {
    id,
    descriptionsId: descId,
    example: checked.text,
    author: authorText,
    sortOrder,
  };
}

export async function deleteExample(exampleId) {
  const id = String(exampleId || '').trim();
  if (!id) throw httpError('exampleId kerek');
  const [[row]] = await db.query(
    `SELECT id, descriptions_id AS descriptionsId FROM examples WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) throw httpError('Mısal tabılmadı', 404);
  await db.query(`DELETE FROM examples WHERE id = ?`, [id]);
  return { id, descriptionsId: row.descriptionsId, deleted: true };
}

export async function createIdiom(descriptionId, { phrase, description = null } = {}) {
  const descId = String(descriptionId || '').trim();
  if (!descId) throw httpError('descriptionId kerek');
  const phraseOk = validateShortText(phrase, { field: 'phrase', max: 255 });
  if (!phraseOk.ok) throw httpError(phraseOk.error);

  const desc = await findDescription(descId);
  if (!desc) throw httpError('Túsindirme tabılmadı', 404);

  let gloss = null;
  if (description != null && String(description).trim()) {
    const g = validateDescriptionBody(description);
    if (!g.ok) throw httpError(g.error);
    gloss = g.text;
  }

  const [[ord]] = await db.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrd FROM idioms WHERE descriptions_id = ?`,
    [descId]
  );
  const id = crypto.randomUUID();
  const sortOrder = Number(ord?.maxOrd || 0) + 1;
  await db.query(
    `INSERT INTO idioms (id, descriptions_id, phrase, sort_order) VALUES (?, ?, ?, ?)`,
    [id, descId, phraseOk.text, sortOrder]
  );

  let idiomDescId = null;
  if (gloss) {
    idiomDescId = crypto.randomUUID();
    await db.query(
      `INSERT INTO idiom_desc (id, idioms_id, description) VALUES (?, ?, ?)`,
      [idiomDescId, id, gloss]
    );
  }

  return {
    id,
    descriptionsId: descId,
    phrase: phraseOk.text,
    sortOrder,
    idiomDescId,
    description: gloss,
  };
}

export async function deleteIdiom(idiomId) {
  const id = String(idiomId || '').trim();
  if (!id) throw httpError('idiomId kerek');
  const [[row]] = await db.query(
    `SELECT id, descriptions_id AS descriptionsId FROM idioms WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) throw httpError('Frazeologizm tabılmadı', 404);
  await db.query(`DELETE FROM idioms WHERE id = ?`, [id]);
  return { id, descriptionsId: row.descriptionsId, deleted: true };
}

async function findOrCreateCategoryId(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  if (raw.length > 64) throw httpError('category tım uzın (≤64)');
  const [[existing]] = await db.query(
    `SELECT id FROM categorys WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    [raw]
  );
  if (existing) return existing.id;
  const [result] = await db.query(
    `INSERT INTO categorys (temp_id, name, code) VALUES (?, ?, ?)`,
    [`cat_${raw.slice(0, 40)}`, raw, raw.toLocaleLowerCase('uz')]
  );
  return result.insertId;
}

/** Jańa anıqlama (description) — title id boyınsha. */
export async function createDescriptionForTitle(titleId, { description, category = null } = {}) {
  const tid = String(titleId || '').trim();
  if (!tid) throw httpError('titleId kerek');
  const checked = validateDescriptionBody(description);
  if (!checked.ok) throw httpError(checked.error);

  const [[title]] = await db.query(`SELECT id, soz, status FROM titles WHERE id = ? LIMIT 1`, [tid]);
  if (!title) throw httpError('Sóz tabılmadı', 404);

  const categoryId = await findOrCreateCategoryId(category);
  const [[ord]] = await db.query(
    `SELECT COALESCE(MAX(sort_order), -1) AS maxOrd FROM description WHERE titles_id = ?`,
    [tid]
  );
  const id = crypto.randomUUID();
  const sortOrder = Number(ord?.maxOrd ?? -1) + 1;
  await db.query(
    `INSERT INTO description (id, titles_id, categorys_id, description, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [id, tid, categoryId, checked.text, sortOrder]
  );

  return {
    id,
    titleId: tid,
    word: title.soz,
    description: checked.text,
    category: category ? String(category).trim() : null,
    sortOrder,
  };
}

/** Anıqlamanı óshiriw (mısal/fraza/sinon CASCADE). */
export async function deleteDescriptionRecord(descriptionId) {
  const id = String(descriptionId || '').trim();
  if (!id) throw httpError('descriptionId kerek');
  const desc = await findDescription(id);
  if (!desc) throw httpError('Túsindirme tabılmadı', 404);

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS n FROM description WHERE titles_id = ?`,
    [desc.titleId]
  );
  const remaining = Number(countRow?.n || 0);
  if (remaining <= 1) {
    throw httpError('Sońǵı anıqlamanı óshiriw múmkin emes — aldın jańasın qosıń', 409);
  }

  await db.query(`DELETE FROM description WHERE id = ?`, [id]);
  return { id, titleId: desc.titleId, word: desc.soz, deleted: true };
}

/**
 * Moderator: jańa public sóz + birinshi anıqlama.
 * Bar status=1 → 409 + titleId. status=0 → aktivlestiriw + anıqlama.
 */
export async function createTitleWithSense({ word, description, category = null } = {}) {
  const raw = String(word || '').trim();
  if (!raw) throw httpError('word kerek');
  if (raw.length > 255) throw httpError('word tım uzın (≤255)');
  const checked = validateDescriptionBody(description);
  if (!checked.ok) throw httpError(checked.error);

  const existing = await findTitleByWord(raw);
  if (existing && Number(existing.status) === 1) {
    throw httpError('Bul sóz aldınnan bar', 409, {
      titleId: existing.id,
      word: existing.soz,
    });
  }

  let titleId;
  let created = false;
  let activated = false;
  if (existing) {
    await db.query(`UPDATE titles SET status = 1 WHERE id = ?`, [existing.id]);
    titleId = existing.id;
    activated = true;
  } else {
    const id = crypto.randomUUID();
    const normalized = raw.toLocaleLowerCase('uz');
    const searchKey = searchFold(raw) || normalized;
    const [[ord]] = await db.query(`SELECT COALESCE(MAX(\`order\`), 0) AS maxOrd FROM titles`);
    await db.query(
      `INSERT INTO titles (id, soz, normalized, search_key, status, st_let, \`order\`)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, raw, normalized, searchKey, raw.charAt(0).toUpperCase() || '#', Number(ord?.maxOrd || 0) + 1]
    );
    titleId = id;
    created = true;
  }

  const sense = await createDescriptionForTitle(titleId, {
    description: checked.text,
    category,
  });

  return {
    id: titleId,
    word: raw,
    created,
    activated,
    descriptionId: sense.id,
    description: sense.description,
    category: sense.category,
    public: true,
  };
}

/** Moderator: sóz atın ózgertiw (normalized / search_key / st_let jańalanadı). */
export async function renameTitle(titleId, { word } = {}) {
  const tid = String(titleId || '').trim();
  if (!tid) throw httpError('titleId kerek');
  const raw = String(word || '').trim();
  if (!raw) throw httpError('word kerek');
  if (raw.length > 255) throw httpError('word tım uzın (≤255)');

  const [[title]] = await db.query(`SELECT id, soz, status FROM titles WHERE id = ? LIMIT 1`, [tid]);
  if (!title) throw httpError('Sóz tabılmadı', 404);

  const normalized = raw.toLocaleLowerCase('uz');
  const searchKey = searchFold(raw) || normalized;
  const [[clash]] = await db.query(
    `SELECT id, soz FROM titles
     WHERE id != ? AND (soz = ? OR normalized = ? OR search_key = ?)
     LIMIT 1`,
    [tid, raw, normalized, searchKey]
  );
  if (clash) {
    throw httpError('Bul at aldınnan basqa sózde bar', 409, {
      titleId: clash.id,
      word: clash.soz,
    });
  }

  if (title.soz === raw) {
    return { id: tid, word: raw, previous: title.soz, changed: false };
  }

  await db.query(
    `UPDATE titles SET soz = ?, normalized = ?, search_key = ?, st_let = ? WHERE id = ?`,
    [raw, normalized, searchKey, raw.charAt(0).toUpperCase() || '#', tid]
  );

  return { id: tid, word: raw, previous: title.soz, changed: true };
}

/** Publicdan jasıriw (status=0). Qator óshirilmeydi. */
export async function deactivateTitle(titleId) {
  const tid = String(titleId || '').trim();
  if (!tid) throw httpError('titleId kerek');
  const [[title]] = await db.query(`SELECT id, soz, status FROM titles WHERE id = ? LIMIT 1`, [tid]);
  if (!title) throw httpError('Sóz tabılmadı', 404);
  if (Number(title.status) === 0) {
    return { id: tid, word: title.soz, deactivated: false, public: false };
  }
  await db.query(`UPDATE titles SET status = 0 WHERE id = ?`, [tid]);
  return { id: tid, word: title.soz, deactivated: true, public: false };
}

/** Qálegen status=0 titledi qayta public qılıw (stub filtersiz). */
export async function reactivateTitle(titleId) {
  const tid = String(titleId || '').trim();
  if (!tid) throw httpError('titleId kerek');
  const [[title]] = await db.query(`SELECT id, soz, status FROM titles WHERE id = ? LIMIT 1`, [tid]);
  if (!title) throw httpError('Sóz tabılmadı', 404);
  if (Number(title.status) === 1) {
    return { id: tid, word: title.soz, activated: false, public: true };
  }
  await db.query(`UPDATE titles SET status = 1 WHERE id = ?`, [tid]);
  return { id: tid, word: title.soz, activated: true, public: true };
}

/** Bir yamasa kóp ghost titledi public (status=1) qılıw. */
export async function activateGhostTitles(titleIds) {
  const ids = [...new Set((Array.isArray(titleIds) ? titleIds : []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) throw httpError('titleIds kerek');
  if (ids.length > 50) throw httpError('Birden 50 titlege shekem');

  const placeholders = ids.map(() => '?').join(',');
  const [eligible] = await db.query(
    `SELECT DISTINCT t.id, t.soz AS word
     FROM titles t
     INNER JOIN description d ON d.titles_id = t.id
     WHERE t.status = 0 AND t.id IN (${placeholders}) AND ${GHOST_STUB_SQL}`,
    ids
  );
  if (!eligible.length) return { activated: 0, titleIds: [] };

  const activateIds = eligible.map((r) => r.id);
  const actPlaceholders = activateIds.map(() => '?').join(',');
  const [result] = await db.query(
    `UPDATE titles SET status = 1 WHERE status = 0 AND id IN (${actPlaceholders})`,
    activateIds
  );
  return {
    activated: Number(result.affectedRows) || 0,
    titleIds: activateIds,
    words: eligible.map((r) => r.word),
  };
}

/** Import key bilan qo‘lda tasdiqlash — approve titledi aktivlestiredi (public). */
export async function moderateSuggestion(suggestionId, { approve, note = null }) {
  const [[sug]] = await db.query(`SELECT * FROM community_suggestions WHERE id = ?`, [suggestionId]);
  if (!sug) throw httpError('Usınıs tabılmadı', 404);
  if (sug.status !== 'pending') throw httpError('Aldın sheshilgen', 409);

  if (!approve) {
    await db.query(
      `UPDATE community_suggestions SET status = 'rejected', moderator_note = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [note, suggestionId]
    );
    return { status: 'rejected' };
  }

  let senseHint = null;
  if (sug.description_id) {
    const desc = await findDescription(sug.description_id);
    senseHint = desc?.description || null;
  }

  const conn = await db.getConnection();
  let resolvedTitleId = null;
  try {
    await conn.beginTransaction();
    if (sug.suggestion_type === 'synonym') {
      const [groupRes] = await conn.query(`INSERT INTO synonym_groups (note) VALUES (?)`, [
        note || `from suggestion ${suggestionId}`,
      ]);
      const groupId = groupRes.insertId;
      let targetDescId = sug.suggested_description_id;
      if (!targetDescId) {
        const title = await resolveOrCreateSuggestionTitle(sug.suggested_word, {
          senseHint,
        });
        resolvedTitleId = title.id;
        targetDescId = await ensureDescriptionForTitle(conn, title, {
          word: sug.suggested_word,
          senseHint,
        });
      }
      await conn.query(
        `INSERT IGNORE INTO synonym_group_descriptions (group_id, description_id) VALUES (?, ?), (?, ?)`,
        [groupId, sug.description_id, groupId, targetDescId]
      );
    } else if (sug.suggestion_type === 'antonym') {
      let targetDescId = sug.suggested_description_id;
      if (!targetDescId) {
        const title = await resolveOrCreateSuggestionTitle(sug.suggested_word, {
          senseHint,
        });
        resolvedTitleId = title.id;
        targetDescId = await ensureDescriptionForTitle(conn, title, {
          word: sug.suggested_word,
          senseHint,
        });
      }
      const a = sug.description_id < targetDescId ? sug.description_id : targetDescId;
      const b = sug.description_id < targetDescId ? targetDescId : sug.description_id;
      await conn.query(
        `INSERT IGNORE INTO description_antonyms (description_id_a, description_id_b, note) VALUES (?, ?, ?)`,
        [a, b, note]
      );
    } else if (sug.suggestion_type === 'compound') {
      const component = await resolveOrCreateSuggestionTitle(sug.suggested_word, {
        senseHint: null,
      });
      resolvedTitleId = component.id;
      await ensureDescriptionForTitle(conn, component, {
        word: sug.suggested_word,
        senseHint: null,
      });
      await conn.query(
        `INSERT IGNORE INTO compound_words (main_title_id, component_title_id, sort_order) VALUES (?, ?, ?)`,
        [sug.main_title_id, component.id, sug.component_sort_order || 1]
      );
    }
    await conn.query(
      `UPDATE community_suggestions SET status = 'approved', moderator_note = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [note, suggestionId]
    );
    await conn.commit();
    return {
      status: 'approved',
      titleId: resolvedTitleId,
      public: true,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
