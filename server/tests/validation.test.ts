import { describe, it, expect } from 'vitest';
import {
  parseId,
  parsePagination,
  parseFilters,
  parseSort,
  parseSearchTerm,
  parseUpdateBody,
  parseBatchBody,
} from '../src/middleware/validation';

// These are pure functions with no Supabase dependency, so no mocking is needed.

describe('parseId', () => {
  it('accepts a positive integer string', () => {
    expect(parseId('5')).toBe(5);
  });
  it('rejects zero, negatives, and non-integers', () => {
    expect(parseId('0')).toBeNull();
    expect(parseId('-1')).toBeNull();
    expect(parseId('5.5')).toBeNull();
    expect(parseId('5abc')).toBeNull();
    expect(parseId('')).toBeNull();
  });
  it('rejects non-string input', () => {
    expect(parseId(5 as unknown as string)).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
});

describe('parsePagination', () => {
  it('defaults to limit 50 / offset 0', () => {
    expect(parsePagination({})).toEqual({ limit: 50, offset: 0 });
  });
  it('clamps limit to [1, 50]', () => {
    expect(parsePagination({ limit: '999' }).limit).toBe(50);
    expect(parsePagination({ limit: '0' }).limit).toBe(1);
  });
  it('caps offset at 100000 and floors negatives to default', () => {
    expect(parsePagination({ offset: '5000000' }).offset).toBe(100_000);
    expect(parsePagination({ offset: '-5' }).offset).toBe(0);
  });
});

describe('parseFilters', () => {
  it('splits comma-separated values and maps attack_type', () => {
    const f = parseFilters({ team: 'A, B', attack_type: 'sprint' });
    expect(f.team).toEqual(['A', 'B']);
    expect(f.attackType).toEqual(['sprint']);
  });
  it('parses years and drops out-of-range values', () => {
    const f = parseFilters({ year: '2024, notayear, 1800, 2025' });
    expect(f.year).toEqual([2024, 2025]);
  });
});

describe('parseSort', () => {
  it('falls back to attack_date desc for unknown columns/orders', () => {
    expect(parseSort({ sort: 'not_a_column', order: 'sideways' })).toEqual({
      column: 'attack_date',
      order: 'desc',
    });
  });
  it('accepts whitelisted column and order', () => {
    expect(parseSort({ sort: 'lp', order: 'asc' })).toEqual({ column: 'lp', order: 'asc' });
  });
});

describe('parseSearchTerm', () => {
  it('strips ILIKE metacharacters and trims', () => {
    expect(parseSearchTerm({ search: '  a%b_c  ' })).toBe('abc');
  });
  it('caps length at 100 characters', () => {
    expect(parseSearchTerm({ search: 'x'.repeat(250) })).toHaveLength(100);
  });
  it('returns empty string for missing/non-string search', () => {
    expect(parseSearchTerm({})).toBe('');
  });
});

describe('parseUpdateBody', () => {
  it('rejects a non-object body', () => {
    expect(parseUpdateBody(null)).toEqual({ valid: false, error: expect.any(String) });
    expect(parseUpdateBody([]).valid).toBe(false);
  });
  it('rejects an empty object', () => {
    expect(parseUpdateBody({}).valid).toBe(false);
  });
  it('rejects forbidden fields', () => {
    for (const field of ['id', 'created_at', 'final_time']) {
      expect(parseUpdateBody({ [field]: 1 }).valid).toBe(false);
    }
  });
  it('rejects unknown fields', () => {
    expect(parseUpdateBody({ bogus: 'x' }).valid).toBe(false);
  });
  it('enforces lp/pp range [12.01, 99.99]', () => {
    expect(parseUpdateBody({ lp: 12.0 }).valid).toBe(false);
    expect(parseUpdateBody({ lp: 100 }).valid).toBe(false);
    expect(parseUpdateBody({ lp: 16.5 })).toEqual({ valid: true, data: { lp: 16.5 } });
    expect(parseUpdateBody({ lp: null })).toEqual({ valid: true, data: { lp: null } });
  });
  it('enforces placement integer range [1, 999]', () => {
    expect(parseUpdateBody({ placement: 0 }).valid).toBe(false);
    expect(parseUpdateBody({ placement: 1000 }).valid).toBe(false);
    expect(parseUpdateBody({ placement: 2.5 }).valid).toBe(false);
    expect(parseUpdateBody({ placement: 3 })).toEqual({ valid: true, data: { placement: 3 } });
  });
  it('enforces attack_date format and year range', () => {
    expect(parseUpdateBody({ attack_date: '2024-13' }).valid).toBe(false);
    expect(parseUpdateBody({ attack_date: '1989-01-01' }).valid).toBe(false);
    expect(parseUpdateBody({ attack_date: '2024-05-01' })).toEqual({
      valid: true,
      data: { attack_date: '2024-05-01' },
    });
  });
  it('stores empty/null league as null', () => {
    expect(parseUpdateBody({ league: '' })).toEqual({ valid: true, data: { league: null } });
    expect(parseUpdateBody({ league: null })).toEqual({ valid: true, data: { league: null } });
  });
  it('allows empty link but rejects empty required strings', () => {
    expect(parseUpdateBody({ link: '' })).toEqual({ valid: true, data: { link: '' } });
    expect(parseUpdateBody({ team: '  ' }).valid).toBe(false);
  });
});

describe('parseBatchBody', () => {
  const validInsert = {
    attack_date: '2024-05-01',
    place: 'Brno',
    attack_type: 'útok',
    category: 'muži',
    team: 'SDH Test',
    placement: 1,
    lp: 16.2,
    pp: 16.5,
  };

  it('rejects a body missing the three arrays', () => {
    expect(parseBatchBody({ updates: [], inserts: [] }).valid).toBe(false);
  });
  it('rejects an invalid delete id', () => {
    const r = parseBatchBody({ updates: [], inserts: [], deletes: [0] });
    expect(r.valid).toBe(false);
  });
  it('accepts a valid batch with no field errors', () => {
    const r = parseBatchBody({ updates: [], inserts: [validInsert], deletes: [1] });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.fieldErrors).toHaveLength(0);
      expect(r.data.inserts).toHaveLength(1);
      expect(r.data.deletes).toEqual([1]);
    }
  });
  it('collects field errors for out-of-range values', () => {
    const r = parseBatchBody({
      updates: [{ id: 5, fields: { lp: 5 } }],
      inserts: [],
      deletes: [],
    });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.fieldErrors.length).toBeGreaterThan(0);
  });
  it('flags forbidden fields inside an update', () => {
    const r = parseBatchBody({
      updates: [{ id: 5, fields: { final_time: 12 } }],
      inserts: [],
      deletes: [],
    });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.fieldErrors.some((e) => e.field === 'final_time')).toBe(true);
  });
  it('stores an absent league on insert as null', () => {
    const { league, ...noLeague } = validInsert;
    void league;
    const r = parseBatchBody({ updates: [], inserts: [noLeague], deletes: [] });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.data.inserts[0].league).toBeNull();
  });
});
