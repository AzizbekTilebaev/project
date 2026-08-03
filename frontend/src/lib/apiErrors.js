/**
 * API xabarların qaraqalpaq latin/kirill UI-ǵa sáykeslestiriw.
 * Kod bar bolsa — kanonikalıq latin tekst; joq bolsa — server xabarı.
 */
export const API_ERROR_MESSAGES = {
  ADAPTIVE_EMPTY_BANK: 'Adaptiv bankada jetkilikli soraw joq',
  GUEST_WORD_LIMIT: 'Sózlik oqıw erkin',
  GUEST_QUIZ_LIMIT: 'Testler sheksiz — dizim ixtıyarıy',
  GUEST_CROSSWORD_BLOCK: 'Krossvord sheksiz — dizim ixtıyarıy',
  INSUFFICIENT_POINTS: 'Ball jeterli emes',
  ANSWER_REVIEW_LOCKED: 'Juwaplar ashılmaǵan — dáslep ball menen ashıń',
  QUIZ_ATTEMPT_NOT_FOUND: 'Urınıw tabılmadı',
  QUIZ_NOT_FOUND: 'Test tabılmadı',
  ADMIN_FORBIDDEN: 'Ruxsat jeterli emes',
  UNAUTHORIZED: 'Kiriw kerek',
  GOOGLE_NOT_CONFIGURED: 'Google kiriw házirshe sozlanbaǵan',
  GOOGLE_TOKEN_INVALID: 'Google token tekshiruwden ótpedi',
  GOOGLE_EMAIL_MISMATCH: 'Google email házirgi akkaunt menen sáykes kelmeydi',
  GOOGLE_UNLINK_NEEDS_PASSWORD: 'Aldın qupıya sóz ornatıń — Google sıńırıwdan aldın',
  FEATURE_DISABLED: 'Bul funkciya házirshe óshirip qoyılǵan',
};

export function apiErrorMessage(data, status) {
  if (data?.code && API_ERROR_MESSAGES[data.code]) {
    return API_ERROR_MESSAGES[data.code];
  }
  const raw = data?.message || data?.error;
  if (raw) return String(raw);
  return `Server qáteligi: ${status}`;
}

export function makeApiError(data, status) {
  const err = new Error(apiErrorMessage(data, status));
  err.status = status;
  err.code = data?.code || null;
  err.payload = data || {};
  return err;
}
