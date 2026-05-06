# 🔥 Firesport Timestamps

A full-stack web application for browsing Czech firesport attack results. Filter, sort, and paginate through the `public.timestamps` Supabase table with live aggregate statistics.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite 6, Tailwind CSS v4 |
| Backend | Express + TypeScript, ts-node-dev |
| Database | Supabase (`public.timestamps`) |
| Monorepo | npm workspaces |

---

## Prerequisites

- Node.js ≥ 18
- A Supabase project with the `public.timestamps` table and the `get_distinct_attack_years()` RPC function (see [sql/](#sql))

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/LeHombreDeZbragl/firesport-timestamps.git
cd firesport-timestamps
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```
PORT=3001
NODE_ENV=development

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

> **Security**: The service-role key bypasses Row Level Security. Keep it server-side only — it is never sent to the browser.

### 3. Apply the Supabase SQL function

Run the contents of `server/sql/get_distinct_attack_years.sql` in your Supabase project's SQL editor. This creates the `get_distinct_attack_years()` RPC used by the year filter.

---

## Development

Start both the Express server and the Vite dev server with a single command:

```bash
npm run dev
```

- Express API: `http://localhost:3001`
- Vite frontend: `http://localhost:5173` (proxies `/api/*` to Express)

---

## Production

### Build

```bash
npm run build
```

Compiles the server TypeScript to `server/dist/` and builds the React app to `client/dist/`.

### Start

```bash
NODE_ENV=production npm start
```

Express serves the compiled React app from `client/dist/` and handles the SPA fallback (`index.html` for all non-API routes). Everything runs on a single port (default `3001`).

---

## API

All endpoints are under `/api/timestamps`.

| Endpoint | Description |
|---|---|
| `GET /api/timestamps` | Paginated, filtered, sorted rows |
| `GET /api/timestamps/stats` | Aggregate stats over the filtered dataset |
| `GET /api/timestamps/distinct/years` | Distinct years (via Supabase RPC) |
| `GET /api/timestamps/distinct/:column` | Distinct values for autocomplete |
| `GET /api/health` | Health check |

### Common query parameters

| Param | Example | Description |
|---|---|---|
| `team` | `Jistebník,Bělá` | Comma-separated team names |
| `category` | `A` | Comma-separated categories |
| `year` | `2025,2024` | Comma-separated years |
| `league` | `MČR` | Comma-separated leagues |
| `place` | `Praha` | Comma-separated places |
| `attack_type` | `PS` | Comma-separated attack types |
| `sort` | `lp` | Column to sort by |
| `order` | `asc` | `asc` or `desc` |
| `offset` | `50` | Pagination offset (default `0`) |
| `limit` | `50` | Page size (max `50`, default `50`) |

---

## Project structure

```
firesport-timestamps/
├── client/                  # Vite + React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/      # LoadingSpinner, ErrorMessage, EmptyState
│   │   │   ├── filters/     # FilterBar, AutocompleteFilter, YearFilter, FilterPill
│   │   │   ├── stats/       # StatsPanel
│   │   │   └── table/       # DataTable, SortableHeader, ClickableCell
│   │   ├── hooks/           # useUrlState, useTimestamps, useStats, useDistinctValues
│   │   ├── services/        # api.ts (axios wrappers)
│   │   ├── types/           # Shared TypeScript interfaces
│   │   └── constants.ts     # COLUMN_DEFINITIONS, PAGE_SIZE, DEFAULT_SORT
│   └── vite.config.ts       # Dev proxy /api → Express
├── server/
│   ├── src/
│   │   ├── routes/          # timestamps.ts
│   │   ├── services/        # supabaseClient, queryBuilder, statsCalculator
│   │   ├── middleware/       # validation.ts
│   │   └── index.ts         # Express entry point
│   └── sql/
│       └── get_distinct_attack_years.sql
├── .env.example
└── package.json             # Workspace root with dev/build/start scripts
```
