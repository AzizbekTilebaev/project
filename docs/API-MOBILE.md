# Backend API — mobil ilova uchun to‘liq ma’lumotnoma

> Base (dev): `http://HOST:5000`  
> Base (prod): `https://your-domain` (Nginx → Node)  
> JSON: `Content-Type: application/json` · `Accept: application/json`  
> Partner (ixtiyoriy): [`backend/docs/public-api.md`](../backend/docs/public-api.md) — `/api/v1`  
> Umumiy arxitektura: [`QANDAY-ISHLAYDI.md`](QANDAY-ISHLAYDI.md)

**Mobil MVP uchun tavsiya:** Auth + Actor → Sozlik → Kun so‘zi → Quiz attempt → Points → (keyin) Crossword / Rooms.

**Jadval legendasi (Actor ustuni):**  
`✅` = `X-Anonymous-Id` yetarli · `🔒` = Bearer token shart · `opt` = ikkalasi ham mumkin (login bo‘lsa user, bo‘lmasa actor)

**Javob header:** `X-API-Version: 1` (server yozadi).  
Mijoz `X-API-Version` yuborishi **ixtiyoriy** — yo‘qligi yoki boshqa qiymat so‘rovni **rad etmaydi** (faqat log). Eski App Store buildlar ishlashi kerak.

---

## 1. Identifikatsiya (majburiy tushuncha)

### 1.1 Anonim actor — deyarli hamma o‘yin/sozlik

Har bir qurilmada **bir marta** UUID v4 yarating va saqlang (Keychain / EncryptedSharedPreferences).

```http
X-Anonymous-Id: 550e8400-e29b-41d4-a716-446655440000
```

- Format: UUID (aks holda 400).  
- Server HMAC bilan `actor` yaratadi (`ACTOR_HMAC_SECRET`).  
- Quiz start, krossvord, check-in, ball, kvota shu ID ga bog‘lanadi.  
- **O‘zgartirmang** — progress yo‘qoladi.  
- **Offline:** UUID generatsiyasi **tarmoqqa bog‘liq emas** — ilova ochilishi bilan local storage / Keychain da darhol yarating (internet kutmang).  
- **Xavfsizlik:** UUID bilinsa kvota/ball spoof mumkin; server actor-based rate-limit + check-in UTC cooldown qo‘llaydi. UUID ni log/crashlytics ga yozmang.

### 1.2 Foydalanuvchi (ixtiyoriy)

```http
Authorization: Bearer <token>
```

Token: `POST /api/auth/login` yoki `/register` javobidagi `token`.  
Sevimlilar / recent-words uchun **requireAuth**.  
**TTL:** `AUTH_SESSION_DAYS` (default **30** kun, max 30). **Refresh token yo‘q** — muddat tugagach qayta login. Mobil: «remember me» = shu uzoq TTL.

### 1.3 Tipik so‘rov

```http
GET /api/tusindirme/search?q=kitap&limit=20
X-Anonymous-Id: <uuid>
Authorization: Bearer <token>   # ixtiyoriy
Accept: application/json
```

### 1.4 CORS / native

Native (React Native, Flutter, Kotlin) da ko‘pincha `Origin` yo‘q — backend ruxsat beradi.  
WebView / Expo web uchun `FRONTEND_ORIGIN` ga ilova origin qo‘shing.  
**Production:** `FRONTEND_ORIGIN=*` **taqiqlangan** — aniq `https://domen` (vergul bilan bir nechta).

---

## 2. Xato formati

Ko‘p joylarda:

```json
{ "success": false, "error": "missing_anonymous_id", "message": "X-Anonymous-Id headeri kerek" }
```

| Maydon | Ma’no |
|--------|--------|
| `error` | Mashina uchun qisqa kod / texnik matn (i18n qilmang) |
| `message` | Foydalanuvchiga ko‘rsatish — odatda QQ tilida |

UI da **`message` ni afzal** qiling; yo‘q bo‘lsa `error`.

