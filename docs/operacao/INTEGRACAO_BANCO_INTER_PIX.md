# Banco Inter — Pix Cobrança

O checkout de sessão oferece somente duas formas: Pix Cobrança no Banco Inter
e cartão de crédito no Asaas. O boleto não é oferecido nesse fluxo.

## Segredos e certificado

Configure no `.env` privado da VPS as variáveis `INTER_CLIENT_ID`,
`INTER_CLIENT_SECRET`, `INTER_PIX_KEY` e `INTER_WEBHOOK_TOKEN`. Não coloque
nenhuma delas em `NEXT_PUBLIC_*`.

O certificado e a chave baixados no Inter Empresas ficam no host em
`/opt/viver-mais/secrets/inter`, com permissões restritas, e são montados no
container como somente leitura:

```text
/opt/viver-mais/secrets/inter/certificado.crt
/opt/viver-mais/secrets/inter/chave.key
```

No `.env` da VPS:

```dotenv
INTER_ENVIRONMENT=production
INTER_CLIENT_ID=...
INTER_CLIENT_SECRET=...
INTER_PIX_KEY=...
INTER_CERT_PATH=/run/secrets/inter/certificado.crt
INTER_KEY_PATH=/run/secrets/inter/chave.key
INTER_WEBHOOK_TOKEN=gere-um-segredo-longo-e-aleatorio
```

Se o Inter fornecer um PFX/P12, deixe `INTER_CERT_PATH` e `INTER_KEY_PATH`
vazios e use `INTER_PFX_PATH=/run/secrets/inter/certificado.pfx` com
`INTER_PFX_PASSWORD`.

## Webhook de conciliação

Depois do deploy, obtenha um token OAuth com o certificado mTLS e registre uma
única vez esta URL no endpoint `PUT /pix/v2/webhook/{chave}` do ambiente Inter:

```text
https://app.clinicavivermais.cloud/api/financeiro/inter/webhook?token=INTER_WEBHOOK_TOKEN
```

O callback usa `txid` para localizar a cobrança e `endToEndId` como chave
idempotente. Reentregas do mesmo Pix não criam pagamentos duplicados.

### Cenário pontual de homologação

Na validação de produção de 2 de setembro de 2026, a sessão fictícia associada
à cobrança Pix de teste foi posicionada em **02/09/2026, das 08:50 às 09:40**
(`America/Sao_Paulo`). A data passada é intencional: permite exercitar o fluxo
pós-sessão sem esperar pelo horário de um agendamento real. Este registro não é
um seed reutilizável e não contém dados pessoais do paciente simulado.

## Homologação

Comece com `INTER_ENVIRONMENT=sandbox`. Após validar emissão, leitura do QR,
callback e conciliação, troque explicitamente para `production`, reinicie o
container e registre novamente o webhook no ambiente de produção.
