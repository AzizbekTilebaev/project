# tusindirme_sozlik – Ma'lumotlar bazasi strukturasi

## Umumiy ma'lumot
- **Baza nomi:** `tusindirme_sozlik`
- **Dvigatel:** InnoDB (barcha jadvallar uchun)
- **Belgilar to‘plami:** utf8mb4_unicode_ci (emoji, maxsus belgilarni qo‘llab-quvvatlaydi)
- **Jadvallar soni:** 13 ta asosiy jadval + 1 ta foydalanuvchilar jadvali

---

## 1. Asosiy jadvallar

### 1.1. `titles` – So‘zlar
Lug‘atdagi har bir bosh so‘z shu yerda saqlanadi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID – har bir so‘zning noyob identifikatori |
| temp_id | VARCHAR(50) | Vaqtinchalik ID (import/eksport uchun) |
| soz | VARCHAR(255) | So‘zning asl yozilishi |
| normalized | VARCHAR(255) | So‘zning normallashtirilgan shakli (masalan, kichik harflarda) |
| order | INT | Tartib raqami |
| st_let | CHAR(1) | So‘zning birinchi harfi (alifbo bo‘yicha saralash uchun) |
| status | TINYINT | So‘z holati (1 - faol, 0 - nofaol) |
| user_id | INT | So‘zni qo‘shgan foydalanuvchi (users.id ga bog‘lanadi) |
| views_count | INT | Ko‘rilganlar soni |
| search_count | INT | Qidirilganlar soni |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Indekslar:** `id` (birlamchi kalit), `soz`, `normalized`, `st_let`, `created_at`, `user_id`

**Foreign key:** yo‘q (lekin `user_id` mantiqiy bog‘langan)

---

### 1.2. `description` – So‘z izohlari (ma’nolari)
Har bir so‘z (`titles`) bir nechta izohga ega bo‘lishi mumkin. Masalan, “ko‘z” so‘zining bir necha ma’nosi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID – izoh identifikatori |
| temp_id | VARCHAR(50) | Vaqtinchalik ID |
| titles_id | VARCHAR(36) | Qaysi so‘zga tegishli (titles.id) |
| order | INT | Izoh tartibi (1,2,3...) |
| categorys_id | INT | Qaysi kategoriyaga tegishli (categorys.id) |
| description | TEXT | Izoh matni |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Indekslar:** `id` (PK), `temp_id`, `titles_id`, `categorys_id`, `created_at`, `order`

**Foreign keylar:**
- `description_ibfk_1`: `titles_id` → `titles.id` (ON DELETE CASCADE)
- `description_ibfk_2`: `categorys_id` → `categorys.id` (ON DELETE SET NULL)

---

### 1.3. `translations` – Izohlarning tarjimalari
Har bir izoh (`description`) uchun turli tillardagi tarjimalar.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | INT AUTO_INCREMENT | Avtomatik raqam |
| descriptionId | VARCHAR(36) | Qaysi izohga tegishli (description.id) |
| lang | ENUM('UZ','RU','EN','KK','TK') | Tarjima tili |
| translation | TEXT | Tarjima matni |
| createdAt | DATETIME | Yaratilgan vaqti |

**Indekslar:** `id` (PK), `descriptionId` (foreign key indeksi)

**Foreign key:** `fk_tr_desc`: `descriptionId` → `description.id` (ON DELETE CASCADE)

---

### 1.4. `categorys` – Kategoriyalar
Izohlarni guruhlash uchun ishlatiladi (masalan: “anatomiya”, “tibbiyot”, “adabiyot”).

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | INT AUTO_INCREMENT | Kategoriya ID |
| temp_id | VARCHAR(50) | Vaqtinchalik ID |
| name | VARCHAR(100) | Kategoriya nomi |
| code | VARCHAR(50) | Qisqacha kod (slug) |
| description | TEXT | Kategoriya haqida qo‘shimcha |
| questions | TEXT | Savollar (savol-javob uchun) |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Indekslar:** `id` (PK), `temp_id`, `code`

---

