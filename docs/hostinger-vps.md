# Produção — Hostinger VPS

Este é o documento operacional vigente da Clínica Viver Mais. A infraestrutura
anterior na Oracle Cloud Infrastructure (OCI) foi descontinuada para esta
aplicação; o roteiro anterior foi preservado em
[`oci-migracao.md`](./oci-migracao.md) apenas como histórico.

## Arquitetura em produção

```text
Navegador
  └─ clinicavivermais.cloud / clinica-viver-web.vercel.app (Vercel)
       └─ apenas rotas /api/application, /api/auth e /api/infra
            └─ app.clinicavivermais.cloud (Caddy na VPS Hostinger)
                 └─ Next.js + MySQL 8.4 na rede Docker privada
```

- **Frontend:** Vercel, com o domínio `clinicavivermais.cloud`.
- **Backend:** container `clinic-web` na VPS Hostinger.
- **Banco:** container `clinic-mysql`; a porta 3306 não é publicada na internet.
- **Proxy/TLS:** Caddy, que expõe somente HTTPS para o backend.
- **Domínio de backend:** `app.clinicavivermais.cloud`.

`BACKEND_ORIGIN=https://app.clinicavivermais.cloud` é a variável da Vercel que
mantém páginas e assets no CDN e encaminha somente as APIs persistentes à VPS.
Não colocar `DATABASE_URL`, senha de MySQL ou chave root na Vercel.

## Atualização da VPS

O código fonte da VPS fica em `/opt/viver-mais`; ele é uma cópia publicada por
`rsync`, e não um clone Git. O `.env` do compose fica em
`/opt/viver-mais/infra/clinic/.env` e não pertence ao Git.

Cada publicação deve gravar o SHA do commit em `/opt/viver-mais/.deploy-sha` e
passá-lo como `APP_VERSION` no build. O endpoint protegido
`/api/infra/oci/status` devolve esse SHA no campo `version`; isso é a fonte de
verdade para saber o que está em produção, sem depender de `.git` na VPS.

Da raiz do repositório, o roteiro reproduzível é:

```sh
npm run check
VPS_HOST=root@SEU_HOST ./infra/clinic/deploy-vps.sh
```

O script sincroniza os arquivos sem `.git`, `.env`, dependências ou artefatos,
grava o SHA, constrói a imagem, aplica migrations e reinicia `web` e o worker
interno de SLA.
Ele recusa uma árvore local alterada: faça commit antes de publicar, para que o
SHA informado corresponda exatamente aos arquivos enviados.
`MYSQL_ADMIN_URL` deve existir exclusivamente no `.env` da VPS e é consumida
no container efêmero de migration; nunca a defina na Vercel.

### Certificado A1 para NFS-e

O certificado não é sincronizado pelo deploy. Na VPS, ele fica em
`/opt/viver-mais/secrets/nfse`, com permissões restritas, e é montado como
somente leitura em `/run/secrets/nfse` no container `web`. No `.env` do
Compose, use o caminho **interno** ao container:

```sh
NFSE_CERT_HOST_DIR=/opt/viver-mais/secrets/nfse
NFSE_CERT_PFX_PATH=/run/secrets/nfse/certificado.pfx
NFSE_CERT_PASSWORD=<senha do A1>
NFSE_AMBIENTE=producao_restrita
NFSE_DPS_SERIE=1
NFSE_VERSAO_APLICATIVO=viver-mais-1.0
```

Nunca copie o `.pfx` para `/opt/viver-mais` fora de `secrets/`, nem para a
Vercel. A migração `020_nfse_dps.sql` precisa estar aplicada antes de liberar
o botão de emissão.

Depois do deploy, valide com a credencial de infraestrutura:

```sh
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://app.clinicavivermais.cloud/api/infra/oci/status
```

O resultado precisa trazer `"ready": true`, `"mysql": "ok"` e o `version`
igual a `.deploy-sha`.

### Transbordo automático do SLA

O serviço `sla-sweeper` do Compose chama, pela rede Docker privada, a rota
idempotente `POST /api/application/triagem/sla-sweep` a cada cinco minutos.
Não é necessário cron no host e nenhuma porta adicional é publicada. Antes do
primeiro deploy, acrescente ao `.env` da VPS:

```sh
SLA_SWEEP_TOKEN=<openssl rand -hex 32>
SLA_SWEEP_INTERVAL_SECONDS=300
WHATSAPP_COORDINATION_NUMBERS=55DDDNUMERO
```

O número da coordenação também deve estar em `WHATSAPP_ALLOWED_NUMBERS` durante
o piloto. O alerta contém somente protocolo e troca de profissional; telefone,
nome e dados clínicos do paciente não são enviados à coordenação. Confira o
worker com `docker compose -f infra/clinic/docker-compose.yml logs sla-sweeper`.

### Migrações já aplicadas

O checksum atual considera somente os comandos SQL, ignorando comentários e
prosa. O `--rebaseline` foi uma transição única para registros gravados pelo
checksum antigo; não deve fazer parte do roteiro de deploy. Alterações de DDL
em migration já aplicada continuam sendo erro: crie uma migration nova.

1. Execute as verificações locais (`npm run check`).
2. Envie o código e gere a imagem `clinic-web` na VPS.
3. Rode as migrations com credencial administrativa **antes** de subir a nova
   versão do container web.
4. Reinicie somente o serviço `web` e confirme
   `https://app.clinicavivermais.cloud/api/infra/mode` com
   `{"persistence":"mysql"}`.
5. Publique o frontend na Vercel e valide os dois domínios públicos.

O comando de migration deve rodar dentro da rede Docker, onde o hostname
`mysql` é privado. O usuário da aplicação deve continuar limitado a DML; a
credencial root é usada apenas pelo runner de migrations.

## Segurança e continuidade

- Nunca publicar `3306` no host ou no firewall.
- Manter `.env`, chaves SSH e backups fora do repositório.
- Fazer backup automático, criptografado e externo do volume MySQL antes de
  atualizações e em rotina recorrente.
- Antes de encerrar definitivamente a conta OCI, conferir recursos e custos na
  console da Oracle. A ausência de uso pela aplicação não encerra recursos ou
  cobrança por conta própria.
