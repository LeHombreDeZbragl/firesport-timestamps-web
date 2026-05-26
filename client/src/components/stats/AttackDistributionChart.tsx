import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { GraphStats } from '../../types';

interface AttackDistributionChartProps {
  graphStats: GraphStats;
  isLoading: boolean;
}

const BUCKETS = [
  { key: 'distUnder16',      label: '< 16 s',    color: '#22c55e' },
  { key: 'dist16To17',       label: '16–17 s',    color: '#84cc16' },
  { key: 'dist17To18',       label: '17–18 s',    color: '#eab308' },
  { key: 'distOver18',       label: '≥ 18 s',     color: '#f97316' },
  { key: 'distUnsuccessful', label: 'Nepovedené', color: '#6b7280' },
] as const;

interface ChartEntry { label: string; color: string; value: number; }

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ChartEntry }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div style={{
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '12px',
      color: '#f3f4f6',
    }}>
      <span style={{ color: entry.color }}>{entry.label}</span>
      {': '}
      <strong>{entry.value.toLocaleString()}</strong>
    </div>
  );
}

export function AttackDistributionChart({
  graphStats,
  isLoading,
}: AttackDistributionChartProps): React.JSX.Element {
  const chartData: ChartEntry[] = BUCKETS
    .filter(({ key }) => graphStats[key] > 0)
    .map(({ key, label, color }) => ({
      label,
      color,
      value: graphStats[key],
    }));

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded bg-surface-700" aria-hidden="true" />;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="label"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tick={(props: any) => {
            const { x, y, payload } = props as {
              x: number; y: number;
              payload: { value: string };
            };
            const item = chartData.find((d) => d.label === payload.value);
            return (
              <text
                x={x} y={y + 12}
                textAnchor="middle"
                fontSize={11}
                fill={item?.color ?? '#9ca3af'}
              >
                {payload.value}
              </text>
            );
          }}
          interval={0}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => <CustomTooltip {...(props as CustomTooltipProps)} />}
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
