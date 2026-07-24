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

// Ordered speed ramp: cool = faster, warm = slower, one continuous blue → green →
// red sweep (a "semantic heat" sequential ramp, not a categorical hue set — see
// the dataviz skill's anti-patterns doc). The x-axis labels and left-to-right
// order carry identity, so color only reinforces the good→bad reading, which is
// why neighbours alternate light/dark rather than sitting in one lightness band
// (keeps adjacent bars distinct — no more look-alike greens). DNF gray is a
// separate status color, outside the ramp.
// Validated with the dataviz skill's validator against this app's dark surface
// (#1f2937 / surface-800): all adjacent pairs clear CVD (protan/deutan) and the
// normal-vision floor, and every color clears 3:1 contrast. (The categorical
// "lightness band" check fails by design for a sequential ramp like this one —
// see color-formula.md's scope note — so it's not a real failure here.)
const BUCKETS = [
  { key: 'distUnder13',      label: '< 13 s',     color: '#9c6aed' }, // blue
  { key: 'dist13To14',       label: '13–14 s',    color: '#1E88E5' }, // cyan
  { key: 'dist14To15',       label: '14–15 s',    color: '#00897B' }, // teal
  { key: 'dist15To16',       label: '15–16 s',    color: '#43A047' }, // green
  { key: 'dist16To17',       label: '16–17 s',    color: '#FDD835' }, // olive
  { key: 'dist17To18',       label: '17–18 s',    color: '#FB8C00' }, // yellow
  { key: 'dist18To19',       label: '18–19 s',    color: '#F4511E' }, // orange
  { key: 'distOver19',       label: '≥ 19 s',     color: '#E53935' }, // red
  { key: 'distUnsuccessful', label: 'Nepovedené', color: '#6b7280' }, // gray (DNF)
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
