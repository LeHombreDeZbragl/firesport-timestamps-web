#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# backup.sh — Manual Postgres backup for firesport-timestamps-web
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/backup.sh
#
# Or export DATABASE_URL in your shell first, then just run:
#   ./scripts/backup.sh
#
# The backup is written to:
#   ./backups/firesport_YYYY-MM-DD_HHMMSS.sql.gz
#
# Requirements:
#   - pg_dump (postgresql-client package)
#   - gzip
# ---------------------------------------------------------------------------

set -euo pipefail

# ── Validate prerequisites ──────────────────────────────────────────────────

if ! command -v pg_dump &>/dev/null; then
  echo "Error: pg_dump not found. Install postgresql-client:" >&2
  echo "  Ubuntu/Debian: sudo apt install postgresql-client" >&2
  echo "  macOS:         brew install libpq && brew link --force libpq" >&2
  exit 1
fi

if [[ -f "$(dirname "$0")/../.env" ]]; then
  set +a  # Don't export everything
  source "$(dirname "$0")/../.env"
  set -a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL environment variable is not set." >&2
  echo "  Export it or prefix the command:" >&2
  echo "  DATABASE_URL=\"postgresql://...\" ./scripts/backup.sh" >&2
  exit 1
fi

# ── Create output directory ─────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
mkdir -p "${BACKUP_DIR}"

# ── Run backup ──────────────────────────────────────────────────────────────

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/firesport_${TIMESTAMP}.sql.gz"

echo "[backup] Starting pg_dump → ${OUTPUT_FILE}"

PG_STDERR_LOG=$(mktemp)

if ! pg_dump \
  --no-owner \
  --no-acl \
  --format=plain \
  "${DATABASE_URL}" \
  2>"${PG_STDERR_LOG}" \
  | gzip > "${OUTPUT_FILE}"; then
  echo "[backup] pg_dump failed:" >&2
  cat "${PG_STDERR_LOG}" >&2
  rm -f "${PG_STDERR_LOG}" "${OUTPUT_FILE}"
  exit 1
fi
rm -f "${PG_STDERR_LOG}"

SIZE="$(du -sh "${OUTPUT_FILE}" | cut -f1)"
echo "[backup] Done. Size: ${SIZE}"

# ── Retention: remove backups older than 30 days ────────────────────────────

find "${BACKUP_DIR}" -name "firesport_*.sql.gz" -mtime +30 -delete
echo "[backup] Cleaned up backups older than 30 days."
