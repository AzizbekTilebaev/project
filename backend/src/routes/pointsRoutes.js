import { Router } from 'express';
import { requireActor } from '../middleware/actor.js';
import { optionalAuth } from '../middleware/auth.js';
import { resolveActorScope } from '../services/quotaService.js';
import {
  getAggregatedWallet,
  getHistory,
  getLeaderboard,
  getMyRank,
  getLeaderboardProfile,
  setLeaderboardProfile,
} from '../services/pointsService.js';

const router = Router();

router.get('/me', requireActor, optionalAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const scope = await resolveActorScope(req.actor.id, req.user?.id || null);
    const [wallet, rank, profile] = await Promise.all([
      getAggregatedWallet(scope),
      getMyRank(req.actor.id),
      getLeaderboardProfile(req.actor.id),
    ]);
    res.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent,
        level: wallet.level,
        levelProgress: wallet.levelProgress,
        levelNextAt: wallet.levelNextAt,
      },
      rank: rank.rank,
      profile,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me/history', requireActor, optionalAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const scope = await resolveActorScope(req.actor.id, req.user?.id || null);
    const history = await getHistory(scope, req.query?.limit);
    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

router.put('/me/profile', requireActor, async (req, res, next) => {
  try {
    const profile = await setLeaderboardProfile(req.actor.id, {
      nickname: req.body?.nickname,
      optIn: req.body?.optIn,
    });
    res.json({ success: true, profile });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=60');
    const leaderboard = await getLeaderboard({ limit: req.query?.limit });
    res.json({ success: true, leaderboard });
  } catch (err) {
    next(err);
  }
});

export default router;
