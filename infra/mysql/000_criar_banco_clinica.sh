#!/usr/bin/env bash
#
# Cria o banco desta aplicação no DB System da OCI e concede acesso ao usuário
# restrito.
#
# A instância, a VCN, o TLS e a credencial administrativa são os mesmos que o
# Sponteiro já usa — é infraestrutura paga uma vez. O que **não** se compartilha
# é dado: o Sponteiro carrega um schema exercitado com dados de teste, e esta
# clínica não nasce em cima disso. Daí um banco próprio, `viver_mais_clinica`,
# com grants próprios.
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

DB_HOST="${MYSQL_HOST:-10.20.1.132}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_NAME="${MYSQL_DATABASE:-viver_mais_clinica}"
DB_ADMIN_USER="${MYSQL_ADMIN_USER:-vivermais_admin}"
APP_USER="${MYSQL_APP_USER:-viver_mais_app}"
APP_HOST="${MYSQL_APP_HOST:-10.20.%}"

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

mysql --defaults-extra-file="${ADMIN_CNF}" --ssl-mode=REQUIRED <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'${APP_HOST}';
FLUSH PRIVILEGES;
SQL

mysql --defaults-extra-file="${ADMIN_CNF}" --ssl-mode=REQUIRED --batch --skip-column-names \
  --execute="SHOW GRANTS FOR '${APP_USER}'@'${APP_HOST}';"

printf '\nBanco %s criado. Atualize DATABASE_URL para apontar para ele.\n' "${DB_NAME}"
printf 'O usuario %s segue sem DDL: o schema e aplicado com a credencial administrativa.\n' "${APP_USER}"
