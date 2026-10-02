#!/usr/bin/env bash
# Tolak migrasi destruktif dan pengeditan migration.sql yang sudah ada.
# Pemakaian: bash scripts/check-migrations-safe.sh BASE_SHA HEAD_SHA
set -euo pipefail

BASE_SHA="${1:-}"
HEAD_SHA="${2:-HEAD}"
ZERO="0000000000000000000000000000000000000000"

if [[ -z "${BASE_SHA}" || "${BASE_SHA}" == "${ZERO}" ]]; then
  if ! git rev-parse --verify --quiet HEAD~1 >/dev/null; then
    echo "skip"
    exit 0
  fi
  BASE_SHA="HEAD~1"
fi

if ! git rev-parse --verify --quiet "${BASE_SHA}^{commit}" >/dev/null 2>&1 \
  || ! git rev-parse --verify --quiet "${HEAD_SHA}^{commit}" >/dev/null 2>&1; then
  echo "skip"
  exit 0
fi

fail=0

while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  [[ "${file}" == */migration.sql ]] || continue
  echo "migrasi lama diubah (sudah jalan, tidak boleh diedit): ${file}"
  fail=1
done < <(git diff --name-only --diff-filter=M "${BASE_SHA}" "${HEAD_SHA}" -- prisma/migrations)

line_is_bad() {
  local low="$1"
  [[ "${low}" =~ drop[[:space:]]+table ]] && return 0
  [[ "${low}" =~ drop[[:space:]]+column ]] && return 0
  [[ "${low}" =~ (^|[^[:alnum:]_])truncate([^[:alnum:]_]|$) ]] && return 0
  [[ "${low}" =~ delete[[:space:]]+from ]] && return 0
  [[ "${low}" =~ rename[[:space:]]+column ]] && return 0
  [[ "${low}" =~ rename[[:space:]]+to ]] && return 0
  [[ "${low}" =~ alter[[:space:]]+column ]] && [[ "${low}" =~ [[:space:]]type([^[:alnum:]_]|$) ]] && return 0
  [[ "${low}" =~ alter[[:space:]]+column ]] && [[ "${low}" =~ set[[:space:]]+not[[:space:]]+null ]] && return 0
  return 1
}

while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  [[ "${file}" == */migration.sql ]] || continue
  [[ -f "${file}" ]] || continue
  if grep -Eq '^[[:space:]]*--[[:space:]]*allow-destructive:[[:space:]]+[^[:space:]]+' "${file}"; then
    continue
  fi

  lineno=0
  stmt=""
  stmt_start=1
  stmt_hit=0
  while IFS= read -r line || [[ -n "${line}" ]]; do
    lineno=$((lineno + 1))
    if [[ -z "${stmt}" ]]; then
      stmt_start="${lineno}"
      stmt_hit=0
    fi
    low="$(printf '%s' "${line}" | tr '[:upper:]' '[:lower:]')"
    stmt+=" ${low}"
    if line_is_bad "${low}"; then
      echo "${file}:${lineno}: ${line}"
      fail=1
      stmt_hit=1
    fi
    if [[ "${line}" == *";"* ]]; then
      if [[ "${stmt_hit}" -eq 0 ]] && line_is_bad "${stmt}"; then
        echo "${file}:${stmt_start}: ${stmt}"
        fail=1
      fi
      stmt=""
    fi
  done < "${file}"

  if [[ -n "${stmt}" && "${stmt_hit}" -eq 0 ]] && line_is_bad "${stmt}"; then
    echo "${file}:${stmt_start}: ${stmt}"
    fail=1
  fi
done < <(git diff --name-only --diff-filter=AM "${BASE_SHA}" "${HEAD_SHA}" -- prisma/migrations)

exit "${fail}"
