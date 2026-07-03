import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createChain } from './helpers/supabase';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('../src/services/supabaseClient', () => ({ default: { rpc, from } }));

import app from '../src/app';

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe('GET /api/timestamps', () => {
  it('returns a paginated payload', async () => {
    const row = { id: 1, team: 'A', attack_date: '2024-01-01' };
    from.mockReturnValue(createChain({ data: [row], count: 1, error: null }));

    const res = await request(app).get('/api/timestamps');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [row], totalCount: 1, hasMore: false });
  });

  it('returns 500 when the query errors', async () => {
    from.mockReturnValue(createChain({ data: null, count: null, error: { message: 'boom' } }));

    const res = await request(app).get('/api/timestamps');
    expect(res.status).toBe(500);
  });

  it('reports hasMore when more rows remain than the page', async () => {
    from.mockReturnValue(createChain({ data: [], count: 500, error: null }));

    const res = await request(app).get('/api/timestamps?limit=50&offset=0');
    expect(res.body.hasMore).toBe(true);
    expect(res.body.totalCount).toBe(500);
  });
});

describe('GET /api/timestamps/distinct/years (W1 null-data guard)', () => {
  it('returns an empty array when the RPC yields data: null instead of throwing', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await request(app).get('/api/timestamps/distinct/years');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ years: [] });
  });

  it('maps RPC rows to a years array', async () => {
    rpc.mockResolvedValue({ data: [{ year: 2025 }, { year: 2024 }], error: null });

    const res = await request(app).get('/api/timestamps/distinct/years');
    expect(res.body).toEqual({ years: [2025, 2024] });
  });

  it('returns 500 on RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const res = await request(app).get('/api/timestamps/distinct/years');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/timestamps/distinct/:column', () => {
  it('rejects a non-whitelisted column with 400 (no DB call)', async () => {
    const res = await request(app).get('/api/timestamps/distinct/not_a_column');
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns an empty array when the RPC yields data: null (W1 guard)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await request(app).get('/api/timestamps/distinct/team');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ values: [] });
  });

  it('maps RPC rows to a values array', async () => {
    rpc.mockResolvedValue({ data: [{ value: 'Brno' }, { value: 'Praha' }], error: null });

    const res = await request(app).get('/api/timestamps/distinct/place');
    expect(res.body).toEqual({ values: ['Brno', 'Praha'] });
  });
});

describe('GET /api/timestamps/distinct/league-pairs (W1 null-data guard)', () => {
  it('returns an empty array when the RPC yields data: null', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const res = await request(app).get('/api/timestamps/distinct/league-pairs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pairs: [] });
  });
});

describe('Unknown /api routes (W4 404 guard)', () => {
  it('returns a JSON 404 for an unknown /api path', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found.' });
    expect(res.type).toMatch(/json/);
  });

  it('returns a JSON 404 for an unknown method on a known /api prefix', async () => {
    const res = await request(app).put('/api/timestamps/nonsense/path');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found.' });
  });
});
