import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async handler so rejected promises reach the global error handler.
 *
 * Express 4 does not forward a rejected promise from an async handler to the
 * error-handling middleware; without this the request hangs until the client
 * times out. Wrapping every async route handler in `asyncHandler` funnels any
 * throw/rejection into `next(err)`, which the catch-all error handler in
 * `index.ts` turns into a JSON 500.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
