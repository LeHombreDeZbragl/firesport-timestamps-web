import pino from 'pino';

const nodeEnv = process.env['NODE_ENV'] ?? 'development';

/**
 * Singleton Pino logger.
 *
 * Production  → structured JSON written to stdout; consumed by Fly.io's log
 *               aggregator (or any log shipper that reads structured JSON).
 * Development → human-readable pretty output via pino-pretty transport.
 *               pino-pretty is a devDependency and must not be relied on in
 *               production builds.
 */
const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (nodeEnv === 'test' ? 'silent' : 'info'),
  ...(nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export default logger;
