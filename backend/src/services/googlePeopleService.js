/**
 * Google People API — manzil / telefon / tug‘ilgan kun.
 * Oddiy Sign-In ID token bunda JOQ; alohida OAuth access token + scope kerak.
 * AUTH_GOOGLE_PEOPLE=1 bo‘lganda ishlaydi.
 */
import { requireFeature } from '../config/authFeatures.js';

const PEOPLE_URL =
  'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,phoneNumbers,addresses,birthdays,photos,locales';

/**
 * @param {string} accessToken - OAuth2 access token (GIS Token Client)
 */
export async function fetchGooglePeopleProfile(accessToken) {
  requireFeature('googlePeopleSync');
  if (!accessToken) {
    const err = new Error('Google access token kerek');
    err.statusCode = 400;
    throw err;
  }

  const res = await fetch(PEOPLE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error('Google People API oqilmadi');
    err.statusCode = res.status === 401 ? 401 : 502;
    err.code = 'GOOGLE_PEOPLE_FAILED';
    err.details = body.slice(0, 300);
    throw err;
  }
  const data = await res.json();
  return mapPeopleToProfile(data);
}

function mapPeopleToProfile(data) {
  const name =
    data.names?.[0]?.displayName ||
    [data.names?.[0]?.givenName, data.names?.[0]?.familyName].filter(Boolean).join(' ') ||
    '';
  const email = data.emailAddresses?.[0]?.value || null;
  const phone = data.phoneNumbers?.[0]?.value || null;
  const photo = data.photos?.[0]?.url || null;

  const addr = data.addresses?.[0];
  const location = addr
    ? [addr.streetAddress, addr.city, addr.region, addr.country].filter(Boolean).join(', ')
    : '';

  let birthday = null;
  const b = data.birthdays?.[0]?.date;
  if (b?.year && b?.month && b?.day) {
    birthday = `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`;
  }

  return {
    displayName: name.slice(0, 80),
    email: email ? String(email).toLowerCase() : null,
    phone: phone ? String(phone).slice(0, 40) : null,
    location: location.slice(0, 120),
    birthday,
    avatarUrl: photo,
    raw: {
      hasAddress: Boolean(addr),
      hasPhone: Boolean(phone),
      hasBirthday: Boolean(birthday),
    },
  };
}

/** GIS Token Client uchun scope ro‘yxati (frontend). */
export const GOOGLE_PEOPLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/user.phonenumbers.read',
  'https://www.googleapis.com/auth/user.addresses.read',
  'https://www.googleapis.com/auth/user.birthday.read',
].join(' ');
