import dotenv from 'dotenv';
import path from 'path';
import app from './app';
import logger from './services/logger';

// Load .env from project root (two levels up from server/src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Startup validation ────────────────────────────────────────────────────────

const nodeEnv = process.env['NODE_ENV'] ?? 'development';

const rawPort = process.env['PORT'] ?? '3001';
const port = parseInt(rawPort, 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: "${rawPort}". Must be an integer between 1 and 65535.`);
}

// ─── Start + graceful shutdown ─────────────────────────────────────────────────
const server = app.listen(port, () => {
  logger.info({ port, env: nodeEnv }, 'Server started');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received — stopping server');
  server.close(() => {
    logger.info('All connections closed — process exiting');
    process.exit(0);
  });
  // Force-exit if connections don't drain within 10 s (e.g. keep-alive sockets).
  setTimeout(() => {
    logger.error('Forced shutdown after 10 s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
