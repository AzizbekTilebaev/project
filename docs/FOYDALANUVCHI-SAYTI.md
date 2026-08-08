# Saytda foydalanuvchi nima qila oladi

> AI / yangi odam uchun **to‘liq mahsulot tasviri**.  
> Texnik ichki tuzilma: [QANDAY-ISHLAYDI.md](QANDAY-ISHLAYDI.md) · Qisqa qo‘llanma: [FOYDALANISH.md](FOYDALANISH.md) · API: [API-MOBILE.md](API-MOBILE.md)

**Mahsulot:** Qaraqalpaq tilini o‘rganish platformasi — sozlik, o‘yinlar, ádebiyat, qoidalar, ingliz.  
**Ochiladi:** brauzer SPA (`/`). Ro‘yxatdan o‘tmasdan ham ko‘p narsa ishlaydi (mehmon / anonim actor).

---

## 1. Kim kiradi

| Rol | Nima |
|-----|------|
| **Mehmon** | Brauzerda `X-Anonymous-Id` (UUID) saqlanadi. Qidiruv, o‘yin, check-in, qisman progress. Sevimlilar ko‘pincha `localStorage`. |
| **Ro‘yxatdan o‘tgan** | Email/parol yoki Google. Sevimlilar serverda, ball/hamyon, qurilmalararo. |
| **Admin** | `/admin/*` — oddiy foydalanuvchi emas; bu hujjatda qisqa eslatma. |

**Yozuv:** yuqorida **KIR / LAT** — butun UI matni lotin yoki kirillga o‘tadi.

---

## 2. Qayerdan qayerga (navigatsiya)

### Mobil pastki tab (4)

| Tab | Yo‘l | Ichida nima «yonadi» |
|-----|------|----------------------|
| **Sózlik** | `/dictionary` | Sozlik hub; so‘z sahifasi (lekin `/dictionary/game` emas) |
| **Oyınlar** | `/games` | Test, krossvord, so‘z o‘yini, tutor, adaptiv |
| **Ádebiyat** | `/literature` | Kitoblar, shoirlar, jumbaq, naqıl, ertek |
| **Qoidalar** | `/qoidalar` | Grammatika kitoblari |

Logo / brend → **`/`** (bosh sahifa).

**English tabda emas (ataylab):** hozircha kontent kamroq; `/english` «Yana» ichida. Kontent o‘sgach — tab yoki Qoidalar ichida tab sifatida ko‘rib chiqiladi (hamburger’dagi feature odatda kamroq ishlatiladi).

### Hamburger «Yana»

`/` · `/tutor/practice` · `/quiz/statistics` · `/profile` · `/community` · `/english` · `/facts` · `/faq` · `/settings`

### Desktop

Shu 4 tab yuqorida; sozlama, profil, KIR/LAT — headerda.

---

## 3. Bosh sahifa `/`

**Ko‘radi:** brend, qisqa matn, CTA **Sózlik** / **Oyınlar**, pastroq Qoidalar·English linklari; o‘yin eshiklari (ádebiyat / oyinlar); madaniy faktlar; «Bugun» soft CTA; sozlik qidiruv; first-run / davom; **kun so‘zi**.

| Qiladi | Natija |
|--------|--------|
| Sozlikka kiradi | `/dictionary` |
| Oyınlarga | `/games` |
| Qidiruv yozadi | Takliflar; so‘zga yoki to‘liq izlewga |
| **Kun so‘zini belgilaydi** (check-in) | Ball + streak; xato bo‘lsa xabar; keyin «so‘z bilan oyna» |
| Kun so‘zi yo‘q (API) | Fallback: qayta yuklash / sozlik / oyinlar |
| First-run eshik tanlaydi | Tanlangan yo‘nalishga o‘rgatadi; qayta: `/settings` → «Baslanǵısh tanlawdı qayta kóriw» |

**Kunlik maqsad (soft):** check-in + shu so‘z bilan mashq ≈ «2/2».

---

## 4. Sózlik

### Hub `/dictionary`

Markaz: qidiruv, havolalar (barcha so‘zlar, sevimlilar, o‘yin, immersiya, ikki tilli lug‘atlar).

### Qidiruv / ro‘yxat `/dictionary/all`

