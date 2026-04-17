function App(): React.JSX.Element {
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
        {/* Filters section — Phase 3 */}
        <section
          aria-label="Filters"
          className="bg-surface-800 rounded-xl border border-surface-700 p-6"
        >
          <p className="text-surface-500 text-sm">
            Filters — implemented in Phase 3
          </p>
        </section>

        {/* Stats section — Phase 4 */}
        <section
          aria-label="Statistics"
          className="bg-surface-800 rounded-xl border border-surface-700 p-6"
        >
          <p className="text-surface-500 text-sm">
            Statistics panel — implemented in Phase 4
          </p>
        </section>

        {/* Data table section — Phase 4 */}
        <section
          aria-label="Data table"
          className="bg-surface-800 rounded-xl border border-surface-700 p-6"
        >
          <p className="text-surface-500 text-sm">
            Data table — implemented in Phase 4
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
