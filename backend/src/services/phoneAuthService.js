/**
 * Telefon OTP / SMS — tayyor, default OFF (pullik).
 * AUTH_SMS_ENABLED=1 + TWILIO_* bo‘lsa haqiqiy SMS; aks holda faqat log.
 */
import crypto from 'crypto';
import { pools } from '../config/db.js';
import { authFeatures, requireFeature } from '../config/authFeatures.js';

const db = pools.users;

export async function ensurePhoneAuthSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS phone_otp_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      phone_e164 VARCHAR(20) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      purpose ENUM('login','verify','link') NOT NULL DEFAULT 'verify',
      user_id BIGINT UNSIGNED NULL,
      expires_at DATETIME NOT NULL,
      consumed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_phone_otp_phone (phone_e164),
      KEY idx_phone_otp_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits.slice(0, 20);
  if (digits.startsWith('998') && digits.length >= 12) return `+${digits.slice(0, 15)}`;
  if (digits.startsWith('9') && digits.length === 9) return `+998${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function deliverSms({ to, body }) {
  const features = authFeatures();
  if (!features.phoneSms) {
    console.info(`[sms:disabled] → ${to}\n${body}`);
    return { delivered: false, channel: 'log' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  const from = process.env.TWILIO_FROM_NUMBER || '';
  if (!sid || !token || !from) {
    console.warn('[sms] TWILIO_* sozlanmagan — log only');
    console.info(`[sms:fallback] → ${to}\n${body}`);
    return { delivered: false, channel: 'log' };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.warn('[sms] Twilio fail', res.status, t.slice(0, 200));
    return { delivered: false, channel: 'twilio' };
  }
  return { delivered: true, channel: 'twilio' };
}

/** Create + send OTP. Throws FEATURE_DISABLED if phoneLogin off. */
export async function requestPhoneOtp({ phone, purpose = 'verify', userId = null }) {
  requireFeature('phoneLogin');
  await ensurePhoneAuthSchema();
  const e164 = normalizePhone(phone);
  if (!/^\+\d{10,15}$/.test(e164)) {
    const err = new Error('Telefon nomeri dúris emes (+998...)');
    err.statusCode = 400;
    throw err;
  }

  const code = String(crypto.randomInt(100000, 999999));
  await db.query(
    `UPDATE phone_otp_codes SET consumed_at = NOW()
     WHERE phone_e164 = ? AND purpose = ? AND consumed_at IS NULL`,
    [e164, purpose]
  );
  await db.query(
    `INSERT INTO phone_otp_codes (phone_e164, code_hash, purpose, user_id, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [e164, hashOtp(code), purpose, userId]
  );

  const mail = await deliverSms({
    to: e164,
    body: `Qaraqalpaq kod: ${code} (10 min)`,
  });

  const out = {
    success: true,
    phone: e164,
    mailed: mail.delivered,
    message: 'Kod jiberildi (yamasa server logında).',
  };
  // Productionda OTP hech qachon HTTP javobida chiqmaydi
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_EXPOSE_OTP !== '0') {
    out.devCode = code;
  }
  return out;
}

export async function verifyPhoneOtp({ phone, code, purpose = 'verify', userId = null }) {
  requireFeature('phoneLogin');
  await ensurePhoneAuthSchema();
  const e164 = normalizePhone(phone);
  let sql = `SELECT id, user_id AS userId FROM phone_otp_codes
     WHERE phone_e164 = ? AND purpose = ? AND code_hash = ?
       AND consumed_at IS NULL AND expires_at > NOW()`;
  const params = [e164, purpose, hashOtp(code)];
  if (userId != null) {
    sql += ` AND (user_id IS NULL OR user_id = ?)`;
    params.push(userId);
  }
  sql += ` ORDER BY id DESC LIMIT 1`;
  const [rows] = await db.query(sql, params);
  const row = rows[0];
  if (!row) {
    const err = new Error('Kod qáte yamasa waqtı ótken');
    err.statusCode = 400;
    throw err;
  }
  if (userId != null && row.userId != null && Number(row.userId) !== Number(userId)) {
    const err = new Error('Kod qáte yamasa waqtı ótken');
    err.statusCode = 400;
    throw err;
  }
  await db.query(`UPDATE phone_otp_codes SET consumed_at = NOW() WHERE id = ?`, [row.id]);
  return { ok: true, phone: e164 };
}

export { normalizePhone };
