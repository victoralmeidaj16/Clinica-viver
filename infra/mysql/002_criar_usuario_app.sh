#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${MYSQL_HOST:-10.20.1.132}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_NAME="${MYSQL_DATABASE:-viver_mais}"
DB_ADMIN_USER="${MYSQL_ADMIN_USER:-vivermais_admin}"
APP_USER="${MYSQL_APP_USER:-viver_mais_app}"
APP_HOST="${MYSQL_APP_HOST:-10.20.%}"
SECRETS_FILE="${HOME}/viver-mais-secrets.env"

read -r -s -p "Senha administrativa do MySQL: " ADMIN_PASSWORD
printf '\n'

APP_DB_PASSWORD="VmA!$(openssl rand -hex 30)"
CRON_SECRET="$(openssl rand -hex 32)"
ADMIN_CNF="$(mktemp)"

cleanup() {
  rm -f "${ADMIN_CNF}"
  unset ADMIN_PASSWORD
}
trap cleanup EXIT

chmod 600 "${ADMIN_CNF}"
printf '%s\n' \
  '[client]' \
  "host=${DB_HOST}" \
  "port=${DB_PORT}" \
  "user=${DB_ADMIN_USER}" \
  "password=${ADMIN_PASSWORD}" \
  > "${ADMIN_CNF}"

mysql --defaults-extra-file="${ADMIN_CNF}" --ssl-mode=REQUIRED <<SQL
CREATE USER IF NOT EXISTS '${APP_USER}'@'${APP_HOST}' IDENTIFIED BY '${APP_DB_PASSWORD}';
ALTER USER '${APP_USER}'@'${APP_HOST}' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'${APP_HOST}';
FLUSH PRIVILEGES;
SQL

umask 077
printf '%s\n' \
  "DATABASE_URL=mysql://${APP_USER}:${APP_DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  "CRON_SECRET=${CRON_SECRET}" \
  > "${SECRETS_FILE}"

mysql --defaults-extra-file="${ADMIN_CNF}" --ssl-mode=REQUIRED --batch --skip-column-names \
  --execute="SELECT CONCAT(User, '@', Host) FROM mysql.user WHERE User = '${APP_USER}'; SHOW GRANTS FOR '${APP_USER}'@'${APP_HOST}';"

printf '\nCredenciais criadas em %s (permissao 600).\n' "${SECRETS_FILE}"
