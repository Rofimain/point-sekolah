#!/usr/bin/env bash
# Restore PostgreSQL dari file .sql.gz (lokal atau setelah diunduh dari Google Drive).
#
# Contoh:
#   ./scripts/restore-db.sh ./backups/point-sekolah-host-20260718-031000.sql.gz
#   rclone copyto gdrive:point-sekolah-backups/FILE.sql.gz /tmp/restore.sql.gz
#   ./scripts/restore-db.sh /tmp/restore.sql.gz
#
# PERINGATAN: menimpa data di database yang sedang jalan.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DUMP_FILE="${1:-}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -n "${DUMP_FILE}" ]] || die "pakai: $0 /path/ke/file.sql.gz"
[[ -f "${DUMP_FILE}" ]] || die "file tidak ada: ${DUMP_FILE}"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  while IFS= read -r line || [[ -n "${line}" ]]; do
    case "${line}" in
      ''|\#*) continue ;;
      POSTGRES_USER=*|POSTGRES_PASSWORD=*|POSTGRES_DB=*)
        export "${line?}"
        ;;
    esac
  done < "${ROOT_DIR}/.env"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-point_sekolah}"

echo "Restore ${DUMP_FILE} → ${POSTGRES_DB}"
echo "Ini akan MENIMPA data yang ada. Ctrl+C dalam 5 detik untuk batal..."
sleep 5

docker compose -f "${COMPOSE_FILE}" exec -T \
  -e PGPASSWORD="${POSTGRES_PASSWORD:-}" \
  db \
  psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" \
  -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"

gunzip -c "${DUMP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T \
  -e PGPASSWORD="${POSTGRES_PASSWORD:-}" \
  db \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1

echo "Restore selesai."
