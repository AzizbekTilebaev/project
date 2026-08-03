import crypto from 'crypto';
import { pools } from '../config/db.js';

const db = pools.users;
const buckets = new Map();

function rate(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

export async function requireApiKey(req, res, next) {
  try {
    const raw =
      req.headers['x-api-key'] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : null);
    if (!raw || String(raw).length < 16) {
      return res.status(401).json({ success: false, error: 'API key kerek' });
    }
    const prefix = String(raw).slice(0, 8);
    const hash = crypto.createHash('sha256').update(String(raw)).digest('hex');
    const [[client]] = await db.query(
      `SELECT * FROM api_clients WHERE key_prefix = ? AND key_hash = ? AND active = 1 LIMIT 1`,
      [prefix, hash]
    );
    if (!client) {
      return res.status(401).json({ success: false, error: 'API key jaramlı emes' });
    }
    if (!rate(`rpm:${client.id}`, client.rpm || 600, 60_000)) {
      return res.status(429).json({ success: false, error: 'RPM limiti' });
    }
    if (!rate(`rpd:${client.id}`, client.rpd || 50000, 24 * 60 * 60 * 1000)) {
      return res.status(429).json({ success: false, error: 'Kúnlik limit' });
    }
    req.apiClient = {
      id: client.id,
      name: client.name,
      tier: client.tier,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export async function createApiClient({ name, rpm = 600, rpd = 50000, tier = 'partner' }) {
  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(24).toString('hex');
  const prefix = secret.slice(0, 8);
  const keyHash = crypto.createHash('sha256').update(secret).digest('hex');
  await db.query(
    `INSERT INTO api_clients (id, name, key_prefix, key_hash, tier, rpm, rpd, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, String(name || 'partner').slice(0, 120), prefix, keyHash, tier, rpm, rpd]
  );
  return { id, name, apiKey: secret, prefix, rpm, rpd, tier };
}
