import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createChain } from './helpers/supabase';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('../src/services/supabaseClient', () => ({ default: { rpc, from } }));

import app from '../src/app';

const ADMIN_SECRET = process.env['ADMIN_SECRET'] as string;
const JWT_SECRET = process.env['JWT_SECRET'] as string;

beforeEach(() => {
  process.env['ADMIN_SECRET'] = ADMIN_SECRET;
});
afterEach(() => {
  process.env['ADMIN_SECRET'] = ADMIN_SECRET;
});

describe('POST /api/auth/login', () => {
  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('returns a JWT for the correct password', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: ADMIN_SECRET });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    const payload = jwt.verify(res.body.token, JWT_SECRET) as jwt.JwtPayload;
    expect(payload.role).toBe('admin');
  });

  it('returns 403 when ADMIN_SECRET is unset (read-only server)', async () => {
    delete process.env['ADMIN_SECRET'];
    const res = await request(app).post('/api/auth/login').send({ password: 'anything' });
    expect(res.status).toBe(403);
  });
});

describe('requireAdmin on write routes', () => {
  it('rejects a write with no Bearer token (401)', async () => {
    const res = await request(app).delete('/api/timestamps/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when ADMIN_SECRET is unset', async () => {
    delete process.env['ADMIN_SECRET'];
    const res = await request(app).delete('/api/timestamps/1');
    expect(res.status).toBe(403);
  });

  it('passes a valid admin token through to the handler', async () => {
    from.mockReturnValue(createChain({ error: null }));
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET);

    const res = await request(app)
      .delete('/api/timestamps/1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(from).toHaveBeenCalledWith('timestamps');
  });

  it('rejects a token signed with the wrong secret (401)', async () => {
    const badToken = jwt.sign({ role: 'admin' }, 'wrong-secret');
    const res = await request(app)
      .delete('/api/timestamps/1')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
  });
});
