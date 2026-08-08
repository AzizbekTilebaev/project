# Animatsiya + Admin kengaytma — bajarilish holati

To‘liq reja chatda berilgan. Bu fayl — **nima qilindi / nima qoldi**.

## QISM 1 — Animatsiya

| Band | Holat |
|------|--------|
| 1.0.1 framer-motion + `motionVariants.js` | **Done** |
| 1.0.2 `usePrefersReducedMotion` | **Done** |
| 1.0.3 transform/opacity qoidasi | variants da hurmat |
| 1.3 SoftNextCard + quiz shake/pop | **Done** (krossvord pulse saqlangan) |
| 1.1 Home CountUp / CTA stagger / facts whileInView | **Done** |
| 1.7 AnimatedRoutes page fade | **Done** |
| 1.2 Dictionary `LayoutResults` + favorite pulse | **Done** |
| 1.4 Literature hub stagger | **Done** |
| 1.5 Tutor pick feedback (strike/fade + msg) | **Done** |
| 1.5 Qoidalar / English `TabCrossfade` | **Done** |
| 1.6 Profile wallet/streak `CountUp` | **Done** |
| 1.6 Community vote pop | **Done** |
| 1.6 FirstRun path hover/tap | **Done** |
| 1.6 Auth form shake | **Done** |

Takrorlash: `cd frontend && npm run build`

## QISM 2 — Admin

| Band | Holat |
|------|--------|
| 2.1 Quiz/crossword CRUD | **Mavjud** (`/admin/quizzes`, `/admin/crosswords`) |
| 2.3.3 Moderatsiya | **Mavjud** (`/admin` → Moderatsiya tab) |
| 2.3.1–2.3.2 User blok | **Done** — `PUT /api/admin/users/:id/status` (owner); FE tasdiq; actor 403 |
| 2.2 Dictionary admin UI | **Done** — `/admin/dictionary` (izlew, qosıw, rename, jasıriw, activate) |
| 2.4 Funnel dashboard 7k | **Done** (checkin / wod_game / quiz + jadval) |

## DoD qisqa

- [x] Fundament + reduced-motion hook  
- [x] Global page transition  
- [x] SoftNext konsistent komponent  
- [x] Owner bloklay oladi; editor 403 (requireOwner)  
- [x] Dictionary layout filtr  
- [x] Dashboard 7 kun funnel  
- [x] Tutor/Qoidalar/English/Profile/Community/FirstRun/Auth polish (1.5–1.6)  
- [x] Dictionary admin CRUD UI (2.2)  

## Endi (lokal reja tashqarida) — VPS / ops

Bu sprint emas; `docs/PRODUCTION-TODO.md` da:

- A1–A5: real VPS, HTTPS, DNS  
- B2–B3: UptimeRobot live, server cron  
- C: push (FCM/APNs)  
- D1/D4: load test  
- E2–E3: domain da real-user smoke  
