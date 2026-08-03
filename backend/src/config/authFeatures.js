/**
 * Auth feature flags — pullik/SMS qismlar default OFF.
 * Keyinroq .env da 1 qilib yoqiladi.
 */
function flag(name, defaultOn = false) {
  const v = String(process.env[name] ?? '').trim().toLowerCase();
  if (!v) return defaultOn;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function authFeatures() {
  return {
    /** Google People API: manzil, telefon, tug‘ilgan kun (qo‘shimcha ruxsat) */
    googlePeopleSync: flag('AUTH_GOOGLE_PEOPLE'),
    /** TOTP (Authenticator) — bepul, SMS kerak emas */
    totp2fa: flag('AUTH_TOTP_2FA'),
    /** SMS orqali OTP / telefon bilan kiriw — pullik (Twilio va h.k.) */
    phoneLogin: flag('AUTH_PHONE_LOGIN'),
    phoneSms: flag('AUTH_SMS_ENABLED'),
    /** Profilda tayyor UI ko‘rsatish (ishlamasa ham) */
    showPrepUi: flag('AUTH_SHOW_PREP_UI', true),
  };
}

export function requireFeature(name) {
  const f = authFeatures();
  if (!f[name]) {
    const err = new Error('Bul funkciya házirshe óshirip qoyılǵan');
    err.statusCode = 503;
    err.code = 'FEATURE_DISABLED';
    err.feature = name;
    throw err;
  }
}