## 2. Qo‘shimcha jadvallar (boyitilgan kontent)

### 2.1. `examples` – Misollar
Izohlarga hayotiy misollar biriktirish uchun.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| temp_id | VARCHAR(50) | Vaqtinchalik ID |
| descriptions_id | VARCHAR(36) | Qaysi izohga tegishli (description.id) |
| order | INT | Tartib raqami |
| example | TEXT | Misol matni |
| author | VARCHAR(255) | Muallif (ismi) |
| author_id | INT | Muallif ID |
| is_approved | TINYINT | Tasdiqlanganmi? (1-ha, 0-yo‘q) |
| user_id | INT | Kim qo‘shgan (users.id) |
| target_start_index | INT | So‘zning gapdagi boshlanish pozitsiyasi |
| target_end_index | INT | So‘zning gapdagi tugash pozitsiyasi |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Foreign key:** `descriptions_id` → `description.id` (ON DELETE CASCADE)

---

### 2.2. `etimologiya` – So‘zning kelib chiqishi
So‘zning qayerdan kelib chiqqanligi haqida ma’lumot.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| title_id | VARCHAR(36) | Qaysi so‘zga tegishli (titles.id) |
| etymology_type | ENUM | 'native','borrowed','derivative','compound','unknown' |
| original_language | VARCHAR(100) | Asl til |
| root_word | VARCHAR(255) | Ildiz so‘z |
| description | TEXT | Izoh |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Foreign key:** `title_id` → `titles.id` (ON DELETE CASCADE)

---

### 2.3. `idioms` – Idiomalar (frazalar)
So‘zga aloqador iboralar.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| description_id | VARCHAR(36) | Qaysi izohga tegishli (description.id) |
| phrase | VARCHAR(255) | Iboraning o‘zi |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Foreign key:** `description_id` → `description.id` (ON DELETE CASCADE)

---

### 2.4. `idiom_desc` – Idioma izohlari
Iboraning ma’nosi va tushuntirishi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| idioms_id | VARCHAR(36) | Qaysi idiomaga tegishli (idioms.id) |
| description | TEXT | Izoh matni |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Foreign key:** `idioms_id` → `idioms.id` (ON DELETE CASCADE)

---

### 2.5. `idiom_examples` – Idioma misollari
Iboralarga misollar.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| idiom_desc_id | VARCHAR(36) | Qaysi idioma izohiga tegishli |
| user_id | INT | Kim qo‘shgan |
| author | VARCHAR(255) | Muallif |
| example | TEXT | Misol matni |
| ... | ... | (qolgan ustunlar examples ga o‘xshash) |

---

### 2.6. `synonym_groups` – Sinonim guruhlari
Bir nechta izohni sinonim sifatida birlashtirish uchun guruh.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| description | TEXT | Guruh tavsifi |
| created_at | TIMESTAMP | Yaratilgan vaqti |

---

### 2.7. `synonym_group_descriptions` – Sinonim guruhi izohlari
Guruhga qaysi izohlar tegishli ekanligini ko‘rsatadi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| group_id | VARCHAR(36) | Qaysi guruhga tegishli (synonym_groups.id) |
| description | TEXT | Izoh matni |
| created_at | TIMESTAMP | Yaratilgan vaqti |

**Foreign key:** `group_id` → `synonym_groups.id` (ON DELETE CASCADE)

---

### 2.8. `word_antonyms` – Antonimlar
So‘zning qarama-qarshi ma’nosi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | VARCHAR(36) | UUID |
| description_id | VARCHAR(36) | Asosiy izoh (description.id) |
| antonym_description_id | VARCHAR(36) | Antonim izoh (description.id) |

**Foreign keylar:**
- `description_id` → `description.id`
- `antonym_description_id` → `description.id`

---

## 3. Tizim jadvallari

