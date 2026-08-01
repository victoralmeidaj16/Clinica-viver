# API de aplicação demonstrativa

Esta camada coordena casos de uso do core em Route Handlers do Next.js. Ela usa
estado em memória e não representa autenticação ou persistência de produção.

## Contexto obrigatório

- `X-Organization-Id: org-demo`
- `X-User-Id: user-demo`
- `Idempotency-Key`: obrigatório em `POST` e `PATCH`
- `X-Correlation-Id`: opcional; gerado pelo servidor quando ausente

## Endpoints

- `GET /api/application/status`
- `GET /api/application/dashboard`
- `GET /api/application/appointments`
- `POST /api/application/appointments`
- `PATCH /api/application/appointments/:id`
- `GET /api/application/sessions`
- `POST /api/application/sessions/:id/post-session`
- `GET /api/application/patient/portal`
- `POST /api/application/patient/tasks/:id/toggle`
- `POST /api/application/patient/mood`
- `POST /api/application/patient/assessments`
- `POST /api/application/patient/pre-session`
- `GET /api/application/appointments/:id/briefing`
- `GET /api/application/timeline`
- `GET /api/application/financial/reports`
- `GET /api/application/communication/queue`
- `POST /api/application/communication/dispatch`



O `POST` de agendamento coordena agendamento, autorização, conflito de horário,
persistência e inclusão idempotente do lembrete na fila. O `PATCH` aceita
`confirm`, `cancel` ou `reschedule`.

O dashboard compõe em paralelo agenda, tarefas, resumo financeiro e fila de
comunicação. Ele demonstra a projeção transversal sem transformar nenhum desses
módulos em fonte de verdade dos demais.

## Automação pós-sessão em 1 clique

`GET /api/application/sessions` devolve a fila de sessões encerradas em
`awaiting_review` ou `ready_to_complete`, com o rascunho SOAP pendente e o estado
de cada etapa da automação.

`POST /api/application/sessions/:id/post-session` executa a cadeia completa no
servidor:

`conteúdo revisado → triagem da entrega → aprovação do prontuário → projeção na
linha do tempo → entrega ao paciente → cobrança → recibo → notificação →
conclusão da sessão`

Garantias do fluxo:

1. A triagem do conteúdo destinado ao paciente roda **antes** de qualquer
   escrita. Um resumo com SOAP, hipótese diagnóstica, conteúdo de risco ou PII
   retorna `422 HANDOFF_REVIEW_REQUIRED` sem aprovar o prontuário.
2. A aprovação do prontuário é o ponto sem volta. Uma vez aprovada e projetada,
   ela não é desfeita por falha posterior.
3. Entrega, cobrança, recibo e notificação são sequenciais e opcionais. A
   primeira falha é registrada no agregado da sessão
   (`clinical_session.automation_failed`), interrompe a cadeia e devolve
   `completed: false` com `failedStep`. A sessão permanece em
   `ready_to_complete` e o profissional repete apenas o que faltou.
4. Cada etapa usa um `commandId` derivado da `Idempotency-Key`. Reenviar o mesmo
   comando reproduz o resultado — não gera segunda cobrança nem segunda
   mensagem. Uma chave nova sobre um prontuário já aprovado é recusada pelo
   domínio.
5. O hash SHA-256 do conteúdo aprovado é computado pelo servidor
   (`computeSoapContentHash`) e acompanha tanto a aprovação quanto cada entrada
   projetada na linha do tempo, tornando a evidência verificável.

O papel clínico e o papel financeiro permanecem separados: vincular a cobrança
exige `billing.write`, enquanto aprovar o prontuário exige
`clinical_records.approve` com vínculo ativo entre profissional e paciente.

## Cliente web migrado

As rotas `/agenda` e `/cockpit` consomem esta API por `applicationRequest`.
Listagem e mutações deixaram de usar o array local e as funções do domínio
diretamente no browser. O cliente envia o contexto demonstrativo e chaves novas
por comando, exibe falhas retornadas pela API e só atualiza o agregado após a
resposta do servidor.

No cockpit, o browser não encadeia mais regras clínicas: ele carrega o rascunho
do servidor, envia o conteúdo revisado em um único comando e reflete o
resultado, inclusive quando o fluxo termina parcialmente.

Todas as respostas usam `{ ok, data, meta }` ou `{ ok, error }`. O estado global
em memória pode ser descartado ao reiniciar ou redistribuir o processo Next.js.
