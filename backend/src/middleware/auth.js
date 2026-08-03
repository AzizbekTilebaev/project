import { getUserByToken, publicUser } from '../services/authService.js';

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      req.user = null;
      return next();
    }
    const row = await getUserByToken(token);
    req.user = row ? publicUser(row) : null;
    req.authToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(req, res, next) {
  await optionalAuth(req, res, async (err) => {
    if (err) return next(err);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Kiriw kerek' });
    }
    next();
  });
}
