# Rivojlantirish yo‘l xaritasi — foydalanishga tayyorlash

Yangilangan: 2026-08-08

## Maqsad

Platformani **oddiy foydalanuvchi** (o‘quvchi, o‘qituvchi, mehmon) ochib, sozlik/oyin/qoida ishlata oladigan holatga keltirish.

---

## Hozirgi holat (qisqa)

| Tayyor | Zaif / keyingi |
|--------|----------------|
| Sozlik, test, krossvord, ádebiyat, ball | Server doim yoqilishi / deploy |
| `/qoidalar`, `/english` (MD) | Demo seed (bo‘sh DB) |
| First-run o‘yin eshiklari | Mobil PWA / offline |
| Auth, admin RBAC | Monitoring, backup avtomatik |
| Hujjatlar (`docs/`) | Public hosting + domen |

---

## Fazalar

### A — Ishlatish mumkin (lokal / server) ✅ / qisman

1. ~~Bosh sahifa API o‘chsa ham ochilsin~~ (curated majburiy emas)
2. `npm run ready` — muhit tekshiruvi
3. [FOYDALANISH.md](FOYDALANISH.md) — oddiy qo‘llanma
4. `npm run install:all` + MySQL + `setup-kk-*` — [SETUP.md](../SETUP.md)
5. Backup: `cd backend && npm run backup` ( muntazam cron)

### B — Birinchi jamoatchilik (1–2 hafta)

1. **VPS / hosting:** Node 20 + MySQL 8 + Nginx (`/` → SPA, `/api` → :5000)
2. Production `.env`: kuchli `JWT_*`, `ACTOR_*`, `ADMIN_*`, `FRONTEND_ORIGIN=https://domen`
3. `npm run start:prod` yoki systemd service
4. HTTPS (Let’s Encrypt)
5. Kunlik `mysqldump` cron → tashqi disk
6. Bo‘sh bazaga **minimal demo**: 50 curated + 1 quiz + 1 krossvord (seed skript)

### C — O‘rganish tajribasi (2–4 hafta)

1. Home → aniq «bugun nima qilaman» (check-in + 1 mashq)
2. Sozlik bo‘sh natija / xato matnlari QQ tilida
3. ~~Ingliz + qoidalar: har bo‘limda 1 mashq tugmasi~~
4. ~~Mobil nav: pastki tab (Sozlik / Oyın / Qoida)~~
5. Feedback forma ishlashi + admin ko‘rishi
6. **Push / eslatma:** token yig‘ish tayyor (`POST /api/notifications/register-token`). Real FCM/APNs yuborish — keyingi qadam (tutor `GET /reminder` faqat ma’lumot).
7. **Funnel event’lar** (`kk_statistika.learning_events`): `checkin_done`, `wod_game_started`, `quiz_completed` — «check-in’dan keyin necha % o‘yinga o‘tadi» savoli uchun. Dashboard/SQL keyingi qadam.

### D — Mustahkamlash

1. Rate-limit / WAF tekshiruv (actor-based limiter qo‘shildi — audit)
2. Sentry yoki oddiy error log dashboard
3. CI green (frontend build + backend test)
4. Load test asosiy `/api/tusindirme/search` + `npm run ensure-search-indexes`
5. ~~Privacy / foydalanish shartlari~~ — `/privacy`, `/terms` + footer
6. **UptimeRobot** (bepul): har 5 daq `GET /api/health` → Telegram/email  
7. Ishga tushirish bandlari: [PRODUCTION-TODO.md](PRODUCTION-TODO.md)

---

## Har hafta checklist

- [ ] `curl https://domen/api/health` — hammasi ok  
- [ ] Kun so‘zi + check-in ishlaydi  
- [ ] Bitta quiz va bitta krossvord ochiladi  
- [ ] `/qoidalar` va `/english` ochiladi  
- [ ] Backup bor (oxirgi 7 kun) — **SQL + `uploads/` tar**  
- [ ] systemd `qp-api` active (`Restart=always`)

---

## Keyingi kod ishlari (navbat)

| # | Ish | Fayda |
|---|-----|-------|
| 1 | ~~`npm run ready`~~ | Tez diagnostika |
| 2 | ~~Home resilient + sozlik/qoida CTA~~ | Mehmon «qora ekran» ko‘rmasin |
| 3 | ~~`npm run seed-curated-db` (backend)~~ | curated; systemd `ExecStartPre` |
| 4 | ~~Nginx + systemd namuna `docs/deploy/`~~ | Deploy oson |
| 5 | PWA manifest (ixtiyoriy) | Telefonda «o‘rnatish» |
| 6 | VPS + HTTPS + cron backup (DB+uploads) | Jamoatchilik ochish |
| 7 | Push (FCM/APNs) | Kunlik odat |
| 8 | ~~Actor rate-limit + WoD UTC cooldown~~ | Spoof / tz firibgarlik |

---

## O‘qish

- Ishlash: [QANDAY-ISHLAYDI.md](QANDAY-ISHLAYDI.md)
- Foydalanuvchi: [FOYDALANISH.md](FOYDALANISH.md)
- O‘rnatish: [SETUP.md](../SETUP.md)
