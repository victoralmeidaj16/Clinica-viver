# Backend clínico na VPS Hostinger

Este stack mantém o MySQL e o backend Next.js na mesma VPS Hostinger. O MySQL
não publica a porta 3306; somente o backend acessa o banco pela rede Docker.

O `.env` é criado apenas na VM e nunca deve ser versionado.

O frontend fica na Vercel e encaminha somente as APIs para este backend por
`https://app.clinicavivermais.cloud`. O roteiro completo está em
[`../../docs/hostinger-vps.md`](../../docs/hostinger-vps.md).

Para publicar a cópia da VPS e registrar a revisão implantada, execute da raiz
do repositório:

```sh
VPS_HOST=root@SEU_HOST ./infra/clinic/deploy-vps.sh
```

## Expiração de cobranças

O serviço `billing-expirer` chama a rota interna de expiração a cada minuto. Na
VPS, configure no `.env` um segredo exclusivo e um intervalo nunca inferior a
60 segundos:

```dotenv
BILLING_EXPIRY_TOKEN=gere-um-segredo-longo-e-exclusivo
BILLING_EXPIRY_INTERVAL_SECONDS=60
```

O worker não publica portas nem acessa o banco diretamente. Ele confirma o
estado atual no Asaas antes de remover uma cobrança remota e pode repetir a
mesma varredura com segurança. Para acompanhar sua execução:

```sh
docker compose -f infra/clinic/docker-compose.yml logs -f billing-expirer
```
