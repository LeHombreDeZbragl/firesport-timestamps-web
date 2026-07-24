import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import timestampsRouter from './routes/timestamps';
import authRouter from './routes/auth';
import logger from './services/logger';

// Load .env from project root (two levels up from server/src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Environment ────────────────────────────────────────────────────────────────

const nodeEnv = process.env['NODE_ENV'] ?? 'development';
if (!['production', 'development', 'test'].includes(nodeEnv)) {
  throw new Error(`Invalid NODE_ENV: "${nodeEnv}". Must be production, development, or test.`);
}

const isTest = nodeEnv === 'test';

const app = express();

// ─── Rate limiting ─────────────────────────────────────────────────────────────
//
// Applied globally to all /api/* routes.
// 200 requests per minute per IP  — generous for a single-user dashboard,
// still protects against scrapers and accidental request storms.
// Disabled under test so the suite can hammer endpoints deterministically.
//
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: 'draft-7', // Return rate limit info in RateLimit-* headers (RFC draft 7)
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

// ─── Middleware ────────────────────────────────────────────────────────────────

// Trust the first proxy hop (Fly.io / Nginx) so rate limiting keys on the
// real client IP rather than the proxy address.
app.set('trust proxy', 1);

// Security headers — sets X-Frame-Options, X-Content-Type-Options, HSTS, etc.
// CSP is extended (beyond helmet's 'self'-only defaults) to allow Google
// Analytics (gtag.js): the loader script from googletagmanager.com, its
// inline bootstrap snippet in client/index.html (allowed via exact SHA-256
// hash rather than 'unsafe-inline', so no other inline script is trusted),
// and the beacon/collect requests gtag.js makes to google-analytics.com.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': [
          "'self'",
          'https://www.googletagmanager.com',
          "'sha256-6uOQwjMhECoi1/3VpVDKSMPh7RqZVaHH6ecfrPDsMR8='",
        ],
        'connect-src': [
          "'self'",
          'https://www.google-analytics.com',
          'https://*.google-analytics.com',
          'https://*.analytics.google.com',
          'https://www.googletagmanager.com',
        ],
        'img-src': [
          "'self'",
          'data:',
          'https://www.google-analytics.com',
          'https://www.googletagmanager.com',
        ],
      },
    },
  })
);

// Request / response logging — every request gets a unique ID for tracing.
// The ID is exposed as an X-Request-Id response header for client-side debugging.
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (_req, _res, err) => err.message,
    // Don't log health-check polls to avoid log spam.
    autoLogging: {
      ignore: (req) => req.url === '/api/health',
    },
  })
);

// Expose request ID header so clients can reference it in support requests.
app.use((req, res, next) => {
  res.setHeader('X-Request-Id', (req as express.Request & { id?: string }).id ?? '');
  next();
});

// CORS — in production the React bundle is served from the same origin as the
// API so no cross-origin headers are needed; in development Vite runs on a
// different port and needs to be explicitly allowed.
// Override by setting CORS_ORIGIN in the environment.
const corsOrigin = process.env['CORS_ORIGIN'] ??
  (nodeEnv === 'production' ? false : 'http://localhost:5173');

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// ─── API routes ────────────────────────────────────────────────────────────────
if (!isTest) {
  app.use('/api', apiRateLimiter);
}
app.use('/api/auth', authRouter);
app.use('/api/timestamps', timestampsRouter);

// ─── Health check ──────────────────────────────────────────────────────────────
//
// Lightweight liveness probe — confirms the Node process is alive and able to
// serve requests. Fly.io polls this every 30 s (fly.toml) to decide whether to
// route traffic to this machine.
//
// Deliberately does NOT query the database: Supabase routes all queries through
// PostgREST which maintains its own connection pool. A DB ping here would add
// ~2 880 unnecessary queries per day while providing little extra signal
// (PostgREST/Supabase have their own health monitoring).
//
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Unknown /api routes → JSON 404 ─────────────────────────────────────────────
//
// Registered AFTER the API routers/health but BEFORE the static + SPA fallback
// below, so an unknown /api/... path returns a JSON 404 instead of falling
// through to the catch-all `*` handler and being served index.html with a 200.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
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
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
);

// ─── Serve React build in production ──────────────────────────────────────────
if (nodeEnv === 'production') {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

export default app;
