import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Middleware that protects write routes (PATCH, DELETE, POST /batch).
 *
 * Expects an `Authorization: Bearer <token>` header containing a JWT that was
 * issued by POST /api/auth/login. If ADMIN_SECRET is not set in the
 * environment the server treats itself as read-only and rejects every write
 * request with 403.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!process.env['ADMIN_SECRET']) {
    res.status(403).json({ error: 'Write access is disabled.' });
    return;
  }

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    res.status(500).json({ error: 'Server misconfiguration.' });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
