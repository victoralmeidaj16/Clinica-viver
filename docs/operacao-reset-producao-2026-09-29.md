# Segundo reset da base para operação real — 2026-09-29

## Objetivo

Remover tudo o que foi cadastrado em produção durante os testes, inclusive o
que entrou depois do [reset de 03/09](./operacao-reset-producao-2026-09-03.md),
e deixar a base pronta para os primeiros psicólogos e pacientes reais. Por
decisão da gestão, **nenhum** login de psicólogo foi mantido: fica apenas a
conta de coordenação.

## Backup

Dump completo e compactado criado na VPS antes da operação:

```text
/opt/viver-mais/backups/20260929T130817Z-before-reset-producao-2.sql.gz
SHA-256: 7cd8b4be90ed42698c1985d52df20daca276c7d42bc27f6508318d36358bb5b6
```

Permissão `600`, restrita ao usuário `root`. Integridade do gzip verificada e
rodapé do `mysqldump` conferido. A restauração depende de autorização da
gestão: o arquivo contém os dados pessoais removidos da base ativa.

## Escopo executado

Removidos em uma única transação, com verificação de chave estrangeira ativa,
depois de um ensaio com `ROLLBACK`:

- 2 psicólogos (usuários, membros, profissionais, especialidades,
  disponibilidades, cadastros de vitrine, convites e alterações de perfil);
- 4 pacientes, 7 triagens e seus vínculos;
- 22 agendamentos, 4 sessões, 2 bloqueios, 37 avisos e 7 lembretes de agenda;
- 14 cobranças, 6 pagamentos, 4 checkouts, 1 fatura de convênio, 1 webhook do
  Asaas e 2 do Inter;
- 4 certificados e 6 declarações de horas da pós-graduação;
- trilhas de auditoria, leituras de notificação, linha do tempo, comandos e
  outbox (sem mensagens de WhatsApp pendentes após a limpeza).

Preservados:

- instituição e organização;
- conta de coordenação (`usr-coordenacao`, papéis `owner,admin`);
- 34 empresas de convênio e 15 cursos de pós-graduação;
- NFS-e emitidas e série fiscal;
- histórico de migrations (47 registros).

## Cobranças nos provedores não foram mexidas

Por decisão da gestão, nada foi cancelado nem estornado no Asaas ou no Banco
Inter. Duas cobranças Pix do Inter, vencidas e já expiradas na plataforma,
continuam existindo no banco com os txids
`VMdccece62d8a99fa82a20f5d2fa7aca` e `VMb6f9ed6acb98a0e0cb4a0011fcde25`
(R$ 75,00 cada). Se alguma delas for paga, o webhook não encontrará a cobrança
local correspondente. As cobranças em aberto do Asaas não chegaram a ter
pagamento emitido no provedor.

## NFS-e mantidas

As 3 NFS-e (`fiscal_nfse_emissoes`) e o evento fiscal foram preservados pelo
mesmo motivo do reset anterior: apagar a linha não cancela o documento na
prefeitura. O contador `fiscal_nfse_series.proximo_numero` segue em **5** e não
deve ser zerado.

## Verificação final

Após o commit, as únicas tabelas com registros são `clinica_convenios` (34),
`clinica_cursos_pos_graduacao` (15), `clinica_membros` (1),
`clinica_organizacoes` (1), `clinica_usuarios` (1), `fiscal_nfse_emissoes` (3),
`fiscal_nfse_eventos` (1), `fiscal_nfse_series` (1), `instituicoes` (1) e
`schema_migrations` (47).

Sem erro no log do `clinic-web-1`; `clinicavivermais.cloud` e
`app.clinicavivermais.cloud` responderam 200.

Como nas operações anteriores, esta limpeza não virou migration.
