import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (two levels up from server/src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = Number(process.env['PORT'] ?? 3001);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env['NODE_ENV'] === 'production' ? false : 'http://localhost:5173',
    methods: ['GET'],
  })
);
app.use(express.json());

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