| HTTP | Ma’no |
|-----:|--------|
| 400 | Noto‘g‘ri body / UUID |
| 401 | Token kerak yoki yaroqsiz |
| 402 | Ball yetarli emas (review unlock) |
| 403 | Ruxsat yo‘q / kvota |
| 404 | Topilmadi |
| 429 | Rate limit / check-in cooldown |
| 503 | Health degraded (DB) |

---

## 3. Health

```http
GET /api/health
```

```json
{
  "success": true,
  "status": "ok",
  "checks": { "tusindirme": true, "quiz": true, "…" },
  "uptime": 123.4
}
```

Ilova ochilishida ping qiling.  
Uptime monitoring: keyword `"status":"ok"` (faqat HTTP 200 emas) — [deploy/OPS.md](deploy/OPS.md).

---

## 4. Auth — `/api/auth`

| Method | Path | Auth | Body / query | Izoh |
|--------|------|------|--------------|------|
| GET | `/config` | — | — | Google client id, flaglar |
| GET | `/me` | optional | — | User yoki mehmon holati |
| POST | `/register` | actor | `{ email, password, displayName? }` | `token` qaytaradi |
| POST | `/login` | actor | `{ email, password }` | `token` yoki TOTP challenge |
| POST | `/login/totp` | actor | `{ challengeToken, code }` | 2FA |
| POST | `/google` | actor | `{ credential, nonce? }` | Google ID token |
| POST | `/google/link` | Bearer | `{ credential }` | Akkountga bog‘lash |
| POST | `/google/unlink` | Bearer | — | |
| POST | `/forgot-password` | — | `{ email }` | |
| POST | `/reset-password` | actor | `{ token, password }` | |
| POST | `/change-password` | Bearer | `{ currentPassword, newPassword }` | |
| PUT | `/profile` | Bearer | profil maydonlari | |
| POST | `/avatar` | Bearer | `multipart` file | |
| DELETE | `/avatar` | Bearer | — | |
| POST | `/logout` | optional | — | |
| DELETE | `/sessions/others` | Bearer | — | Boshqa sessiyalar |
| GET | `/security/status` | optional | — | TOTP/phone flag |
| POST | `/security/totp/*` | Bearer | | begin/confirm/disable |
| POST | `/phone/request-otp` | — | | Flag bilan |
| POST | `/phone/verify-otp` | actor | | |

**Login muvaffaqiyat (tipik):**

```json
{
  "success": true,
  "token": "…",
  "user": { "id": 1, "email": "a@b.c", "displayName": "…" }
}
```

---

## 5. Sozlik — `/api/tusindirme` ⭐ mobil asos

Har doim `X-Anonymous-Id` yuboring (`/soz/:id`, check-in, quiz majburiy).

| Method | Path | Actor | Tavsif |
|--------|------|:-----:|--------|
| GET | `/search?q=&limit=` | — | Qidiruv |
| GET | `/soz/:id` | ✅ + kvota | So‘z tafsiloti |
| GET | `/curated` | — | Tanlangan so‘zlar |
| GET | `/random` | — | Tasodifiy |
| GET | `/letter/:letter?page=&limit=` | — | Harf bo‘yicha |
| GET | `/alphabet` | — | Alifbo |
| GET | `/pos` | — | So‘z turkumi |
| GET | `/themes` | — | Mavzular |
| GET | `/dashboard` | — | Dashboard agregat |
| GET | `/top` | — | Top so‘zlar |
| GET | `/word-of-day` | — | Kun so‘zi |
| GET | `/word-of-day/checkin?tzOffset=` | ✅ | Check-in holati |
| POST | `/word-of-day/checkin` | ✅ | `{ tzOffset }` da’vo |
| POST | `/word-of-day/chest/claim` | ✅ | Combo chest `{ chestId, tzOffset }` |
| POST | `/quiz/start` | ✅ | Dict mini-quiz |
| POST | `/quiz/:roundId/check` | ✅ | Javob tekshiruv |
| POST | `/quiz/:roundId/answer` | ✅ | Javob yozish |
| GET | `/quiz/history` | ✅ | Tarix |
| GET | `/suggestions` | opt | Community |
| POST | `/suggestions` | ✅ | Taklif |
| POST | `/suggestions/:id/vote` | ✅ | Ovoz |

