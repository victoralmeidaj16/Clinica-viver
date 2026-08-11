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

O código fonte da VPS fica em `/opt/viver-mais`; o `.env` do compose fica em
`/opt/viver-mais/infra/clinic/.env` e não pertence ao Git.

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