| Qiladi | Natija |
|--------|--------|
| So‘z yozadi | Natijalar yoki «topilmadi» + taklif / mashq CTA |
| Harf / filtr | Ro‘yxat |
| Kartani ochadi | `/dictionary/:id` |

### So‘z sahifasi `/dictionary/:id`

**Ko‘radi (tartib taxminan):** so‘z, lead anıqlama, morfologiya (bo‘laklar), to‘liq anıqlamalar, tarjimalar, immersiya bloki, bog‘liq so‘zlar, jamiyat taklifi, oldingi/keyingi.

| Qiladi | Natija |
|--------|--------|
| Sevimliga qo‘shadi | Mehmon: lokal; login: **avtomatik** `POST /favorites/sync` (`useDictionaryFavorites` + loginSuccess). Flash + sevimlilar havolasi |
| Ulashadi | Share |
| Anıqlama / morfologiyani o‘qiydi | O‘rganish; keyin mashqga undash |
| Immersiya tinglaydi | Streak / mashq navbati |
| Community taklif | Sinonim va h.k. ovoz / taklif |
| «Keyingi qadam» | Mashq, oyin, boshqa so‘z |

### Sevimlilar `/dictionary/favorites`

Ro‘yxat + shu so‘zlar bilan o‘yin boshlash.

### So‘z o‘yini `/dictionary/game`

Query: `source`, `ids`, `goal` (masalan `checkin`, `wod`, `mistakes`).

| Qiladi | Natija |
|--------|--------|
| Raund o‘ynaydi | Ball, streak; tugagach SoftNext (Oyınlar / Ádebiyat / Profil) |
| WOD maqsadi | Check-in + mashq bayrami |

### Immersiya `/dictionary/immersion`

Audio materiallar; tinglash → streak → mashq.

### Boshqa lug‘atlar

| Yo‘l | Mazmun |
|------|--------|
| `/dictionary/uzb` · `en` · `ru` | Ikki tilli |
| `/dictionary/frazeologiya` | Frazeologizmlar |
| `/dictionary/adam-atlari` | Ism |
| `/dictionary/imla` | Imlo |
| `/dictionary/stats` | Sozlik statistikasi |

---

## 5. Oyınlar `/games`

Hub: **Test**, **Krossvord**, so‘z o‘yini, «Búgin oyna», adaptiv; ádebiyatga havola.

### Test `/quiz` → `/quiz/:id`

| Qiladi | Natija |
|--------|--------|
| Test tanlaydi | Savollar (yosh roziligi / kvota soft) |
| Javob beradi | To‘g‘ri/xato feedback |
| Yakunlaydi | Ball, daraja, xatolar; SoftNext; xato bo‘lsa tutor/mashq |
| Davom etadi | Saqlangan urinish |

**Adaptiv** `/quiz/adaptive` — qiyinlik moslashadi; tugagach SoftNext.  
**Xona** `/quiz/room` — do‘stlar bilan kod orqali.  
**Statistika** `/quiz/statistics` — ball tarixi, streak, ma’lumotni o‘chirish.

### Krossvord `/crossword` → `/crossword/:id`

| Qiladi | Natija |
|--------|--------|
| Kataklarni to‘ldiradi | Tekshiruv |
| 100% | Grid pulse + trophy banner; SoftNext; xona varianti bor |

---

## 6. Ádebiyat `/literature`

Hub: davom (kitob/jumbaq), tanlangan kitob/shoir, eshiklar.

| Yo‘l | Qiladi → natija |
|------|-----------------|
| `/books` → `/books/:id` | Katalog → tafsilot |
| `/books/:id/read` | O‘qiydi (progress saqlanadi) |
| `/books/:id/learn` | O‘qish darsi / mashq; xato → mashq navbati |
| `/writers` · `/:slug` | Shoirlar |
| `/jumbaqlar` | Jumbaq ochadi → streak / sevimli / soft continue |
| `/literature/naqillar` | Maqollar |
| `/literature/ertekler` | Erteklar |

Bo‘sh katalog: sozlik / oyin / mashq CTA.

---

## 7. Tutor va mashq