`tzOffset` = `-new Date().getTimezoneOffset()` (daqiqa) — faqat «bugun» ko‘rsatish.  
Claim himoyasi: server UTC bo‘yicha oxirgi claim dan ~20 soat (`WOD_MIN_CLAIM_HOURS`); soatni surib bir kun ichida bir necha claim qilib bo‘lmaydi.

**Qidiruv misol:**

```http
GET /api/tusindirme/search?q=aman&limit=20
X-Anonymous-Id: …
```

Javob odatda `{ data: [ { id, soz, … } ], … }` shaklida (maydonlar versiyaga qarab).

**So‘z ochish:**

```http
GET /api/tusindirme/soz/12345
X-Anonymous-Id: …
```

Kvota tugasa 403 — `/api/quotas/me` ni ko‘ring.

### Moderator / import (mobilga kerak emas)

`/ghost-titles`, `/compounds`, `/relations/*`, `/import-nested` — admin/moderator + `IMPORT_API_KEY`.

---

## 6. Qo‘shimcha lug‘atlar — `/api/dicts`

Public GET (actor shart emas, lekin yuborish mumkin).

| Path | Tavsif |
|------|--------|
| `GET /stats` | Statistika |
| `GET /kaa-months`, `/kaa-culture` | Madaniyat |
| `GET /uzb-kaa`, `/uzb-kaa/search`, `/uzb-kaa/:id` | UZ↔QQ |
| `GET /en`, `/en/search`, `/en/:id` | EN |
| `GET /ru`, `/ru/search`, `/ru/:id` | RU |
| `GET /frazeologiya`, `/search`, `/:id` | Frazeologizm |
| `GET /adam-atlari`, `/search`, `/:id` | Ism |
| `GET /imla`, `/imla/search`, `/imla/letters`, `/imla/sources`, `/imla/:id` | Imla |
| `GET /links/:titleId` | So‘z bog‘lanishlari |

---

## 7. Morfologiya — `/api/morphology`

```http
GET /api/morphology/analyze?word=kitaplar&script=lat&verify=1
```

Javob: segmentlar (túbir + qo‘shimtalar). WordDetail uchun.

---

## 8. Quiz — `/api/quizzes` ⭐

**Muhim:** `GET /:id` javob kalitini bermaydi. Baholash faqat serverda.

### Oqim

```
1. GET  /api/quizzes
2. POST /api/quizzes/:id/start     + X-Anonymous-Id
3. POST /api/quizzes/attempts/:attemptId/view   { position }
4. POST /api/quizzes/attempts/:attemptId/answer { questionId, optionIndex, timeSpentMs }
5. POST /api/quizzes/attempts/:attemptId/finalize
6. GET  /api/quizzes/attempts/:attemptId/result
```

| Method | Path | Actor | Izoh |
|--------|------|:-----:|------|
| GET | `/` | — | Ro‘yxat |
| GET | `/:id` | opt | Savollar **javobsiz** |
| POST | `/:id/start` | ✅ | `{ ageConsent?, ageYears? }` → attempt |
| GET | `/:id/active` | ✅ | Davom etish |
| GET | `/attempts` | ✅ | Mening urinishlarim |
| GET | `/attempts/:attemptId` | ✅ | |
| POST | `/attempts/:id/view` | ✅ | Savolni ochish |
| POST | `/attempts/:id/answer` | ✅ | |
| POST | `/attempts/:id/finalize` | ✅ | `{ partial? }` |
| GET | `/attempts/:id/result` | ✅ | Natija |
| GET | `/attempts/:id/review-status` | ✅ | Review narxi |
| POST | `/attempts/:id/unlock-review` | ✅ | Ball evaziga (402?) |
| GET | `/attempts/:id/review` | ✅ | To‘liq tahlil |
| POST | `/adaptive/start` | ✅ | IRT adaptiv |
| POST | `/adaptive/:attemptId/answer` | ✅ | |
| POST | `/adaptive/:attemptId/abandon` | ✅ | |
| GET | `/ability` | ✅ | |
| GET | `/statistics/me` | ✅ | |
| POST | `/privacy/consent` | ✅ | Yosh roziligi |
| DELETE | `/privacy/me` | ✅ | Ma’lumot o‘chirish |
| ~~POST `/:id/submit`~~ | — | — | **O‘chirilgan** — faqat attempt flow |

