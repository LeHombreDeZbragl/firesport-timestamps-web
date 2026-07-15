import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ProgressionPoint } from '../../types';

interface TimeProgressionChartProps {
  progression: ProgressionPoint[];
  isLoading: boolean;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDateParts(dateStr: string): { d: string; m: string; y: string } {
  const [y, m, d] = dateStr.split('-');
  return { d, m, y };
}

function formatFull(dateStr: string): string {
  const { d, m, y } = parseDateParts(dateStr);
  return `${d}.${m}.${y}`;
}

function formatMonthYear(dateStr: string): string {
  const { m, y } = parseDateParts(dateStr);
  return `${m}.${y}`;
}

function formatYear(dateStr: string): string {
  return parseDateParts(dateStr).y;
}

type DateFormat = 'full' | 'monthYear' | 'year';

function detectFormat(startDate: string, endDate: string): DateFormat {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
  if (diffDays > 365 * 3) return 'year';
  if (diffDays > 180) return 'monthYear';
  return 'full';
}

function applyFormat(dateStr: string, fmt: DateFormat): string {
  if (fmt === 'year') return formatYear(dateStr);
  if (fmt === 'monthYear') return formatMonthYear(dateStr);
  return formatFull(dateStr);
}

// ── Tick computation ──────────────────────────────────────────────────────────

function computeTicks(count: number, maxTicks: number): number[] {
  if (count === 0) return [];
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i);
  const ticks: number[] = [0];
  const inner = maxTicks - 2;
  for (let i = 1; i <= inner; i++) {
    ticks.push(Math.round((i * (count - 1)) / (maxTicks - 1)));
  }
  ticks.push(count - 1);
  return [...new Set(ticks)];
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface ChartDataPoint {
  i: number;
  startDate: string;
  endDate: string;
  avg: number;
  min: number;
  lp: number | null;
  pp: number | null;
  place: string | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | null;
    color: string;
    name: string;
    payload: ChartDataPoint;
  }>;
  allSame: boolean;
}

function CustomTooltip({ active, payload, allSame }: CustomTooltipProps): React.JSX.Element | null {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  const isSameDay = point.startDate === point.endDate;
  const dateHeader = isSameDay
    ? formatFull(point.startDate)
    : `${formatFull(point.startDate)} \u2013 ${formatFull(point.endDate)}`;

  return (
    <div style={{
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '12px',
      color: '#f3f4f6',
    }}>
      <div style={{ marginBottom: point.place ? 2 : 4, color: '#9ca3af' }}>{dateHeader}</div>
      {point.place ? (
        <div style={{ marginBottom: 4, color: '#d1d5db' }}>{point.place}</div>
      ) : null}
      {allSame ? (
        <>
          <div style={{ color: '#60a5fa' }}>
            LP: <strong>{point.lp != null ? `${point.lp.toFixed(2)} s` : '\u2014'}</strong>
          </div>
          <div style={{ color: '#34d399' }}>
            PP: <strong>{point.pp != null ? `${point.pp.toFixed(2)} s` : '\u2014'}</strong>
          </div>
        </>
      ) : (
        payload.map((entry) => (
          <div key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: <strong>{typeof entry.value === 'number' ? `${entry.value.toFixed(2)} s` : '\u2014'}</strong>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TimeProgressionChart({
  progression,
  isLoading,
}: TimeProgressionChartProps): React.JSX.Element {
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded bg-surface-700" aria-hidden="true" />;
  }

  if (progression.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-surface-500">
        Nedostatek dat pro graf vývoje
      </div>
    );
  }

  const allSame = progression.every((p) => p.avgTime === p.minTime);

  const chartData: ChartDataPoint[] = progression.map((p, i) => ({
    i,
    startDate: p.startDate,
    endDate: p.endDate,
    avg: p.avgTime,
    min: p.minTime,
    lp: p.avgLp,
    pp: p.avgPp,
    place: p.place,
  }));

  const axisDateFmt: DateFormat = allSame
    ? 'full'
    : detectFormat(progression[0].startDate, progression[progression.length - 1].endDate);

  const maxTicks = axisDateFmt === 'full' ? 4 : 6;
  const xTicks = computeTicks(chartData.length, maxTicks);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 4, right: 25, left: 25, bottom: 0 }}>
        <XAxis
          type="number"
          dataKey="i"
          domain={[0, chartData.length - 1]}
          ticks={xTicks}
          tickFormatter={(idx: number) => {
            const point = chartData[Math.round(idx)];
            return point ? applyFormat(point.startDate, axisDateFmt) : '';
          }}
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          interval={0}
          axisLine={false}
          tickLine={false}
        />
        <YAxis domain={[(d: number) => d, (d: number) => d + 0.05]} hide width={0} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => (
            <CustomTooltip
              {...(props as Omit<CustomTooltipProps, 'allSame'>)}
              allSame={allSame}
            />
          )}
        />
        {allSame ? (
          <>
            <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
            <Line
              type="monotone"
              dataKey="lp"
              name="LP"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ r: 3, fill: '#60a5fa' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="pp"
              name="PP"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3, fill: '#34d399' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </>
        ) : (
          <>
            <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
            <Line
              type="monotone"
              dataKey="avg"
              name="Průměr"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="min"
              name="Nejlepší"
              stroke="#34d399"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