### 3.1. `users` – Foydalanuvchilar

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | INT AUTO_INCREMENT | Foydalanuvchi ID |
| name | VARCHAR(255) | Ismi |
| email | VARCHAR(255) | Email (noyob) |
| password | VARCHAR(255) | Parol (hashlangan) |
| role | ENUM('SUPER_ADMIN','ADMIN','MODERATOR','EDITOR','USER','GUEST') | Foydalanuvchi roli |
| isActive | TINYINT(1) | Aktivligi (1 - aktiv) |
| isBanned | TINYINT(1) | Ban qilinganmi? |
| banReason | TEXT | Ban sababi |
| bannedBy | INT | Kim ban qilgan (users.id) |
| bannedAt | DATETIME | Ban qilingan vaqt |
| lastLoginAt | DATETIME | Oxirgi login |
| createdAt | DATETIME | Ro‘yxatdan o‘tgan vaqti |
| updatedAt | DATETIME | Oxirgi tahrir |

**Indekslar:** `id` (PK), `email` (UNIQUE), `role`, `isActive`, `isBanned`

---

### 3.2. `activity_logs` – Harakatlar tarixi
Foydalanuvchilar amallarini kuzatish uchun.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | INT AUTO_INCREMENT | Log ID |
| userId | INT | Foydalanuvchi (users.id) |
| action | VARCHAR(100) | Bajarilgan amal (masalan, 'create_word') |
| targetType | VARCHAR(100) | Maqsad tipi (masalan, 'word', 'description') |
| targetId | VARCHAR(36) | Maqsad ID |
| meta | LONGTEXT (JSON) | Qo‘shimcha ma’lumot (JSON formatda) |
| ipAddress | VARCHAR(50) | IP manzil |
| userAgent | TEXT | Brauzer ma’lumoti |
| createdAt | DATETIME | Vaqti |

**Foreign key:** `userId` → `users.id` (ON DELETE SET NULL)

### 3.3. `search_logs` – Qidiruv tarixi (topilmagan so‘zlarni aniqlash uchun)

Foydalanuvchilar qidirgan so‘rovlar, natijalar soni va bog‘liq so‘z identifikatorlari.  
Ayniqsa `resultCount = 0` bo‘lgan yozuvlar **lug‘atga qo‘shilishi kerak bo‘lgan so‘zlarni** ko‘rsatadi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | INT(11) AUTO_INCREMENT | Log identifikatori |
| query | VARCHAR(255) | Qidirilgan matn |
| userId | INT(11) NULL | Qidiruvni amalga oshirgan foydalanuvchi (users.id), login bo‘lmagan bo‘lsa NULL |
| titleId | VARCHAR(36) NULL | Qidiruv natijasida topilgan asosiy so‘z (titles.id), agar topilmasa NULL |
| resultCount | INT(11) | Topilgan natijalar soni (0 bo‘lsa – lug‘atda mavjud emas) |
| createdAt | DATETIME | So‘rov yuborilgan vaqt |

**Indekslar:** `id` (PRIMARY KEY), `query`, `userId`, `titleId`, `createdAt`

**Foreign keylar:**
- `fk_sl_user`: `userId` → `users.id` (ON DELETE SET NULL)
- `fk_sl_title`: `titleId` → `titles.id` (ON DELETE SET NULL)