---

## 9. Krossvord — `/api/crosswords`

| Method | Path | Actor |
|--------|------|:-----:|
| GET | `/` | — |
| GET | `/:id` | ✅ |
| POST | `/:id/guess` | ✅ |
| POST | `/:id/complete` | ✅ |
| GET | `/stats/me` | ✅ |

Admin CRUD: `/admin/*` — mobil mijozga kerak emas.

---

## 10. Multiplayer xona — `/api/rooms` + Socket.IO

### REST

| Method | Path | Actor |
|--------|------|:-----:|
| POST | `/` | ✅ | Xona yaratish |
| POST | `/join` | ✅ | `{ code }` |
| GET | `/open` | ✅ | Ochiq xonalar |
| GET | `/:code` | ✅ | Holat |
| POST | `/:code/start` | ✅ | |
| GET | `/:code/quiz` | ✅ | |
| POST | `/:code/quiz/answer` | ✅ | |
| POST | `/:code/crossword/guess` | ✅ | |
| POST | `/:code/ready` | ✅ | |
| POST | `/:code/leave` | ✅ | |

### Socket.IO

- URL: same origin, path `/socket.io`
- Handshake: `auth: { anonymousId: "<uuid>" }` yoki header `x-anonymous-id`
- Events (asosiy): `room:subscribe`, `room:unsubscribe`, `room:ready`, `room:leave` → server `room:state` emit qiladi

Batafsil: `backend/src/realtime/gameSocket.js`.

---

## 11. Ball — `/api/points`

| Method | Path | Actor |
|--------|------|:-----:|
| GET | `/me` | ✅ | Balans, daraja |
| GET | `/me/history` | ✅ | |
| PUT | `/me/profile` | ✅ | Display name va h.k. |
| GET | `/leaderboard` | — | |

---

## 12. Kvota / statistika / feedback

### `/api/quotas`

| GET `/me` | Actor | Qolgan limit |
| POST `/word-view` | Actor | So‘z ko‘rish hisobi |

### `/api/stats`

| GET `/me/activity` | Actor |
| GET `/site` | optional |
| POST `/heartbeat` | Actor | Ilova ochiqligi |

### `/api/feedback`

| POST `/exit` | optional | Chiqish so‘rovi |

### `/api/notifications` — push token (yuborish keyinroq)

| Method | Path | Actor | Body |
|--------|------|-------|------|
| POST | `/register-token` | ✅ (+ Bearer opt) | `{ token, platform: "fcm"\|"apns"\|"web", appVersion?, deviceLabel? }` |
| POST | `/unregister-token` | ✅ | `{ token }` |

Token `kk_users.device_tokens` da. Real FCM/APNs yuborish — ROADMAP C.6.

---

## 13. Sevimlilar / so‘nggi so‘zlar (login kerak)

### `/api/favorites` — Bearer

| GET `/` | Ro‘yxat |
| POST `/` | Qo‘shish |
| POST `/sync` | Sinxron |
| DELETE `/:titleId` | O‘chirish |
| DELETE `/` | Tozalash |

### `/api/recent-words` — Bearer

| GET `/` | |
| POST `/` | |
| POST `/sync` | |
| DELETE `/` | |

---

## 14. Kitoblar — `/api/books`

| GET `/` | Ro‘yxat |
| GET `/:id` | Tafsilot |
| GET `/:id/file` | Fayl (imzolangan/auth oqim) |
| GET `/progress/me` | Actor |
| GET|PUT `/:id/progress` | Actor |

Admin upload — mobil odatda kerak emas.

---

## 15. Ádebiyat — `/api/literature`

