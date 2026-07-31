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

O `POST` coordena agendamento, autorização, conflito de horário, persistência e
inclusão idempotente do lembrete na fila. O `PATCH` aceita `confirm`, `cancel` ou
`reschedule`.

O dashboard compõe em paralelo agenda, tarefas, resumo financeiro e fila de
comunicação. Ele demonstra a projeção transversal sem transformar nenhum desses
módulos em fonte de verdade dos demais.

## Cliente web migrado

A rota `/agenda` consome esta API por `applicationRequest`. Listagem e mutações
deixaram de usar o array local e as funções do domínio diretamente no browser.
O cliente envia o contexto demonstrativo e chaves novas por comando, exibe
falhas retornadas pela API e só atualiza o agregado após a resposta do servidor.

Todas as respostas usam `{ ok, data, meta }` ou `{ ok, error }`. O estado global
em memória pode ser descartado ao reiniciar ou redistribuir o processo Next.js.
