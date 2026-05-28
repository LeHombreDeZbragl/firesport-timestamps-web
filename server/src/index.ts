import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import timestampsRouter from './routes/timestamps';
import authRouter from './routes/auth';

// Load .env from project root (two levels up from server/src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = Number(process.env['PORT'] ?? 3001);

// ─── Rate limiting ─────────────────────────────────────────────────────────────
//
// Applied globally to all /api/* routes.
// 200 requests per minute per IP  — generous for a single-user dashboard,
// still protects against scrapers and accidental request storms.
//
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: 'draft-7', // Return rate limit info in RateLimit-* headers (RFC draft 7)
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env['NODE_ENV'] === 'production' ? false : 'http://localhost:5173',
    methods: ['GET'],
  })
);
app.use(express.json());

// ─── API routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRateLimiter);
app.use('/api/auth', authRouter);
app.use('/api/timestamps', timestampsRouter);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ──────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error('[server] Unhandled error:', err.message);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
);

// ─── Serve React build in production ──────────────────────────────────────────
if (process.env['NODE_ENV'] === 'production') {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  console.log(`[server] Running at http://localhost:${port}`);
  console.log(`[server] Supabase URL: ${process.env['SUPABASE_URL'] ?? 'NOT SET'}`);
});
