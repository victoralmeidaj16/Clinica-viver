# Reset da base para operação real — 2026-09-03

## Objetivo

Encerrar a fase de testes conduzida dentro do ambiente de produção e devolver a
base ao estado inicial, antes do cadastro dos primeiros psicólogos e pacientes
reais. Sucede a limpeza de [25/08](./operacao-limpeza-producao-2026-08-25.md),
cujos critérios de preservação foram mantidos.

## Backup

Dump completo e compactado criado na VPS antes da operação:

```text
/opt/viver-mais/backups/20260903T172326Z-before-reset-producao-real.sql.gz
SHA-256: 2b0b06fe858fd6b42346d04095139686e15756ddbfe002b31b015d5b59436624
```

Permissão `600`, restrita ao usuário `root`. Integridade do gzip verificada e
rodapé do `mysqldump` conferido. A restauração depende de autorização da
gestão: o arquivo contém os dados pessoais removidos da base ativa.

## Escopo executado

Removidos em uma única transação, com verificação de chave estrangeira ativa:
5 psicólogos e seus cadastros de vitrine, convites de acesso, especialidades e
disponibilidades; 3 pacientes, 6 triagens e seus vínculos; 3 agendamentos, 3
sessões, 3 bloqueios, 2 avisos e 2 lembretes de agenda; 3 cobranças, 1
pagamento, 2 checkouts Asaas, 1 fatura de convênio e 1 webhook do Inter; 5 dos
6 usuários e das 6 associações de membro; e as trilhas de auditoria,
notificações, linha do tempo, comandos e outbox.

Preservados:

- instituição e organização;
- conta de coordenação (`usr-coordenacao`, papéis `owner,admin`, ativa e com
  senha definida);
- 34 empresas de convênio e 15 cursos de pós-graduação;
- templates de certificado e série fiscal;
- histórico de migrations (37 registros).

## A NFS-e emitida foi mantida de propósito

A base tinha uma NFS-e com `ambiente=producao` e `status=issued` (DPS nº 2,
série 00001, emitida em 02/09/2026). Apagar a linha não cancelaria o documento
na prefeitura — apenas faria a plataforma perder o rastro dele. Por decisão da
gestão, `fiscal_nfse_emissoes` e `fiscal_nfse_eventos` foram preservados.

O contador `fiscal_nfse_series.proximo_numero` permanece em **3**. Ele não deve
ser zerado em nenhuma hipótese: os números 1 e 2 já foram consumidos em emissão
real e reutilizá-los criaria duplicidade fiscal.

## Verificação final

Após o commit, as únicas tabelas com registros são `clinica_convenios` (34),
`clinica_cursos_pos_graduacao` (15), `clinica_membros` (1),
`clinica_organizacoes` (1), `clinica_usuarios` (1), `fiscal_nfse_emissoes` (1),
`fiscal_nfse_series` (1), `instituicoes` (1) e `schema_migrations` (37).

Contêineres seguiram no ar sem erro no log do `clinic-web-1`;
`clinicavivermais.cloud` e `app.clinicavivermais.cloud` responderam 200.

## Cuidado com o seed de teste

`scripts/seed-teste-producao.mjs` recria o psicólogo, o paciente e a triagem de
teste. Ele foi o que populou a base desfeita aqui e **não deve ser executado
contra produção** a partir de agora.

Como na operação anterior, esta limpeza não virou migration: é pontual e não
deve se repetir em instalações futuras.
