import { Request, Response, NextFunction } from 'express';

const ADMIN_SECRET = process.env['ADMIN_SECRET'];

/**
 * Middleware that protects write routes (PATCH, DELETE, POST /batch).
 *
 * If ADMIN_SECRET is not set in the environment the server treats itself as
 * read-only and rejects every write request with 403.
 * If it is set, the request must carry a matching X-Admin-Secret header.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_SECRET) {
    res.status(403).json({ error: 'Write access is disabled.' });
    return;
  }

  const provided = req.headers['x-admin-secret'];
  if (provided !== ADMIN_SECRET) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }

  next();
}
