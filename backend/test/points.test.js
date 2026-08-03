/**
 * Ball tizimi testlari: hisoblash, hamyon, idempotensiya, sarflash, unlock, reyting.
 * Run: node --test --test-force-exit test/points.test.js
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { pools } from '../src/config/db.js';
import {
  computeAttemptPoints,
  levelForPoints,
  retryMultiplier,
  speedBonus,
  reviewCost,
  getWallet,
  awardPoints,
  spendPoints,
  unlockAnswerReview,
  isReviewUnlocked,
  getHistory,
  getLeaderboard,
  setLeaderboardProfile,
  POINTS,
} from '../src/services/pointsService.js';

const usersDb = pools.users;
const statDb = pools.statistika;

const createdActorIds = [];

async function makeActor() {
  const key = crypto.randomBytes(32).toString('hex');
  const [res] = await usersDb.query(`INSERT INTO anonymous_actors (actor_key) VALUES (?)`, [key]);
  createdActorIds.push(res.insertId);
  return res.insertId;
}

after(async () => {
  for (const id of createdActorIds) {
    await statDb.query(`DELETE FROM point_transactions WHERE actor_id = ?`, [id]);
    await statDb.query(`DELETE FROM answer_review_unlocks WHERE actor_id = ?`, [id]);
    await statDb.query(`DELETE FROM actor_wallets WHERE actor_id = ?`, [id]);
    await usersDb.query(`DELETE FROM anonymous_actors WHERE id = ?`, [id]);
  }
  await Promise.all(Object.values(pools).map((p) => p.end().catch(() => {})));
});

describe('ball hisoblash (sof funksiyalar)', () => {
  it('to‘g‘ri javob 10 ball, tezlik bonusi darajalari', () => {
    assert.equal(speedBonus(2000), POINTS.SPEED_FAST);
    assert.equal(speedBonus(5000), POINTS.SPEED_MID);
    assert.equal(speedBonus(9000), POINTS.SPEED_SLOW);
    assert.equal(speedBonus(15000), 0);
    assert.equal(speedBonus(null), 0);
  });

  it('takroriy urinish koeffitsiyenti: 1.0 / 0.5 / 0.2', () => {
    assert.equal(retryMultiplier(0), 1);
    assert.equal(retryMultiplier(1), 0.5);
    assert.equal(retryMultiplier(2), 0.2);
    assert.equal(retryMultiplier(7), 0.2);
  });

  it('xatosiz to‘liq test: baza + bonus + perfect', () => {
    const answers = [
      { isCorrect: true, timeSpentMs: 2000 },
      { isCorrect: true, timeSpentMs: 5000 },
      { isCorrect: true, timeSpentMs: 20000 },
    ];
    const r = computeAttemptPoints(answers, { perfect: true, priorAttempts: 0 });
    assert.equal(r.base, 30);
    assert.equal(r.speed, 8);
    assert.equal(r.perfectBonus, 20);
    assert.equal(r.total, 58);
  });

  it('takroriy urinishda ball kamayadi', () => {
    const answers = [{ isCorrect: true, timeSpentMs: null }];
    assert.equal(computeAttemptPoints(answers, { priorAttempts: 1 }).total, 5);
    assert.equal(computeAttemptPoints(answers, { priorAttempts: 3 }).total, 2);
  });

  it('noto‘g‘ri javoblar ball bermaydi', () => {
    const r = computeAttemptPoints([
      { isCorrect: false, timeSpentMs: 1000 },
      { isCorrect: false, timeSpentMs: 1000 },
    ]);
    assert.equal(r.total, 0);
  });

  it('daraja chegaralari: L1 0, L2 100, L3 300', () => {
    assert.equal(levelForPoints(0).level, 1);
    assert.equal(levelForPoints(99).level, 1);
    assert.equal(levelForPoints(100).level, 2);
    assert.equal(levelForPoints(299).level, 2);
    assert.equal(levelForPoints(300).level, 3);
  });

  it('javob ochish narxi: minimum 30, savol boshiga 5', () => {
    assert.equal(reviewCost(3), 30);
    assert.equal(reviewCost(6), 30);
    assert.equal(reviewCost(10), 50);
  });
});

describe('hamyon: berish, idempotensiya, sarflash', () => {
  it('awardPoints balansni oshiradi va darajani yangilaydi', async () => {
    const actorId = await makeActor();
    const refId = crypto.randomUUID();
    const res = await awardPoints(actorId, { amount: 150, kind: 'quiz_completed', refId });
    assert.equal(res.awarded, true);
    assert.equal(res.balance, 150);
    assert.equal(res.level, 2); // 150 >= 100
    assert.equal(res.leveledUp, true);
    assert.equal(res.previousLevel, 1);

    const wallet = await getWallet(actorId);
    assert.equal(wallet.totalEarned, 150);
  });

  it('bir xil kind+refId ikkinchi marta ball bermaydi (idempotent)', async () => {
    const actorId = await makeActor();
    const refId = crypto.randomUUID();
    await awardPoints(actorId, { amount: 50, kind: 'quiz_completed', refId });
    const second = await awardPoints(actorId, { amount: 50, kind: 'quiz_completed', refId });
    assert.equal(second.awarded, false);
    assert.equal(second.balance, 50);
  });

  it('spendPoints balansdan yechadi, yetmasa 402', async () => {
    const actorId = await makeActor();
    await awardPoints(actorId, { amount: 40, kind: 'quiz_completed', refId: crypto.randomUUID() });

    const ok = await spendPoints(actorId, { amount: 30, kind: 'test_spend', refId: crypto.randomUUID() });
    assert.equal(ok.spent, true);

    await assert.rejects(
      () => spendPoints(actorId, { amount: 30, kind: 'test_spend', refId: crypto.randomUUID() }),
      (err) => {
        assert.equal(err.statusCode, 402);
        assert.equal(err.code, 'INSUFFICIENT_POINTS');
        assert.equal(err.balance, 10);
        assert.equal(err.needed, 20);
        return true;
      }
    );
  });

  it('parallel sarflash balansni minusga tushirmaydi', async () => {
    const actorId = await makeActor();
    await awardPoints(actorId, { amount: 30, kind: 'quiz_completed', refId: crypto.randomUUID() });

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        spendPoints(actorId, { amount: 30, kind: 'test_spend', refId: crypto.randomUUID() })
      )
    );
    const succeeded = attempts.filter((r) => r.status === 'fulfilled' && r.value.spent).length;
    assert.equal(succeeded, 1);

    const wallet = await getWallet(actorId);
    assert.equal(wallet.balance, 0);
  });

  it('tarix tranzaksiyalarni qaytaradi', async () => {
    const actorId = await makeActor();
    await awardPoints(actorId, { amount: 25, kind: 'quiz_completed', refId: crypto.randomUUID() });
    const history = await getHistory(actorId);
    assert.equal(history.length, 1);
    assert.equal(history[0].amount, 25);
    assert.equal(history[0].kind, 'quiz_completed');
  });
});

describe('javob ochish (unlock)', () => {
  it('ball yetarli bo‘lsa ochiladi, takror chaqirsa qayta yechmaydi', async () => {
    const actorId = await makeActor();
    const attemptId = crypto.randomUUID();
    await awardPoints(actorId, { amount: 100, kind: 'quiz_completed', refId: crypto.randomUUID() });

    const res = await unlockAnswerReview(actorId, attemptId, 5);
    assert.equal(res.unlocked, true);
    assert.equal(res.cost, 30);
    assert.equal(res.balance, 70);
    assert.equal(await isReviewUnlocked(attemptId), true);

    const again = await unlockAnswerReview(actorId, attemptId, 5);
    assert.equal(again.alreadyUnlocked, true);
    const wallet = await getWallet(actorId);
    assert.equal(wallet.balance, 70); // qayta yechilmagan
  });

  it('ball yetmasa 402 va unlock yozilmaydi', async () => {
    const actorId = await makeActor();
    const attemptId = crypto.randomUUID();
    await assert.rejects(
      () => unlockAnswerReview(actorId, attemptId, 10),
      (err) => err.statusCode === 402
    );
    assert.equal(await isReviewUnlocked(attemptId), false);
  });
});

describe('reyting va profil', () => {
  it('faqat opt-in + nickname bor foydalanuvchi reytingda ko‘rinadi', async () => {
    const actorId = await makeActor();
    await awardPoints(actorId, {
      amount: 999999,
      kind: 'quiz_completed',
      refId: crypto.randomUUID(),
    });

    let lb = await getLeaderboard({ limit: 100 });
    assert.ok(!lb.some((r) => r.totalEarned === 999999), 'opt-in siz ko‘rinmasligi kerak');

    const nick = `test_${crypto.randomBytes(3).toString('hex')}`;
    await setLeaderboardProfile(actorId, { nickname: nick, optIn: true });
    lb = await getLeaderboard({ limit: 100 });
    const me = lb.find((r) => r.nickname === nick);
    assert.ok(me, 'opt-in dan keyin ko‘rinishi kerak');
    assert.equal(me.totalEarned, 999999);
  });

  it('opt-in uchun taxallus kamida 3 belgi', async () => {
    const actorId = await makeActor();
    await assert.rejects(
      () => setLeaderboardProfile(actorId, { nickname: 'ab', optIn: true }),
      (err) => err.statusCode === 400
    );
  });
});
