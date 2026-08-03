# Animatsiya reja — Qaraqalpaq Til Platforması

> Maqsad: hayratlanarli, lekin **ma’noli** motion. Confetti / neon glow emas — til o‘rganish tajribasini kuchaytiradigan 2–3 ta aniq harakat.

---

## 3 qoida

1. **Har sahifada 2–3 ta maqsadli motion** — kirish, muvaffaqiyat, o‘tish. Ortacha tebranish “AI sayt”ga o‘xshaydi.
2. **Ma’no bilan bog‘langan** — so‘z topildi → katak “lock”; krossvord tugadi → grid nafas oladi; lug‘at ochildi → anıqlama ko‘tariladi.
3. **`prefers-reduced-motion`** — har doim hurmat qilinsin (hozir `frontend/src/index.css` da qisman bor; yangi effektlar shu bilan yopilsin).

---

## Mavjud asos (qayta ixtiro qilma)

| Joy | Nima bor |
|-----|----------|
| `frontend/src/index.css` | `animate-dict-rise`, quiz-pop, confetti, streak, reduce-motion |
| `frontend/src/animations/` | `AnimChevron`, `AnimIconDivider`, `AnimMatrixRain` |
| Sahifalar | `anim.shine`, `anim.underlineGrow`, `anim.checkinPop`, `anim.streakFlame` |

**Keyingi qadam:** bularni tarqatma effektlar emas, **bitta motion tizim** sifatida yuritish.

---

## Tizim: bitta “motion layer”

Papka: `frontend/src/animations/` (kengaytirish)

| Token / helper | Vazifa |
|----------------|--------|
| `pageEnter` | Sahifa / kartalar ketma-ket rise |
| `success` | To‘g‘ri javob, krossvord complete |
| `reveal` | Morfologiya segmentlari, anıqlama ochilishi |
| `nav` | Header underline (hozirgi `anim.underlineGrow`) |

**Duration tokenlar (taklif):**

- tezkor: `180ms`
- oddiy: `280ms`
- sekin / sahifa: `420ms`
- easing: yumshoq (`ease-out` / custom cubic), bounce faqat success da

---

## Kutubxona tanlovi

- **Ko‘p joy uchun:** hozirgi CSS + `anim.*` yetarli.
- **Murakkab sahna kerak bo‘lsa:** Motion (Framer) — faqat Home, WordDetail, Crossword complete.
- Butun saytni Motion bilan o‘rash **shart emas**.

---

## “Wow” nuqtalari (eng yuqori foyda)

| Joy | Effekt |
|-----|--------|
| **Home** | Hero matn + CTA soft rise; fon atmosfera sekin drift |
| **Sózlik / WordDetail** | Morfologiya bo‘laklari ketma-ket; tarjima paneli (ornament) bilan ochiladi |
| **Krossvord** | Katak to‘lganda micro-pop; 100% da qisqa celebrate — confetti emas: grid pulse + trophy |
| **Quiz / mashq** | To‘g‘ri / xato feedback (allaqachon bor — bir xil “til”ga keltirish) |

---

## Qilmaslik

- Har hoverda multi-layer shadow + glow
- Doimiy parallax / matrix rain butun saytda
- Purple neon, pill-stat strip animatsiyalari
- Birinchi viewportni statistika / chip to‘plami bilan to‘ldirish

(Frontend dizayn qoidalari: brand + atmosfera; kartalar faqat interaktiv joyda.)

---

## 1-sprint (tartib)

1. Motion tokenlar (duration / easing) — CSS variables yoki `animations/tokens.js`
2. `PageEnter` wrapper — asosiy route’larga
3. **WordDetail + Crossword success** polish
4. Reduced-motion audit (barcha yangi `@keyframes`)

Ixtiyoriy boshlash tartibi: **Home → WordDetail → Crossword complete**.

---

## Tekshiruv checklist

- [ ] Desktop + mobil da ortiqcha sekin emas
- [ ] `prefers-reduced-motion: reduce` da asosiy UI o‘qiladi
- [ ] Bir xil easing / duration — sahifalar “bir oila”dek
- [ ] Success animatsiya 1–1.5 s dan oshmasin

---

## Eslatma

Bu hújjet — strategiya. Implementatsiya so‘ralganda shu sprint bo‘yicha kod yoziladi.
