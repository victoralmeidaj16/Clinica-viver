#!/usr/bin/env bash
#
# Cria o banco desta aplicação no MySQL da VPS e concede acesso ao usuário
# restrito. Execute dentro da rede Docker de produção.
#
# O banco clínico não compartilha dados com nenhum outro sistema. Esta clínica
# usa o banco próprio `viver_mais_clinica`, com grants próprios.
#
# O usuário da aplicação continua sem DDL. Este script é o único momento em que
# uma credencial administrativa é usada, e ele não guarda senha nenhuma.
#
# Uso:
#   ./000_criar_banco_clinica.sh
#
# Depois dele, aplicar com a credencial administrativa e nesta ordem:
#   001_financeiro.sql  004_clinica.sql  007_thats_life_core.sql  008_seed_organizacao.sql
#
# O 005 é seed fictício (somente desenvolvimento) e o 006 é migração de bancos
# antigos — nenhum dos dois entra aqui.

set -euo pipefail

DB_HOST="${MYSQL_HOST:-mysql}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_NAME="${MYSQL_DATABASE:-viver_mais_clinica}"
DB_ADMIN_USER="${MYSQL_ADMIN_USER:-root}"
APP_USER="${MYSQL_APP_USER:-viver_mais_app}"
APP_HOST="${MYSQL_APP_HOST:-%}"

read -r -s -p "Senha administrativa do MySQL: " ADMIN_PASSWORD
printf '\n'

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

# A comunicação ocorre na rede Docker privada; não há porta MySQL pública.
mysql --defaults-extra-file="${ADMIN_CNF}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'${APP_HOST}';
FLUSH PRIVILEGES;
SQL

mysql --defaults-extra-file="${ADMIN_CNF}" --ssl-mode=REQUIRED --batch --skip-column-names \
  --execute="SHOW GRANTS FOR '${APP_USER}'@'${APP_HOST}';"

printf '\nBanco %s criado. Atualize DATABASE_URL para apontar para ele.\n' "${DB_NAME}"
printf 'O usuario %s segue sem DDL: o schema e aplicado com a credencial administrativa.\n' "${APP_USER}"
