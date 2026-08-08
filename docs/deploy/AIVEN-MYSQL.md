# Aiven MySQL — lokal `kk_*` ko‘chirish

Lokal ~190 MB; Aiven free 1 GB — sig‘adi. SSL **REQUIRED**.

## 1. Aiven Console

1. **Download CA certificate** → `backend/certs/aiven-ca.pem`
2. Connection information dan:
   - Host, Port (`16342`), User (`avnadmin`), Password (ko‘z ikonkasi)

Workbench ulanishi: SSL = Require / CA file = `aiven-ca.pem`.

## 2. Loyihada sozlash

```bash
cd backend
mkdir -p certs
# CA ni certs/aiven-ca.pem ga qo‘ying

cp .env.aiven.example .env.aiven
# .env.aiven ichida REMOTE_DB_PASS=... ni yozing
```

## 3. Migratsiya

```bash
# Avval faqat ulanish
npm run migrate:aiven:dry

# To‘liq dump (lokal) → restore (Aiven) — ~5–15 daqiqa
npm run migrate:aiven
```

Mavjud backupdan (qayta dump qilmasdan):

```bash
SKIP_DUMP=1 BACKUP_STAMP=2026-08-08T10-51-53 npm run migrate:aiven
```

## 4. Backend ni Aiven ga yo‘naltirish

`backend/.env` (lokal `.env` ni almashtiring yoki vaqtincha):

```env
DB_HOST=mysql-….c.aivencloud.com
DB_PORT=16342
DB_USER=avnadmin
DB_PASS=...
DB_SSL=REQUIRED
DB_SSL_CA=./certs/aiven-ca.pem
```

```bash
npm run dev
curl -s http://127.0.0.1:5000/api/health
```

## Workbench orqali (ixtiyoriy)

1. Server → Data Export → 10× `kk_*` → Self-Contained File(s)  
2. Aiven connection → Data Import → har bir `.sql`  
CLI skript odatda tezroq va `DEFINER` muammolarini tozalaydi.

## Eslatma

- Free plan inactivity da o‘chishi mumkin  
- Disk: migratsiyadan oldin Aiven Overview da bo‘sh joy borligini tekshiring  
- `.env.aiven` va `certs/*.pem` — gitga kiritilmasin  
