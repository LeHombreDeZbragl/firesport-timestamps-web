import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Hoisted mock fns so the vi.mock factory (which is hoisted above imports) can
// safely reference them.
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('../src/services/supabaseClient', () => ({ default: { rpc, from } }));

// Import the app *after* the mock is registered.
import app from '../src/app';

const token = jwt.sign({ role: 'admin' }, process.env['JWT_SECRET'] as string);
const auth = { Authorization: `Bearer ${token}` };

// Distinct vocabulary the route validates inserts/updates against.
const DISTINCT: Record<string, Array<{ value: string }>> = {
  league: [{ value: 'PL' }],
  attack_type: [{ value: 'útok' }],
  category: [{ value: 'muži' }],
};

const validInsert = {
  attack_date: '2024-05-01',
  place: 'Brno',
  attack_type: 'útok',
  category: 'muži',
  team: 'SDH Test',
  league: 'PL',
  placement: 1,
  lp: 16.2,
  pp: 16.5,
};

beforeEach(() => {
  // Default: distinct-set lookups succeed, batch RPC succeeds.
  rpc.mockImplementation((fn: string, params: { p_column?: string }) => {
    if (fn === 'get_distinct_column_values') {
      return Promise.resolve({ data: DISTINCT[params.p_column ?? ''] ?? [], error: null });
    }
    if (fn === 'batch_save_timestamps') {
      return Promise.resolve({ data: { deleted: 0, updated: 0, inserted: 1 }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe('POST /api/timestamps/batch', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/timestamps/batch').send({
      updates: [], inserts: [], deletes: [],
    });
    expect(res.status).toBe(401);
  });

  it('applies a valid batch and returns { success: true }', async () => {
    const res = await request(app)
      .post('/api/timestamps/batch')
      .set(auth)
      .send({ updates: [], inserts: [validInsert], deletes: [3] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    // The atomic write path (W2) is invoked once with the *validated* payload —
    // validateBatchInsert defaults an absent `link` to an empty string.
    expect(rpc).toHaveBeenCalledWith('batch_save_timestamps', {
      p_deletes: [3],
      p_updates: [],
      p_inserts: [{ ...validInsert, link: '' }],
    });
  });

  it('returns 400 with field errors for out-of-range values', async () => {
    const res = await request(app)
      .post('/api/timestamps/batch')
      .set(auth)
      .send({ updates: [{ id: 1, fields: { lp: 5 } }], inserts: [], deletes: [] });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(rpc).not.toHaveBeenCalledWith('batch_save_timestamps', expect.anything());
  });

  it('returns 400 for a league value not in the DB vocabulary', async () => {
    const res = await request(app)
      .post('/api/timestamps/batch')
      .set(auth)
      .send({ updates: [], inserts: [{ ...validInsert, league: 'NON_EXISTENT' }], deletes: [] });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e: { field: string }) => e.field === 'league')).toBe(true);
  });

  it('returns 500 when the atomic write RPC rejects (W2 rollback path)', async () => {
    rpc.mockImplementation((fn: string, params: { p_column?: string }) => {
      if (fn === 'get_distinct_column_values') {
        return Promise.resolve({ data: DISTINCT[params.p_column ?? ''] ?? [], error: null });
      }
      // batch_save_timestamps fails (e.g. a constraint violation → full rollback).
      return Promise.resolve({ data: null, error: { message: 'constraint violation' } });
    });

    const res = await request(app)
      .post('/api/timestamps/batch')
      .set(auth)
      .send({ updates: [], inserts: [validInsert], deletes: [] });

    expect(res.status).toBe(500);
  });
});