| Yo‘l | Vazifa |
|------|--------|
| `/tutor` | Xatolar banki, kunlik mini-dars; bo‘sh bo‘lsa test/o‘yin/immersiyaga yo‘naltiradi |
| `/tutor/practice` | «Búgin oyna» — davom + manbalar (WOD, sevimli, quiz, krossvord, jumbaq, immersiya, o‘qish) → asosan so‘z o‘yini yoki hub |

---

## 8. Qoidalar va English

### `/qoidalar`

Klass kitoblari + morfologiya namunalari; yuqori/past mashq CTA (test, practice, krossvord).

### `/english`

Ingliz kitoblari (tab); o‘qish + mashq CTA (test, so‘z o‘yini, krossvord).

---

## 9. Boshqa sahifalar

| Yo‘l | Nima |
|------|------|
| `/facts` | Madaniy faktlar |
| `/community` | Jamiyat takliflari (kutilayotgan / meniki) |
| `/profile` | Ball, streak, sandiq, sevimlilar; mehmonda soft login |
| `/settings` | Mavzu, test tartibi, first-run qayta tanlash, parol |
| `/faq` · `/about` | Yordam / haqida |
| `/login` · `/register` · parol tiklash | Akkount |

Chiqishda ba’zan **exit so‘rov** (feedback) chiqishi mumkin: desktop — exit-intent; mobil — `visibilitychange` (tab/ilova orqaga). Sessiya + **7 kun** cooldown.

---

## 10. Tipik kunlik tsikl (5–10 daqiqa)

```
/  →  kun so‘zini o‘qish  →  check-in (+ball)
   →  «Sóz menen oyna» (/dictionary/game?…&goal=wod)
   →  xohlasa /quiz yoki /crossword
   →  SoftNext: yana oyin / ádebiyat / profil
```

Yoki: `/qoidalar` yoki `/english` o‘qish → pastki mashq tugmasi → test.

---

## 11. «Nima qilsa — nima bo‘ladi» (qisqa)

| Harakat | Odatda natija |
|---------|----------------|
| Check-in | Ball, streak; ~20 soat UTC ichida qayta claim blok |
| Test/krossvord/o‘yin tugashi | Ball (login/server), SoftNext, mehmonda soft akkount taklifi |
| Sevimli | Mehmon: lokal; login: sync |
| Xato javoblar | Mashq / tutor / so‘z o‘yini navbati |
| Statistika → ma’lumotni o‘chirish | Actor ma’lumotlari + device tokenlar tozalanadi |
| API o‘chsa | Bosh sahifa hali ochiladi; sozlik/kun so‘zi fallback |

---

## 12. Marshrutlar xaritasi (to‘liq, foydalanuvchi)

```
/                          Bosh
/dictionary[/*]            Sozlik oilasi
/games                     Oyın hub
/quiz, /quiz/:id, …        Testlar (/quiz/statistics, /statistics)
/crossword[/*]             Krossvord
/tutor, /tutor/practice    Tutor / mashq
/literature[/*]            Ádebiyat hub + naqıl/ertek
/books[/*], /writers[/*]   Kitob / shoir
/jumbaqlar                 Jumbaq
/qoidalar, /english        Qoida / ingliz
/facts, /community         Fakt / jamiyat
/profile, /settings, /faq, /about, /dashboard
/privacy, /terms           Maxfiylik / shartlar
/login, /register, /forgot-password, /reset-password
/admin/*                   Admin (oddiy user emas)
```

Route sinxroni (CI): `npm run check:docs-routes`.

---

## 13. AI uchun qoidalar

1. Oddiy foydalanuvchi **admin** sahifalariga yo‘naltirilmasin.  
2. Birinchi tavsiya odatda: **kun so‘zi → mashq → bitta o‘yin**.  
3. SoftNext deyarli hamma joyda: **Oyınlar · Ádebiyat · Profil**.  
4. Mehmon ham o‘ynay oladi; «kirish» — sync/sevimli uchun, to‘liq blok emas.  
5. UI matnlari asosan **qaraqalpaq** (KAA); yozuv KIR/LAT.

---

*Yangilangan: 2026-08-08. Route o‘zgarsa `App.jsx` + shu fayl + `QANDAY-ISHLAYDI.md`; CI `check:docs-routes` tekshiradi.*
