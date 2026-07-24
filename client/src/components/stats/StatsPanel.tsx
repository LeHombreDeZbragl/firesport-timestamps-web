import type { Stats, GraphStats } from '../../types';
import { AttackDistributionChart } from './AttackDistributionChart';
import { TimeProgressionChart } from './TimeProgressionChart';

interface StatCardProps {
  label: string;
  value: string;
  isLoading: boolean;
}

function StatCard({ label, value, isLoading }: StatCardProps): React.JSX.Element {
  return (
    <div className="h-full flex flex-col gap-1 rounded-lg border border-surface-700 bg-surface-800 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-surface-400">{label}</dt>
      {isLoading ? (
        <dd className="h-7 w-20 animate-pulse rounded bg-surface-700" aria-hidden="true" />
      ) : (
        <dd className="text-xl font-bold text-white">{value}</dd>
      )}
    </div>
  );
}

interface ChartCardProps {
  label: string;
  children: React.ReactNode;
}

function ChartCard({ label, children }: ChartCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-surface-700 bg-surface-800 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-surface-400">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatTime(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)} s`;
}

function formatRatio(lpFaster: number, ppFaster: number, _equal: number): string {
  const total = lpFaster + ppFaster;
  if (total === 0) return '—';
  const lpPct = ((lpFaster / total) * 100).toFixed(0);
  const ppPct = ((ppFaster / total) * 100).toFixed(0);
  return `LP ${lpPct}% / PP ${ppPct}%`;
}

function formatProstrik(avgLp: number | null, avgPp: number | null): string {
  if (avgLp === null || avgPp === null) return '—';
  const diff = avgLp - avgPp;
  if (Math.abs(diff) < 0.005) return '—';
  return diff > 0
    ? `LP +${diff.toFixed(2)} s`
    : `PP +${(-diff).toFixed(2)} s`;
}

function formatSuccessRatio(successful: number, unsuccessful: number): string {
  const total = successful + unsuccessful;
  if (total === 0) return '—';
  return `${successful.toLocaleString()} / ${unsuccessful.toLocaleString()}`;
}

interface StatsPanelProps {
  stats: Stats | null;
  isLoading: boolean;
  graphStats: GraphStats | null;
  graphStatsLoading: boolean;
}

export function StatsPanel({ stats, isLoading, graphStats, graphStatsLoading }: StatsPanelProps): React.JSX.Element {
  return (
    <section aria-label="Statistics">
      <dl className="grid grid-cols-3 gap-3 lg:grid-cols-5 xl:grid-cols-7">
        <StatCard
          label="Celkem útoků"
          value={stats ? stats.totalCount.toLocaleString() : '—'}
          isLoading={isLoading}
        />
        <StatCard
          label="Nejlepší čas"
          value={formatTime(stats?.bestTime ?? null)}
          isLoading={isLoading}
        />
        <StatCard
          label="Průměrný čas"
          value={formatTime(stats?.averageTime ?? null)}
          isLoading={isLoading}
        />
        <StatCard
          label="Medián časů"
          value={formatTime(stats?.medianTime ?? null)}
          isLoading={isLoading}
        />
        <div className="col-span-2 order-5 md:col-span-1 md:order-6 lg:order-5">
          <StatCard
            label="Průměrný prostřik"
            value={stats ? formatProstrik(stats.avgLp, stats.avgPp) : '—'}
            isLoading={isLoading}
          />    
        </div>
        <div className="order-6 col-span-3 md:col-span-2 md:order-5 lg:order-6 xl:col-span-1">
          <StatCard
            label="Poměr LP / PP"
            value={
              stats
                ? formatRatio(stats.lpFasterCount, stats.ppFasterCount, stats.equalCount)
                : '—'
            }
            isLoading={isLoading}
          />
        </div>    
        <div className="col-span-3 order-6 md:col-span-2 md:order-7 lg:order-8 xl:col-span-1 xl:order-7">
          <StatCard
            label="Povedené / Nepovedené"
            value={
              stats
                ? formatSuccessRatio(stats.successfulCount, stats.unsuccessfulCount)
                : '—'
            }
            isLoading={isLoading}
          />
        </div>
        <div className="order-7 col-span-3 md:row-span-2 lg:row-span-2 xl:col-span-2">
          <ChartCard label="Rozložení časů">
            <AttackDistributionChart
              graphStats={graphStats ?? {
                distUnder13: 0, dist13To14: 0, dist14To15: 0, dist15To16: 0,
                dist16To17: 0, dist17To18: 0, dist18To19: 0,
                distOver19: 0, distUnsuccessful: 0, progression: [],
              }}
              isLoading={graphStatsLoading}
            />
          </ChartCard>
        </div>
        <div className="order-8 col-span-3 md:col-span-3 lg:col-span-5">
          <ChartCard label="Vývoj časů">
            <TimeProgressionChart
              progression={graphStats?.progression ?? []}
              isLoading={graphStatsLoading}
            />
          </ChartCard>
        </div>
      </dl>
    </section>
  );
}
