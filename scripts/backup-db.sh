#!/usr/bin/env bash
# Backup PostgreSQL (pg_dump) lalu unggah ke Google Drive via rclone.
# Dijalankan di host VPS (bukan di dalam container).
#
# Setup sekali:
#   1. Install rclone: https://rclone.org/install/
#   2. rclone config  → remote "gdrive" (Google Drive)
#   3. Buat folder di Drive, mis. point-sekolah-backups
#   4. Cron harian (contoh jam 03:10 WIB):
#        10 3 * * * cd /path/ke/point-sekolah && ./scripts/backup-db.sh >> /var/log/point-sekolah-backup.log 2>&1
#
# Env opsional (bisa di .env project atau export di shell):
#   RCLONE_REMOTE=gdrive:point-sekolah-backups
#   # Atau beberapa akun/folder (pisah koma):
#   RCLONE_REMOTES=gdrive:point-sekolah-backups,gdrive2:point-sekolah-backups
#   BACKUP_KEEP_LOCAL=7
#   BACKUP_KEEP_REMOTE_DAYS=30
#   COMPOSE_FILE=docker-compose.yml

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
BACKUP_KEEP_LOCAL="${BACKUP_KEEP_LOCAL:-7}"
BACKUP_KEEP_REMOTE_DAYS="${BACKUP_KEEP_REMOTE_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
HOSTNAME_SHORT="$(hostname -s 2>/dev/null || hostname || echo host)"
DUMP_NAME="point-sekolah-${HOSTNAME_SHORT}-${TIMESTAMP}.sql.gz"
DUMP_PATH="${BACKUP_DIR}/${DUMP_NAME}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "command tidak ditemukan: $1"
}

load_env() {
  if [[ -f "${ROOT_DIR}/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    # Hanya ambil key yang dibutuhkan (hindari side-effect dari .env lain)
    while IFS= read -r line || [[ -n "${line}" ]]; do
      case "${line}" in
        ''|\#*) continue ;;
        POSTGRES_USER=*|POSTGRES_PASSWORD=*|POSTGRES_DB=*|RCLONE_REMOTE=*|RCLONE_REMOTES=*|BACKUP_KEEP_LOCAL=*|BACKUP_KEEP_REMOTE_DAYS=*|BACKUP_DIR=*)
          export "${line?}"
          ;;
      esac
    done < "${ROOT_DIR}/.env"
    set +a
  fi
}

main() {
  require_cmd docker
  require_cmd gzip
  require_cmd rclone

  load_env

  POSTGRES_USER="${POSTGRES_USER:-postgres}"
  POSTGRES_DB="${POSTGRES_DB:-point_sekolah}"
  BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
  BACKUP_KEEP_LOCAL="${BACKUP_KEEP_LOCAL:-7}"
  BACKUP_KEEP_REMOTE_DAYS="${BACKUP_KEEP_REMOTE_DAYS:-30}"
  RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:point-sekolah-backups}"
  RCLONE_REMOTES="${RCLONE_REMOTES:-${RCLONE_REMOTE}}"
  DUMP_PATH="${BACKUP_DIR}/${DUMP_NAME}"

  mkdir -p "${BACKUP_DIR}"

  if ! docker compose -f "${COMPOSE_FILE}" ps --status running --services 2>/dev/null | grep -qx 'db'; then
    die "service 'db' tidak running. Cek: docker compose ps"
  fi

  log "Mulai dump ${POSTGRES_DB} → ${DUMP_PATH}"
  # PGPASSWORD dari env container; -T agar tidak minta TTY
  docker compose -f "${COMPOSE_FILE}" exec -T \
    -e PGPASSWORD="${POSTGRES_PASSWORD:-}" \
    db \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl \
    | gzip -c > "${DUMP_PATH}.partial"

  mv "${DUMP_PATH}.partial" "${DUMP_PATH}"

  local size
  size="$(du -h "${DUMP_PATH}" | awk '{print $1}')"
  log "Dump selesai (${size})"

  # RCLONE_REMOTES=gdrive:folder,gdrive2:folder
  IFS=',' read -r -a REMOTES <<< "${RCLONE_REMOTES}"
  for remote in "${REMOTES[@]}"; do
    remote="$(echo "${remote}" | xargs)"
    [[ -n "${remote}" ]] || continue
    log "Upload ke ${remote}/${DUMP_NAME}"
    rclone copyto "${DUMP_PATH}" "${remote}/${DUMP_NAME}" --retries 3
  done

  log "Bersihkan dump lokal, sisakan ${BACKUP_KEEP_LOCAL} file terbaru"
  # shellcheck disable=SC2012
  ls -1t "${BACKUP_DIR}"/point-sekolah-*.sql.gz 2>/dev/null \
    | tail -n "+$((BACKUP_KEEP_LOCAL + 1))" \
    | while IFS= read -r old; do
        [[ -n "${old}" ]] || continue
        log "Hapus lokal: ${old}"
        rm -f "${old}"
      done

  if [[ "${BACKUP_KEEP_REMOTE_DAYS}" =~ ^[0-9]+$ ]] && [[ "${BACKUP_KEEP_REMOTE_DAYS}" -gt 0 ]]; then
    for remote in "${REMOTES[@]}"; do
      remote="$(echo "${remote}" | xargs)"
      [[ -n "${remote}" ]] || continue
      log "Hapus backup remote >${BACKUP_KEEP_REMOTE_DAYS} hari di ${remote}"
      rclone delete "${remote}" \
        --min-age "${BACKUP_KEEP_REMOTE_DAYS}d" \
        --include "point-sekolah-*.sql.gz" \
        || log "Peringatan: rclone delete gagal di ${remote} (abaikan jika folder masih kosong)"
    done
  fi

  log "Backup OK: ${DUMP_NAME}"
}

main "$@"
