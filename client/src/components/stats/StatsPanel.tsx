import type { Stats } from '../../types';

interface StatCardProps {
  label: string;
  value: string;
  isLoading: boolean;
}

function StatCard({ label, value, isLoading }: StatCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-surface-700 bg-surface-800 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-surface-400">{label}</dt>
      {isLoading ? (
        <dd className="h-7 w-20 animate-pulse rounded bg-surface-700" aria-hidden="true" />
      ) : (
        <dd className="text-xl font-bold text-white">{value}</dd>
      )}
    </div>
  );
}

function formatTime(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)} s`;
}

function formatRatio(lpFaster: number, ppFaster: number, equal: number): string {
  const total = lpFaster + ppFaster + equal;
  if (total === 0) return '—';
  const lpPct = ((lpFaster / total) * 100).toFixed(0);
  const ppPct = ((ppFaster / total) * 100).toFixed(0);
  return `LP ${lpPct}% / PP ${ppPct}%`;
}

interface StatsPanelProps {
  stats: Stats | null;
  isLoading: boolean;
}

export function StatsPanel({ stats, isLoading }: StatsPanelProps): React.JSX.Element {
  return (
    <section aria-label="Statistics">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Total Attacks"
          value={stats ? stats.totalCount.toLocaleString() : '—'}
          isLoading={isLoading}
        />
        <StatCard
          label="Average Time"
          value={formatTime(stats?.averageTime ?? null)}
          isLoading={isLoading}
        />
        <StatCard
          label="Best Time"
          value={formatTime(stats?.bestTime ?? null)}
          isLoading={isLoading}
        />
        <StatCard
          label="Median Time"
          value={formatTime(stats?.medianTime ?? null)}
          isLoading={isLoading}
        />
        <StatCard
          label="LP : PP Ratio"
          value={
            stats
              ? formatRatio(stats.lpFasterCount, stats.ppFasterCount, stats.equalCount)
              : '—'
          }
          isLoading={isLoading}
        />
      </dl>
    </section>
  );
}
