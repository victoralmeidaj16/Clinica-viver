#!/usr/bin/env bash
set -euo pipefail

SECRETS_FILE="${HOME}/viver-mais-secrets.env"
CA_FILE="${HOME}/mysql-viver-mais-prod-ca.pem"

DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "${SECRETS_FILE}")"
URL_WITHOUT_SCHEME="${DATABASE_URL#mysql://}"
CREDENTIALS="${URL_WITHOUT_SCHEME%%@*}"
HOST_AND_DATABASE="${URL_WITHOUT_SCHEME#*@}"
HOST_AND_PORT="${HOST_AND_DATABASE%%/*}"
DB_NAME="${HOST_AND_DATABASE#*/}"
APP_USER="${CREDENTIALS%%:*}"
APP_PASSWORD="${CREDENTIALS#*:}"
DB_HOST="${HOST_AND_PORT%%:*}"
DB_PORT="${HOST_AND_PORT#*:}"
APP_CNF="$(mktemp)"

cleanup() {
  rm -f "${APP_CNF}"
  unset APP_PASSWORD
}
trap cleanup EXIT

chmod 600 "${APP_CNF}"
printf '%s\n' \
  '[client]' \
  "host=${DB_HOST}" \
  "port=${DB_PORT}" \
  "user=${APP_USER}" \
  "password=${APP_PASSWORD}" \
  "database=${DB_NAME}" \
  'ssl-mode=VERIFY_CA' \
  "ssl-ca=${CA_FILE}" \
  > "${APP_CNF}"

mysql --defaults-extra-file="${APP_CNF}" --batch \
  --execute="SELECT CURRENT_USER() AS usuario, DATABASE() AS banco; SHOW STATUS LIKE 'Ssl_cipher'; SHOW TABLES;"
