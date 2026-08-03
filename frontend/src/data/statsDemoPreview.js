/**
 * Statistika demo — ~22 foydalanuvchi 3–4 hafta o‘ynagandek ko‘rinish.
 * Faqat UI preview; haqiqiy API ma’lumotini almashtirmaydi (toggle orqali).
 */

function dayKey(offsetDays) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildHeatmap(days = 90) {
  const out = [];
  for (let i = -(days - 1); i <= 0; i++) {
    const dow = new Date();
    dow.setDate(dow.getDate() + i);
    const weekday = dow.getDay();
    // Weekend quieter; weekdays busier — like 20–25 active users
    let count = 0;
    if (weekday === 0 || weekday === 6) {
      count = Math.random() < 0.55 ? 2 + Math.floor(Math.random() * 5) : 0;
    } else {
      count = 4 + Math.floor(Math.random() * 14); // ~4–17 events/day
    }
    // Occasional quiet day
    if (Math.random() < 0.08) count = 0;
    if (count > 0) out.push({ day: dayKey(i), count });
  }
  return out;
}

function buildTrend(days = 30) {
  const out = [];
  for (let i = -(days - 1); i <= 0; i++) {
    const base = 62 + Math.sin(i / 4) * 8;
    out.push({
      day: dayKey(i),
      avgPercent: Math.round(Math.min(92, Math.max(48, base + (Math.random() * 12 - 4)))),
    });
  }
  return out;
}

const NAMES = [
  'Aydos',
  'Gúlzar',
  'Batır',
  'Saniya',
  'Murat',
  'Ájiniyaz',
  'Nargiza',
  'Qanat',
  'Zulfiya',
  'Erlan',
  'Maqpal',
  'Timur',
  'Aygúl',
  'Dáwlet',
  'Shaxnoza',
  'Rasul',
  'Malika',
  'Jasur',
  'Dilnoza',
  'Bekzat',
  'Ásel',
  'Nurbolat',
];

export const DEMO_USERS = 22;

export function buildStatsDemoPreview() {
  const heatmap = buildHeatmap(90);
  const trend = buildTrend(30);

  const statistics = {
    summary: {
      attempts: 186,
      completed: 142,
      multiplayer: 38,
      adaptive: 29,
      avgPercent: 74,
      bestPercent: 96,
    },
    categories: [
      { category: 'Grammatika', avgPercent: 78, attempts: 54 },
      { category: 'Sózlik', avgPercent: 81, attempts: 67 },
      { category: 'Tariyx', avgPercent: 69, attempts: 41 },
      { category: 'Ádebiyat', avgPercent: 72, attempts: 24 },
    ],
    modes: [
      { mode: 'solo', avgPercent: 76, attempts: 98 },
      { mode: 'adaptive', avgPercent: 71, attempts: 29 },
      { mode: 'sync', avgPercent: 68, attempts: 22 },
      { mode: 'race', avgPercent: 64, attempts: 16 },
    ],
    trend,
    recent: [
      {
        id: 'd1',
        title: 'Grammatika — Orta',
        score: 8,
        total: 10,
        playMode: 'solo',
        isAdaptive: false,
      },
      {
        id: 'd2',
        title: 'Sózlik sprint',
        score: 9,
        total: 10,
        playMode: 'race',
        isAdaptive: false,
      },
      {
        id: 'd3',
        title: 'Adaptiv sessia',
        score: 7,
        total: 10,
        playMode: 'adaptive',
        isAdaptive: true,
      },
      {
        id: 'd4',
        title: 'Kóp oyınshılı test',
        score: 6,
        total: 10,
        playMode: 'sync',
        isAdaptive: false,
      },
      {
        id: 'd5',
        title: 'Ádebiyat — Qısqa',
        score: 10,
        total: 10,
        playMode: 'solo',
        isAdaptive: false,
      },
      {
        id: 'd6',
        title: 'Tariyx boyınsha',
        score: 7,
        total: 10,
        playMode: 'solo',
        isAdaptive: false,
      },
    ],
    ability: { theta: 0.42 },
    mistakes: { active: 11, totalWrong: 47 },
  };

  const activity = {
    heatmap,
    streak: { current: 6, best: 14 },
    timeSpent: {
      quizMs: 48 * 60 * 1000,
      dictionaryMs: 72 * 60 * 1000,
      crosswordMs: 35 * 60 * 1000,
      literatureMs: 41 * 60 * 1000,
      tutorMs: 18 * 60 * 1000,
      immersionMs: 22 * 60 * 1000,
      jumbaqMs: 12 * 60 * 1000,
    },
    quiz: { completes: 142 },
    crossword: { completes: 31 },
    review: {
      activeDays: 6,
      quizCompletes: 18,
      crosswordCompletes: 5,
      wordViews: 64,
      dictGames: 9,
    },
  };

  const points = {
    wallet: {
      balance: 340,
      level: 4,
      totalEarned: 520,
      totalSpent: 180,
      levelProgress: 0.62,
      levelNextAt: 600,
    },
    rank: 7,
    profile: { nickname: 'Demo_oqıwshı', leaderboardOptIn: true },
  };

  const leaderboard = NAMES.slice(0, 10).map((nickname, i) => ({
    rank: i + 1,
    nickname,
    totalEarned: 980 - i * 55 - (i % 3) * 12,
    level: 8 - Math.floor(i / 2),
  }));

  const history = [
    {
      id: 'h1',
      kind: 'quiz_completed',
      amount: 25,
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: 'h2',
      kind: 'dict_game_completed',
      amount: 10,
      createdAt: new Date(Date.now() - 1.2 * 86400000).toISOString(),
    },
    {
      id: 'h3',
      kind: 'quiz_completed',
      amount: 15,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 'h4',
      kind: 'answer_review_unlock',
      amount: -20,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'h5',
      kind: 'adaptive_completed',
      amount: 30,
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
    {
      id: 'h6',
      kind: 'combo_chest_claim',
      amount: 20,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  ];

  const community = {
    activeUsers: DEMO_USERS,
    weekSessions: 268,
    weekWords: 1240,
    weekGames: 194,
  };

  const recentWords = [
    { id: 'w1', soz: 'SARALAW' },
    { id: 'w2', soz: 'ARBAQLAW' },
    { id: 'w3', soz: 'ABADANLASTIRIW' },
    { id: 'w4', soz: 'JAQSI' },
    { id: 'w5', soz: 'ÚYRENIW' },
    { id: 'w6', soz: 'KÚN' },
    { id: 'w7', soz: 'SÓZLIK' },
    { id: 'w8', soz: 'ÁDEBIYAT' },
  ];

  return {
    statistics,
    activity,
    points,
    leaderboard,
    history,
    community,
    recentWords,
  };
}
