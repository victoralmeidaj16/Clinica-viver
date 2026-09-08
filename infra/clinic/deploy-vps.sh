#!/usr/bin/env bash
# Publica a árvore de trabalho atual na VPS sem depender de um clone Git lá.
# Uso: VPS_HOST=root@vps.example.com ./infra/clinic/deploy-vps.sh
set -euo pipefail

vps_host="${VPS_HOST:?Defina VPS_HOST, por exemplo root@vps.example.com}"
remote_dir="${VPS_DEPLOY_DIR:-/opt/viver-mais}"

# O SHA só é uma identificação confiável se a árvore que vai para a VPS é
# exatamente a do commit. Evita publicar alterações locais e rotulá-las com a
# revisão anterior.
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Há alterações locais. Faça commit (ou use um worktree limpo) antes do deploy.' >&2
  exit 1
fi

version="$(git rev-parse HEAD)"

# Não copie segredos locais, dependências, artefatos ou os metadados do clone.
#
# Estas exclusões também protegem contra o `--delete`: o que existe só na VPS e
# não tem contrapartida no repositório seria apagado a cada publicação. É o caso
# de `secrets/`, `output/` e `backups/` — este último guarda os dumps do MySQL
# de produção, incluindo o anterior ao corte para produção real.
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'secrets/' \
  --exclude 'backups/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude '.demo-state/' \
  --exclude 'output/' \
  ./ "${vps_host}:${remote_dir}/"

# O SHA permanece fora da imagem e é passado como build arg. Assim o endpoint
# protegido de diagnóstico mostra exatamente a revisão que está em execução.
ssh "$vps_host" "set -euo pipefail
  cd '$remote_dir'
  printf '%s\\n' '$version' > .deploy-sha
  export APP_VERSION=\$(<.deploy-sha)
  docker compose -f infra/clinic/docker-compose.yml build web sla-sweeper billing-expirer
  docker compose -f infra/clinic/docker-compose.yml run --rm --no-deps web npm run db:migrate
  docker compose -f infra/clinic/docker-compose.yml up -d --no-deps web sla-sweeper billing-expirer
  docker compose -f infra/clinic/docker-compose.yml ps"

printf 'Deploy concluído: %s\n' "$version"
