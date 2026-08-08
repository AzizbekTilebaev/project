# Ops — VPS deploy checklist

## 1. Systemd (qayta deploy da unutilmasin)

Namuna: [qp-api.service](qp-api.service)

```bash
sudo cp docs/deploy/qp-api.service /etc/systemd/system/qp-api.service
# WorkingDirectory / EnvironmentFile yo‘llarini tahrirlang
sudo systemctl daemon-reload
sudo systemctl enable --now qp-api
```

`ExecStartPre` (xato bo‘lsa ham start davom etadi, `-` prefiks):

1. `scripts/ensure-search-indexes.mjs` — titles prefiks indekslari  
2. `scripts/seed-curated-from-db.mjs` — curated bo‘sh bo‘lsa titles dan  

Qo‘lda bir marta:

```bash
cd /path/to/backend && npm run ensure-search-indexes && npm run seed-curated-db
```

---

## 2. UptimeRobot (yoki shunga o‘xshash)

| Sozlama | Qiymat |
|---------|--------|
| URL | `https://YOUR-DOMAIN/api/health` |
| Interval | **5 daqiqa** |
| Monitor turi | **Keyword** (faqat HTTP 200 yetarli emas) |
| Keyword | `"status":"ok"` (yoki `status":"ok`) |
| Alert | Telegram **va/yoki** email (bepul reja) |

Nima uchun keyword: ba’zi proxy/konfiglarda 503 o‘rniga 200 kelishi mumkin; tanada `"status":"ok"` bo‘lmasa ogohlantiradi.  
Degraded javob: `{ "status": "degraded", ... }` + HTTP 503.

---

## 3. Cron backup → tashqi disk

`npm run backup` yaratadi:

- `backend/backups/kk_*-STAMP.sql` — har bir baza  
- `backend/backups/uploads-STAMP.tar.gz` — PDF/audio/avatar  

```cron
# Har kuni 03:00 — dump + uploads, keyin tashqi diskka
0 3 * * * cd /var/www/proyekt2/backend && /usr/bin/npm run backup >> /var/log/qp-backup.log 2>&1 && rsync -a --delete backups/ /mnt/external-disk/qp-backups/
```

- `/mnt/external-disk` — alohida disk / NFS / S3-fuse.  
- `--delete` ixtiyoriy: tashqi nusxani lokal bilan sinxron tutadi (ehtiyot).  
- Lokal `backups/` ni gitga qo‘ymang.

### Restore drill (majburiy) — B4

Backup borligi yetarli emas — **izolyatsiyalangan** tiklash. Inqirozda birinchi marta sinamang.

#### 0) Xavfsizlik — qaysi yo‘l?

| Yo‘l | Qachon | Asl `kk_*` / `uploads` |
|------|--------|-------------------------|
| **A. `sim_*` + `uploads-restore-drill`** (default) | Docker yo‘q / lokal | **Tegilmaydi** |
| **B. Docker MySQL `:3308`** | `docker` bor | Tegilmaydi (boshqa port) |
| ❌ To‘g‘ridan `kk_*` ga restore | — | **Taqiqlanadi** (drill uchun) |

#### Lokal avtomatik (yo‘l A)

```bash
cd backend && npm run restore-drill
# --keep  → sim_* ni qoldirish; --stamp STAMP → aniq backup
```

DoD: backup → 10× `sim_kk_*` import → uploads drill papka → prod API (`:5011`) health + search + `/uploads/writers|avatars` → tozalash.  
Hisobot: `backups/RESTORE-DRILL-<stamp>.md`.

#### Docker variant (yo‘l B) — qo‘lda

```bash
docker run --name qp-mysql-restore-test -e MYSQL_ROOT_PASSWORD=test -p 3308:3306 -d mysql:8
# .env vaqtincha: DB_PORT=3308 (asl .env ni commit qilmang)
# npm run backup  # oldin asl portdan!
for f in backups/kk_*-STAMP.sql; do mysql -h127.0.0.1 -P3308 -uroot -ptest < "$f"; done
tar -xzf backups/uploads-STAMP.tar.gz -C public/
NODE_ENV=production npm run start:prod
# tekshiruv → docker rm -f qp-mysql-restore-test; .env portni qaytarish
```

#### VPS / to‘liq nusxa

```bash
for f in /mnt/external-disk/qp-backups/kk_*-STAMP.sql; do
  node scripts/restore-db.js "$f" || exit 1
done
tar -xzf .../uploads-STAMP.tar.gz -C public/
```

#### Oxirgi lokal drill qaydi

| Maydon | Qiymat |
|--------|--------|
| Sana | 2026-08-08 |
| Yo‘l | A (`sim_*`) |
| STAMP | `2026-08-08T10-51-53` |
| Davomiylik | **~22 s (~0.36 daq)** |
| Natija | **PASS** — health ok, search 3, writers PNG 200, books disk OK |
| Hisobot | `backend/backups/RESTORE-DRILL-2026-08-08T10-51-53.md` |

Har chorakda yoki major deploy dan keyin takrorlang.

---

## 4. Push infratuzilma (token yig‘ish)

- Jadval: `kk_users.device_tokens` (birinchi `register-token` da yaratiladi)  
- `POST /api/notifications/register-token` — FCM/APNs/web token saqlash  
- Real yuborish (FCM Admin / APNs) — ROADMAP **C.6**  

Mobil: login / first launch da token yuboring; yuborish logikasi keyin yoqiladi.