**Yaratish SQL (phpMyAdmin uchun):**
```sql
CREATE TABLE IF NOT EXISTS search_logs (
  id          INT(11)      NOT NULL AUTO_INCREMENT,
  query       VARCHAR(255) NOT NULL,
  userId      INT(11)      NULL,
  titleId     VARCHAR(36)  NULL,
  resultCount INT(11)      NOT NULL DEFAULT 0,
  createdAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sl_query (query),
  KEY idx_sl_userId (userId),
  KEY idx_sl_titleId (titleId),
  KEY idx_sl_createdAt (createdAt),
  CONSTRAINT fk_sl_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sl_title FOREIGN KEY (titleId) REFERENCES titles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


## 3.4. `change_history` — O‘zgarishlar tarixi (Audit log)

Barcha jadvallarda amalga oshirilgan o‘zgartirishlar (qo‘shish, tahrirlash, o‘chirish) tarixini saqlaydi.  
Eski va yangi qiymatlar, farq (diff), foydalanuvchi va IP manzil yozib boriladi.

| Ustun nomi | Tipi | Tavsifi |
|------------|------|---------|
| id | INT(11) AUTO_INCREMENT | Yozuv identifikatori |
| userId | INT(11) NULL | O‘zgartirishni amalga oshirgan foydalanuvchi (users.id), agar foydalanuvchi o‘chirilgan bo‘lsa NULL |
| tableName | VARCHAR(100) | Qaysi jadvalda o‘zgarish bo‘ldi (masalan, `titles`, `description`, `translations`) |
| recordId | VARCHAR(36) | O‘zgargan yozuvning identifikatori (UUID yoki raqam) |
| action | VARCHAR(50) | Amal turi: `create`, `update`, `delete` |
| oldData | LONGTEXT (JSON) | Eski qiymat (JSON shaklida). `create` amalida NULL |
| newData | LONGTEXT (JSON) | Yangi qiymat (JSON shaklida). `delete` amalida NULL |
| diff | LONGTEXT (JSON) | O‘zgargan maydonlar va ularning eski/yangi qiymati |
| ipAddress | VARCHAR(45) | So‘rov yuborilgan IP manzil |
| createdAt | DATETIME | O‘zgarish vaqti |

**Indekslar:**  
- `id` (PRIMARY KEY)  
- `(tableName, recordId)` – ma'lum bir yozuv tarixini tez olish  
- `userId` – foydalanuvchi bo‘yicha filtrlash  
- `createdAt` – vaqt bo‘yicha saralash  

**Foreign key:** `userId` → `users.id` (ON DELETE SET NULL)

**Yaratish SQL (phpMyAdmin uchun):**
```sql
CREATE TABLE IF NOT EXISTS change_history (
  id         INT(11)      NOT NULL AUTO_INCREMENT,
  userId     INT(11)      NULL,
  tableName  VARCHAR(100) NOT NULL,
  recordId   VARCHAR(36)  NOT NULL,
  action     VARCHAR(50)  NOT NULL COMMENT 'create, update, delete',
  oldData    LONGTEXT     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (JSON_VALID(oldData)),
  newData    LONGTEXT     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (JSON_VALID(newData)),
  diff       LONGTEXT     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (JSON_VALID(diff)),
  ipAddress  VARCHAR(45)  NULL,
  createdAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ch_table_record (tableName, recordId),
  KEY idx_ch_userId (userId),
  KEY idx_ch_createdAt (createdAt),
  CONSTRAINT fk_ch_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

---

## 4. Jadval aloqalari (soddalashtirilgan chizma)
titles (1) ──┐
├── (1:N) ── description (1) ──┬── (1:N) ── translations
│ ├── (1:N) ── examples
│ ├── (1:N) ── idioms ── (1:N) ── idiom_desc ── (1:N) ── idiom_examples
│ ├── (1:N) ── word_antonyms (description_id)
│ └── (1:N) ── word_antonyms (antonym_description_id)
└── (1:N) ── etimologiya (title_id)

categorys (1) ── (1:N) ── description (categorys_id)

synonym_groups (1) ── (1:N) ── synonym_group_descriptions

users (1) ── (1:N) ── activity_logs
users (1) ── (1:N) ── titles (user_id)
users (1) ── (1:N) ── examples (user_id)


---

## 5. Triggerlar (avtomatik UUID to‘ldirish)
Quyidagi jadvallarga `BEFORE INSERT` triggerlari biriktirilgan, ular `id` ustuni NULL bo‘lsa, UUID() qiymatini o‘rnatadi:
- `description`
- `etimologiya`
- `examples`
- `idioms`
- `idiom_desc`
- `idiom_examples`
- `synonym_groups`
- `synonym_group_descriptions`
- `word_antonyms`

Bu sizga qo‘lda UUID yaratmaslik uchun qulaylik yaratadi.

---

## 6. Foydali SQL so‘rovlar (boshlang‘ich uchun)

**Barcha faol so‘zlarni olish:**
```sql
SELECT id, soz FROM titles WHERE status = 1 ORDER BY soz;