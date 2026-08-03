# Loyiha tozalash ma’lumotnomasi

Sana: 2026-07-19

## Natija

- Loyiha ichidan trashga ko‘chirildi: **399 ta fayl, 25,808,605 bayt (24.61 MiB)**.
- Fayllar butunlay o‘chirilmagan.
- Trash manzili:
  `C:\Users\aziz\Desktop\projects 2\proyekt2-trash-20260719-1723`
- To‘liq mashina-o‘qiydigan ro‘yxat:
  `proyekt2-trash-20260719-1723\TRASH_MANIFEST.json`

## Trashga ko‘chirilganlar

| Yo‘l | Fayllar | Hajm | Sabab |
|---|---:|---:|---|
| `frontend/dist/` | 47 | 680,302 B | Vite build natijasi; `npm run build` bilan qayta yaratiladi |
| `frontend/node_modules/.vite/` | 22 | 3,951,345 B | Vite dependency cache |
| `frontend/node_modules_removed/` | 2 | 12,439,552 B | Eski, foydalanilmaydigan dependency nusxasi |
| `backend/tmp/` | 27 | 512,096 B | Import/script auditlarining vaqtinchalik natijalari |
| `backend/tayn_emesleri/` | 293 | 3,279,169 B | Faol backenddan tashqaridagi legacy nusxa |
| `backend/reference-synonyms.audit.json` | 1 | 11,111 B | Script qayta yarata oladigan audit hisoboti |
| `dict_pages_v2.zip` | 1 | 4,743,778 B | `fordata/dict_pages_v2/` ichida ochilgan arxiv nusxasi |
| `compound_fixed-3.zip` | 1 | 31,677 B | `fordata/compound_fixed/` ichida ochilgan arxiv nusxasi |
| `authors.json` | 1 | 86,149 B | Bir martalik `py.py` skripti yaratgan oraliq fayl |
| `py.py` | 1 | 1,172 B | Mavjud bo‘lmagan `questions.json`ga bog‘langan bir martalik skript |
| `refs.txt` | 1 | 2,268 B | `backend/scripts/check-refs.js` qayta yaratadigan hisobot |
| `fordata/linked-words.audit.json` | 1 | 27,142 B | `fordata/tools` qayta yaratadigan audit |
| `fordata/roman-homonyms.audit.json` | 1 | 42,844 B | `fordata/tools` qayta yaratadigan audit |

## Ataylab saqlanganlar

- `backend/.env` va boshqa konfiguratsiyalar.
- `backend/node_modules/`, `frontend/node_modules/` — loyiha darhol ishlashi uchun.
- `fordata/newdata-review/` — hozir ko‘rib chiqilayotgan review to‘plami (skript bilan qayta yaratiladi).
- `backend/tusindirme_ushin/` — legacy reference; runtime ishlatmaydi, lekin manba sifatida qoldirildi.
- `fordata/` ichidagi manba ma’lumotlari (`books/`, `dict_pages_v2/`, `newdata/` va hokazo).
- Database konfiguratsiyasi, migration/setup/import skriptlari.
- `backend/backups/` (hozir bo‘sh bo‘lsa ham backup manzili).
- Faol `backend/src`, `frontend/src`, testlar, hujjatlar va public assetlar.

## Qayta tiklash

Trash ichidagi kerakli fayl yoki papkani shu nisbiy yo‘l bilan loyiha ildiziga
qaytarish kifoya. Masalan:

```powershell
Move-Item `
  "C:\Users\aziz\Desktop\projects 2\proyekt2-trash-20260719-1723\backend\tayn_emesleri" `
  "C:\Users\aziz\Desktop\projects 2\proyekt2\backend\tayn_emesleri"
```

## Tekshiruv

- Backend: **96/96 test muvaffaqiyatli**.
- Frontend lint: **0 error**, 4 ta `react-hooks/exhaustive-deps` warning.
- Trashga o‘tgan asosiy papka/fayllarning loyiha ichida qolmagani tekshirildi.
- `backend/tmp/` kelajakda Gitga tushmasligi uchun `.gitignore`ga qo‘shildi.

---

# `fordata` → MySQL migratsiyasi va o‘chirish

Sana: 2026-07-19

## Nima qilindi

`fordata/` to‘liq loyihadan olib tashlandi (**1976 fayl, 112,643,504 bayt / 107.43 MiB**).
Undan oldin faqatgina fordata’ga bog‘liq bo‘lgan yagona **runtime** ma’lumot
MySQL’ga ko‘chirildi.

- Trash manzili:
  `C:\Users\aziz\Desktop\projects 2\proyekt2-trash-fordata-20260719-1739\fordata`
- Fayllar butunlay o‘chirilmagan — kerak bo‘lsa qaytarib olish mumkin.

## Ma’lumot allaqachon bazada edi

`fordata` asosan **import manbasi** bo‘lgan; asosiy ma’lumotlar allaqachon MySQL’da:

| Ma’lumot | Baza | Holat |
|---|---|---|
| Shoirlar (writers) | `quiz_db.literature_writers` | 203 |
| Kitoblar | `quiz_db.books` | 35 |
| Asar bo‘laklari | `quiz_db.literature_pieces` | 948 |
| Ijodiy asarlar | `quiz_db.writer_creative_works` | 1189 |
| Jumbaqlar | `quiz_db.jumbaqlar` | 1251 |
| Lug‘at so‘zlari | `tusindirme_sozlik.titles` | 10 213 |

Bular `import-literature` va lug‘at backup/import orqali allaqachon yuklangan,
shuning uchun `fordata` manbasi runtime uchun kerak emas edi.

## Yagona runtime bog‘liqlik ko‘chirildi: curated (premium-50)

Ilgari `/api/tusindirme/curated` har so‘rovda `fordata/curated/premium-50.meta.json`
faylini o‘qirdi. Endi bu ro‘yxat MySQL’da:

- Yangi jadval: `tusindirme_sozlik.curated_words` (50 ta so‘z seed qilindi).
- Setup: `backend/scripts/setup-dictionary-db.js` jadvalni yaratadi.
- Seed: `backend/scripts/seed-curated-words.js` (bir martalik, manbadan yuklangan).
- Servis: `tusindirmeService.getCurated()` endi bazadan o‘qiydi (fayl faqat
  bazada bo‘lmasa fallback bo‘lib qolgan).

Tekshiruv: `getCurated()` fordata’siz ham 50 ta so‘zni bazadan to‘liq qaytardi.

## Import skriptlari haqida

`import-literature`, `seed-curated-words` va lug‘at fix/audit skriptlari manba
sifatida `fordata`ni ishlatardi. Ma’lumot bazaga tushgani uchun ular endi
**qayta ishga tushirilishi shart emas**. Agar keyinchalik qayta import kerak
bo‘lsa, `fordata`ni trashdan qaytarish kifoya:

```powershell
Move-Item `
  "C:\Users\aziz\Desktop\projects 2\proyekt2-trash-fordata-20260719-1739\fordata" `
  "C:\Users\aziz\Desktop\projects 2\proyekt2\fordata"
```

## Tekshiruv (migratsiyadan keyin)

- `curated_words`: **50 ta so‘z** bazada; `getCurated()` fordata’siz ishladi.
- Adabiyot/jumbaqlar/lug‘at sanoqlari o‘zgarishsiz (yuqoridagi jadval).
- Backend: **96/96 test muvaffaqiyatli**.
- `backend/src` da `fordata`ga runtime murojaat qolmadi (faqat fayl-fallback).
