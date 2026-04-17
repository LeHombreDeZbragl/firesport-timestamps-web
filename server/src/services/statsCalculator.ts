import { type StatsResponse, type TimestampRow } from '../types/index';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Computes the arithmetic mean of a non-empty array of numbers.
 * Returns null for an empty array.
 */
function computeAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((accumulator, value) => accumulator + value, 0);
  return sum / values.length;
}

/**
 * Returns the minimum value in an array.
 * Returns null for an empty array.
 */
function computeMin(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

/**
 * Computes the median of an array by sorting a copy and picking the middle.
 * For even-length arrays, returns the lower-middle element (no interpolation
 * is needed since times are float values and exact middle selection is fine).
 * Returns null for an empty array.
 */
function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    // Odd count: exact middle element
    return sorted[midIndex] ?? null;
  }
  // Even count: average the two middle elements
  const lower = sorted[midIndex - 1];
  const upper = sorted[midIndex];
  if (lower === undefined || upper === undefined) return null;
  return (lower + upper) / 2;
}

// ─── Main export ───────────────────────────────────────────────────────────────

interface LpPpRow {
  lp: TimestampRow['lp'];
  pp: TimestampRow['pp'];
}

/**
 * Computes all summary statistics from an array of rows containing lp and pp.
 *
 * Rules:
 * - A row is included in time calculations only if BOTH lp and pp are non-null.
 * - The "final time" for a row is max(lp, pp) — whoever finishes last.
 * - LP:PP ratio counts rows where lp < pp (LP was faster) vs pp < lp (PP was faster).
 * - `totalCount` reflects ALL filtered rows (passed in separately since the
 *   stats query may return only lp/pp columns).
 */
export function computeStats(rows: LpPpRow[], totalCount: number): StatsResponse {
  // Separate rows where both values are present
  const completeRows = rows.filter(
    (row): row is { lp: number; pp: number } =>
      row.lp !== null && row.pp !== null
  );

  const finalTimes = completeRows.map((row) => Math.max(row.lp, row.pp));

  const averageTime = computeAverage(finalTimes);
  const bestTime = computeMin(finalTimes);
  const medianTime = computeMedian(finalTimes);

  let lpFasterCount = 0;
  let ppFasterCount = 0;
  let equalCount = 0;

  for (const row of completeRows) {
    if (row.lp < row.pp) {
      lpFasterCount++;
    } else if (row.pp < row.lp) {
      ppFasterCount++;
    } else {
      equalCount++;
    }
  }

  return {
    averageTime,
    bestTime,
    medianTime,
    lpFasterCount,
    ppFasterCount,
    equalCount,
    totalCount,
  };
}