Public GET (writers, pieces, …) + admin POST/PUT/DELETE.  
Mobil: asosan **GET** ro‘yxat/detail. Aniq pathlar: `literatureRoutes.js`.

---

## 16. Jumbaqlar — `/api/jumbaqlar`

GET list/detail + progress PUT/POST (actor). Admin CRUD alohida.

---

## 17. O‘qish darsi — `/api/reading`

Darslar, SRS, progress — actor kerak bo‘lgan endpointlar ko‘p.  
`readingRoutes.js` dagi GET/POST juftliklari.

---

## 18. Tutor — `/api/tutor` (actor)

| GET `/daily` | Kunlik reja |
| POST `/daily/answer` | Javob |
| PUT `/daily/plan` | |
| PUT `/daily/schedule` | |
| GET `/mistakes` | Xato banki |
| GET `/reminder` | Eslatma |

---

## 19. Immersion — `/api/immersion`

| GET `/ready` | Tayyor so‘zlar |
| GET `/word/:titleId` | |
| POST `/listen` | Actor |
| POST `/produce` | Actor |
| GET `/:id`, `/:id/file` | Audio |

---

## 20. Partner API — `/api/v1` (ixtiyoriy)

Agar o‘z backendingiz orqali cheklangan o‘qish kerak bo‘lsa:

- `X-Api-Key` yoki Bearer API key  
- `GET /manifest`, `/dictionary/search`, `/dictionary/words/:id`, `/quizzes`, `/quizzes/:id`  
- Kalit: `POST /api/v1/clients` + `X-Import-Key` (serverda, ilovada emas)

Batafsil: [`backend/docs/public-api.md`](../backend/docs/public-api.md).

---

## 21. Admin — `/api/admin`

Mobil **foydalanuvchi** ilovasiga qo‘shmang (login, accounts, logs, RBAC).

---

## 22. Statik fayllar

| Path | Holat |
|------|--------|
| `/uploads/avatars/*` | Ochiq — fayl nomi `a-{timestamp}-{random}.ext` (enumerate qiyin) |
| `/uploads/writers/*` | Ochiq |
| `/uploads/books/*` | **403** — faqat API file URL |
| `/uploads/immersion/*` | **403** — API orqali |

---

## 23. Mobil MVP checklist

1. UUID **offline** yaratish + local saqlash + har so‘rovda `X-Anonymous-Id`  
2. `GET /api/health`  
3. `GET /api/tusindirme/search` + `/soz/:id`  
4. Kun so‘zi + check-in (tzOffset faqat UI; server UTC cooldown)  
5. Quiz: start → answer → finalize → result (**`POST /quizzes/:id/submit` o‘chirilgan**)  
6. `GET /api/points/me`  
7. (Ixtiyoriy) login + favorites; token ~30 kun, refresh yo‘q  
8. `POST /api/notifications/register-token` (FCM/APNs token yig‘ish)  
9. (Keyin) crossword, rooms+socket, books  

**Qoidalar / English** webda MD — alohida API yo‘q. Mobil uchun: CMS sifatida MD ni bundlega qo‘shing yoki keyinroq o‘z endpointingizni qo‘shasiz.

---

## 24. Rate limit

`/api` umumiy limiter — kalit **actor HMAC** (UUID bo‘lsa) yoki IP.  
Qidiruv / login / check-in (`actorWriteLimiter`) alohida qattiqroq. 429 da exponential backoff.

---

## 25. Kod manbalari (haqiqat)

| Modul | Fayl |
|-------|------|
| Mount | `backend/src/server.js` |
| Auth | `routes/authRoutes.js` |
| Sozlik | `routes/tusindirmeRoutes.js` |
| Quiz | `routes/quizRoutes.js` |
| Rooms | `routes/gameRoomRoutes.js` + `realtime/gameSocket.js` |
| Actor | `middleware/actor.js` |
| FE namuna | `frontend/src/api/*.js` |

---

*Yangilangan: 2026-08-08 (security/ops audit). Endpoint qo‘shilsa — shu fayl + tegishli `*Routes.js` ni yangilang.*
