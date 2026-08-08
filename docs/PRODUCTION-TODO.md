# Loyihani ishga tushirishga tayyorlash — to‘liq TODO

> Maqsad: **haqiqiy foydalanuvchilar** kira oladigan, ishonchli, kuzatiladigan production holatiga yetkazish.  
> Har band: **nima qilish** + **Definition of Done (DoD)**.

**Hozirgi holat:** Audit (xavfsizlik, mobil, DB/perf, UX, kod) yopilgan va sinalgan.  
**Qolgan:** asosan **deploy / infra / D-faza**. Kod kam — ops ko‘p.

**Status belgilari:** `[ ]` ochiq · `[~]` kod/hujjat tayyor, VPS’da DoD ochiq · `[x]` DoD yopilgan

---

## Umumiy hisob

| Blok | Band | Og‘irlik |
|------|------|----------|
| A — VPS/production | 5 | O‘rta |
| B — Kuzatuv / zaxira | 4 | Kichik–o‘rta |
| C — Push yuborish | 3 | O‘rta |
| D — Mustahkamlash | 5 | O‘rta–katta |
| E — Yuridik / oxirgi | 3 | Kichik |

---

## A. VPS / Production (BIRINCHI)

### [ ] A1. VPS tanlash va tayyorlash
- Node 20, MySQL 8, Nginx; kamida 2 vCPU / 2GB RAM.
- **DoD:** `node -v`, `mysql --version`, `nginx -v` ishlaydi.

### [~] A2. `.env` production qiymatlari
- `JWT_SECRET`, `ACTOR_HMAC_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` — `openssl rand -hex 32`.
- `FRONTEND_ORIGIN=https://haqiqiy-domen.uz` (`*` YO‘Q).
- `DB_POOL_LIMIT=4`; `ACTOR_WRITE_LIMIT=40` (yoki default 40).
- Lokal tekshiruv: `cd backend && npm run check:prod-env` (`.env` bo‘lsa).
- **DoD:** maydonlar namuna emas; `NODE_ENV=production` xatosiz ko‘tariladi.

### [ ] A3. MySQL + seed
```bash
cd backend && npm install
npm run setup && node scripts/setup-kk-databases.js
npm run setup-roles && npm run setup-points
```
- **DoD:** 10× `kk_*` bor; `npm run ready` OK.

### [~] A4. Systemd
- Namuna: [deploy/qp-api.service](deploy/qp-api.service) → `/etc/systemd/system/`.
- `ExecStartPre`: `ensure-search-indexes` + `seed-curated-from-db`; `Restart=always`.
- **DoD:** `systemctl status qp-api` → `active`; restart logida pre-skriptlar.

### [~] A5. Nginx + HTTPS
- Namuna: [deploy/nginx.example.conf](deploy/nginx.example.conf); certbot.
- **DoD:** `https://domen/api/health` ochiladi; HTTP→HTTPS.

---

## B. Kuzatuv va zaxira

### [~] B1. `ensure-search-indexes` (VPS’da qo‘lda birinchi marta)
```bash
npm run ensure-search-indexes
```
- **DoD:** `EXPLAIN … soz LIKE 'kitap%'` → `range`/`ref` (ALL emas).

### [~] B2. UptimeRobot
- Keyword `"status":"ok"`, 5 daq; Telegram/email. Qadamlar: [OPS.md](deploy/OPS.md).
- **DoD:** sun’iy degraded/503 da 5–10 daq ichida alert.

### [~] B3. Cron backup
```cron
0 3 * * * cd /path/to/backend && npm run backup && rsync -a backups/ /mnt/external-disk/qp-backups/
```
- **DoD:** kamida 2 muvaffaqiyatli run; SQL + `uploads-*.tar.gz`.

### [x] B4. Restore drill (lokal PASS; VPS’da takrorlash)
- Lokal: `cd backend && npm run restore-drill` — `sim_kk_*` + `uploads-restore-drill` (asl buzilmaydi).
- 2026-08-08: STAMP `2026-08-08T10-51-53`, **~22s**, health/search/uploads **PASS** ([OPS.md](deploy/OPS.md)).
- **VPS DoD:** shu protokolni test serverda bir marta takrorlash.

---

## C. Push yuborish

### [ ] C1. FCM — `firebase-admin`, `sendPushNotification`
### [ ] C2. APNs — iOS bo‘lsa
### [ ] C3. Trigger (kun so‘zi / streak eslatma) + eskirgan token tozalash  
Token yig‘ish allaqachon bor (`POST /api/notifications/register-token`).

---

## D. Mustahkamlash

### [ ] D1. Rate-limit / WAF yuklama (`k6` / `ab`)
### [ ] D2. Sentry yoki `kk_logs` admin ko‘rinishi
### [~] D3. CI yashil — `docs-routes` + frontend build + backend test ([ci.yml](../.github/workflows/ci.yml))
### [ ] D4. Load test `/api/tusindirme/search` (P95 &lt;500ms, xato &lt;1%)
### [~] D5. PWA manifest — `frontend/public/manifest.webmanifest` (SW ixtiyoriy)

---

## E. Yuridik / oxirgi

### [x] E1. `/privacy` va `/terms` + footer havola
### [ ] E2. ROADMAP haftalik checklist (domen ochilgach)
### [ ] E3. 3–5 real foydalanuvchi smoke (Android + iOS Safari)

---

## Tavsiya etilgan tartib

1. **A** → sayt ochilsin  
2. **B4** restore drill  
3. **B1–B3** deploy bilan  
4. **E2–E3**  
5. **D1–D4** bir hafta ichida  
6. **C** retention  
7. **D5** (SW), qolganlar

Agent topshirig‘i: *«A blokdan boshlab, har band DoD’siga yetguncha; keyin B4.»*  
VPS credentialsiz lokal agent faqat `[~]`/`[x]` kod-hujjat qismini yopadi; A1–A5/B* DoD serverda yakunlanadi.

---

## Lokal production-sim (VPS’siz)

```bash
npm run sim:prod-local
# yoki: node scripts/local-prod-sim.mjs
```

Tekshiradi: `check:prod-env`, `FRONTEND_ORIGIN=*` → exit(1), `frontend build`,  
`NODE_ENV=production` start+restart + health/search, `npm run backup`,  
restore-drill → `sim_kk_*` (mavjud `kk_*` buzilmaydi), docker/nginx holati.

| Band | Lokal natija (2026-08-08) |
|------|---------------------------|
| check:prod-env / CORS * | PASS |
| prod start + restart | PASS (`:5010`) |
| frontend dist (+ Express static) | PASS |
| backup + restore-drill | PASS (10× `sim_kk_*`, titles=27630) |
| Docker toza MySQL (A3) | SKIP — docker yo‘q (ixtiyoriy keyin) |
| nginx -t | SKIP — CLI yo‘q; `docs/deploy/nginx.local-test.conf` tayyor |

VPS kelganda: A1, haqiqiy domen + Let’s Encrypt (A5), DNS — mantiq lokalda tasdiqlangan.
