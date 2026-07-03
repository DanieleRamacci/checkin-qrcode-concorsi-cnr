#!/usr/bin/env sh
set -eu

BASE_URL="${1:-http://localhost:8080}"

check() {
  path="$1"
  expected="$2"
  status="$(curl -ksS -o /tmp/checkin-smoke-body -w '%{http_code}' "${BASE_URL}${path}")"
  if [ "$status" != "$expected" ]; then
    echo "FAIL ${path}: atteso ${expected}, ricevuto ${status}" >&2
    cat /tmp/checkin-smoke-body >&2
    exit 1
  fi
  echo "OK ${path} (${status})"
}

check "/healthz" "200"
check "/api/v1/health" "200"
check "/" "200"
