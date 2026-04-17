import { useUrlState } from './hooks/useUrlState';
import { useTimestamps } from './hooks/useTimestamps';
import { useStats } from './hooks/useStats';

function App(): React.JSX.Element {
  const { filters, sort } = useUrlState();
  const { rows, totalCount, isLoading, error } = useTimestamps(filters, sort);
  const { stats } = useStats(filters);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="bg-primary-950 border-b border-primary-800 px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Firesport Timestamps
        </h1>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Filters section — Phase 4 */}
        <section
          aria-label="Filters"
          className="bg-surface-800 rounded-xl border border-surface-700 p-6"
        >
          <p className="text-surface-500 text-sm">
            Filters — implemented in Phase 4
          </p>
        </section>

        {/* Stats section — Phase 4 */}
        <section
          aria-label="Statistics"
          className="bg-surface-800 rounded-xl border border-surface-700 p-6"
        >
          {stats !== null ? (
            <p className="text-surface-300 text-sm">
              Total: {stats.totalCount} rows | Avg time: {stats.averageTime?.toFixed(2) ?? '—'}s |
              Best: {stats.bestTime?.toFixed(2) ?? '—'}s | LP faster: {stats.lpFasterCount} ×,
              PP faster: {stats.ppFasterCount} ×
            </p>
          ) : (
            <p className="text-surface-500 text-sm">Statistics panel — implemented in Phase 4</p>
          )}
        </section>

        {/* Data table section — Phase 4 */}
        <section
          aria-label="Data table"
          className="bg-surface-800 rounded-xl border border-surface-700 p-6"
        >
          {isLoading && <p className="text-surface-500 text-sm">Loading…</p>}
          {error !== null && <p className="text-accent-400 text-sm">Error: {error}</p>}
          {!isLoading && error === null && (
            <p className="text-surface-300 text-sm">
              {rows.length} / {totalCount} rows loaded — full table in Phase 4
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
