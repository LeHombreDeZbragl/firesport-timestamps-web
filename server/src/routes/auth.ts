import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─── Rate limiter ───────────────────────────────────────────────────────────────
//
// Very strict: 5 login attempts per 15 minutes per IP.
// skipSuccessfulRequests ensures only failed attempts count toward the limit.
//
// Disabled under test (no-op passthrough) so the suite can exercise the login
// route repeatedly without tripping the strict per-IP limit.
const loginLimiter =
  process.env['NODE_ENV'] === 'test'
    ? ((_req: Request, _res: Response, next: NextFunction): void => next())
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        skipSuccessfulRequests: true,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
      });

// ─── POST /api/auth/login ───────────────────────────────────────────────────────
//
// Accepts { password } in the request body.
// Returns { token } — a signed JWT valid for 8 hours — on success.
// Always waits a constant minimum time before responding to prevent
// timing-based enumeration of the correct password.
//
const MIN_RESPONSE_MS = 200;

router.post('/login', loginLimiter, (req: Request, res: Response): void => {
  const start = Date.now();

  const adminSecret = process.env['ADMIN_SECRET'];
  if (!adminSecret) {
    res.status(403).json({ error: 'Write access is disabled on this server.' });
    return;
  }

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    res.status(500).json({ error: 'Server misconfiguration.' });
    return;
  }

  const { password } = req.body as { password?: unknown };

  const delay = () => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, MIN_RESPONSE_MS - elapsed);
    return new Promise<void>((resolve) => setTimeout(resolve, remaining));
  };

  const respond = async () => {
    if (typeof password !== 'string' || password !== adminSecret) {
      await delay();
      res.status(401).json({ error: 'Invalid password.' });
      return;
    }

    const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '8h' });
    await delay();
    res.json({ token });
  };

  respond().catch(() => {
    res.status(500).json({ error: 'An unexpected error occurred.' });
  });
});

// ─── GET /api/auth/status ───────────────────────────────────────────────────────
//
// Returns whether admin login is available on this server instance.
// The client uses this to decide whether to show the "Admin login" button at all.
// No secret is exposed — only a boolean derived from env var presence.
//
router.get('/status', (_req: Request, res: Response) => {
  res.json({ adminEnabled: !!process.env['ADMIN_SECRET'] });
});

export default router;
