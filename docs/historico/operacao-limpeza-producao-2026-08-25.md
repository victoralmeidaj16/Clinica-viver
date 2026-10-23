# Limpeza dos dados de demonstração em produção — 2026-08-25

## Objetivo

Remover os dados clínicos e operacionais usados durante a implantação, antes
do início do uso real da plataforma. A operação preservou a instituição, a
organização, a conta de gestão, os catálogos técnicos e as empresas de
convênio.

## Backup

Antes da limpeza foi criado um dump completo e compactado na VPS:

```text
/opt/viver-mais/backups/20260825T180000Z-before-mock-cleanup.sql.gz
SHA-256: 53feca0d5cafd7e24fc7aa252c5516d0293e1e511498fa22fa80e8bbf5e0c01b
```

O arquivo tem permissão restrita ao usuário `root`. A restauração deve ser
feita somente mediante autorização da gestão, pois o backup contém dados
pessoais e clínicos removidos da base ativa.

## Escopo executado

Foram removidos pacientes, triagens, psicólogos, convites profissionais,
agendamentos, sessões, prontuários, documentos, mensagens, notificações,
auditorias, cobranças, pagamentos, checkouts, webhooks, documentos fiscais e
certificados vinculados aos dados de demonstração.

Foram preservados:

- 33 empresas de convênio;
- 1 conta de gestão com papel `owner/admin`;
- instituição e organização;
- catálogo de pós-graduações, templates e configuração fiscal;
- histórico de migrations.

## Verificação final

As tabelas de profissionais, candidatos, pacientes, triagens, agendamentos,
sessões, prontuários, cobranças, pagamentos, NFS-e, certificados, webhooks,
avisos e auditorias retornaram zero registros. Convênios e acesso da gestão
continuaram disponíveis.

Esta operação não foi transformada em migration: trata-se de uma limpeza
pontual de produção e não deve ser repetida automaticamente em instalações
futuras.
