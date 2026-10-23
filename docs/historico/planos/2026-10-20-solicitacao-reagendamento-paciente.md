# Solicitação de reagendamento pelo paciente — Plano de implementação

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: usar `executing-plans` para implementar este plano tarefa por tarefa, com TDD e commits pequenos.

**Objetivo:** substituir o reagendamento imediato feito pelo paciente por uma solicitação pendente, decidida pelo psicólogo responsável, e avisar o psicólogo via WhatsApp com link direto para a sessão.

**Arquitetura:** uma nova tabela guarda o pedido e seu estado sem reservar o horário proposto. O fluxo público somente cria a solicitação; a rota autenticada do psicólogo aceita ou recusa. O aceite revalida sessão e disponibilidade dentro de uma transação e só então reaproveita os efeitos já existentes de cobrança e avisos de remarcação.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, MySQL 8, Vitest, Evolution API.

**Especificação:** `docs/superpowers/specs/2026-10-20-aprovacao-reagendamento-paciente-design.md`

## Restrições globais

- Preservar as alterações locais já existentes, especialmente em `apps/web/src/app/agenda/page.tsx` e nos componentes da agenda.
- Manter a antecedência mínima atual de 2 horas, calculada sobre o horário confirmado.
- Não reservar o horário solicitado, não expirar automaticamente, não criar contraproposta e não abrir negociação por mensagens.
- Nunca alterar a sessão antes do aceite autenticado do psicólogo responsável.
- Falha no WhatsApp nunca desfaz uma solicitação nem uma decisão já persistida.
- Aplicar `infra/mysql/061_solicitacoes_reagendamento.sql` antes de publicar código que consulte a nova tabela. O número `060` já está ocupado.
- Não registrar CPF, telefone ou conteúdo clínico em logs, notificações ou mensagens.

## Foco da revisão

1. Dois envios simultâneos ou repetidos devem resultar em apenas uma solicitação pendente.
2. Pedir exatamente o horário atual deve ser recusado como entrada inválida, sem criar solicitação.
3. Se o horário for ocupado antes do aceite, o aceite deve falhar sem alterar sessão, pedido ou cobrança.
4. Se a sessão for cancelada ou modificada enquanto o pedido aguarda, nenhuma decisão pode sobrescrever o estado mais novo.
5. O WhatsApp deve usar a URL configurada, ter fallback seguro e apontar para `/agenda` com foco na sessão correta.

---

## Tarefa 1: Criar o modelo persistente e as operações transacionais

**Arquivos:**

- Criar: `infra/mysql/061_solicitacoes_reagendamento.sql`
- Criar: `apps/web/src/server/scheduling/rescheduleRequestRepository.ts`
- Criar: `apps/web/src/server/scheduling/rescheduleRequestRepository.test.ts`
- Modificar: `infra/mysql/050_reagendamento_avisos_cobrancas.sql` apenas se um teste de banco provar que o histórico precisa ser reconstruído; preferir alterar o enum na migração `061`.

- [ ] Escrever testes falhando para: criação sem alterar `clinica_agendamentos`; rejeição do mesmo horário; prazo menor que 2 horas; sessão inexistente; duplicidade concorrente; leitura do pedido pendente; aceite; recusa; sessão já alterada/cancelada; e conflito de agenda no aceite.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/server/scheduling/rescheduleRequestRepository.test.ts` e confirmar a falha esperada.
- [ ] Criar `clinica_solicitacoes_reagendamento` com UUID, número sequencial por agendamento, instituição, agendamento, paciente, profissional, início/fim/modalidade atuais e solicitados, `status ENUM('pendente','aceita','recusada')`, `solicitado_em`, `respondido_em` e FKs coerentes com as tabelas atuais.
- [ ] Garantir uma única pendência por agendamento com uma chave gerada que seja igual ao `agendamento_id` somente quando `status = 'pendente'`, permitindo histórico de pedidos encerrados.
- [ ] Na mesma migração, ampliar `clinica_agenda_avisos.tipo` para `solicitacao_reagendamento_psicologo` e `recusa_reagendamento_paciente`, preservando todos os valores existentes.
- [ ] Expor tipos pequenos e explícitos:

```ts
export interface RescheduleRequestSummary {
  id: string;
  appointmentId: string;
  currentStartsAt: string;
  currentEndsAt: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
  requestedModality: 'online' | 'presencial' | 'telefone';
  requestedAt: string;
}

export type RequestRescheduleResult =
  | { ok: true; request: RescheduleRequestSummary }
  | { ok: false; reason: 'NOT_FOUND' | 'TOO_LATE' | 'UNAVAILABLE' | 'UNCHANGED' | 'ALREADY_PENDING' };

export type DecideRescheduleResult =
  | { ok: true; appointmentId: string; decision: 'accepted' | 'rejected'; version: number }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PENDING' | 'APPOINTMENT_CHANGED' | 'UNAVAILABLE' };
```

- [ ] Implementar `requestPatientReschedule(...)`, `findPendingPatientRescheduleRequest(...)` e `decidePatientRescheduleRequest(...)`. A criação valida o slot disponível hoje, mas não o bloqueia. O aceite bloqueia profissional, pedido e sessão, compara o horário original, revalida bloqueios e sobreposição e atualiza sessão + pedido atomicamente. A recusa só encerra o pedido.
- [ ] No aceite, chamar `resetAppointmentChargeDue` apenas quando houver mudança real, confirmar a transação e só depois devolver os dados necessários aos efeitos externos. Não disparar efeitos de dentro da transação.
- [ ] Executar o teste focal até passar e então `npm run typecheck --workspace @thats-life/web`.
- [ ] Commit: `feat(agenda): persist patient reschedule requests`

## Tarefa 2: Trocar o endpoint público de alteração por solicitação

**Arquivos:**

- Modificar: `apps/web/src/app/api/agenda/reagendar/route.ts`
- Modificar: `apps/web/src/app/api/agenda/reagendar/route.test.ts`
- Modificar: `apps/web/src/server/scheduling/publicBooking.test.ts`
- Modificar: `apps/web/src/server/scheduling/agendaRepository.ts`

- [ ] Atualizar os testes para exigir que `POST /api/agenda/reagendar` chame `requestPatientReschedule`, nunca `rescheduleAppointmentPublic`, e responda com estado pendente e a frase “Reagendamento solicitado ao psicólogo”.
- [ ] Cobrir os mapeamentos HTTP: `404 NOT_FOUND`, `400 TOO_LATE/UNCHANGED`, `409 UNAVAILABLE/ALREADY_PENDING`, além de entrada e rate limit atuais.
- [ ] Executar os dois arquivos de teste e confirmar que falham pelo comportamento imediato antigo.
- [ ] Remover o caminho público que faz `UPDATE clinica_agendamentos` e seus efeitos; manter o reagendamento autenticado feito diretamente pelo próprio psicólogo sem mudanças.
- [ ] Retornar `agendamentoAtual` e `solicitacao` separadamente, sem `linkPagamento` do horário solicitado e sem a palavra “reagendada” no sucesso.
- [ ] Fazer o disparo assíncrono tolerante a falha do WhatsApp após a persistência; a resposta HTTP permanece de sucesso mesmo se o envio falhar.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/app/api/agenda/reagendar/route.test.ts src/server/scheduling/publicBooking.test.ts`.
- [ ] Commit: `feat(agenda): request patient reschedule approval`

## Tarefa 3: Avisar o psicólogo via WhatsApp com link direto

**Arquivos:**

- Criar: `apps/web/src/server/application/appUrl.ts`
- Criar: `apps/web/src/server/application/appUrl.test.ts`
- Modificar: `apps/web/src/server/application/viverMaisWhatsApp.ts`
- Modificar: `apps/web/src/server/scheduling/agendaAvisos.ts`
- Modificar: `apps/web/src/server/scheduling/agendaAvisos.test.ts`
- Modificar: `apps/web/src/lib/focoNotificacao.ts` somente se o foco atual não puder ser reutilizado.

- [ ] Escrever testes para o texto da solicitação contendo paciente, horário atual, horário solicitado e URL absoluta `.../agenda?foco=sessao-<id>`; afirmar que não contém “foi remarcada”.
- [ ] Cobrir `NEXT_PUBLIC_APP_URL` com remoção de barra final e fallback `https://clinicavivermais.cloud`.
- [ ] Acrescentar as finalidades `agenda_solicitacao_reagendamento_psicologo` e `agenda_recusa_reagendamento_paciente`.
- [ ] Implementar `avisarSolicitacaoReagendamentoPsicologo(...)` usando deduplicação por solicitação. Passar o número sequencial persistido no pedido como `versao` de `clinica_agenda_avisos`; assim pedidos posteriores da mesma sessão não colidem e não dependem de hash do UUID.
- [ ] Implementar `avisarRecusaReagendamentoPaciente(...)`, dizendo que a mudança não foi aceita e que o horário confirmado continua válido.
- [ ] Garantir que ambos os disparos capturam falha e nunca lançam para o fluxo principal.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/server/application/appUrl.test.ts src/server/scheduling/agendaAvisos.test.ts`.
- [ ] Commit: `feat(whatsapp): notify reschedule approval workflow`

## Tarefa 4: Expor aceite e recusa autenticados

**Arquivos:**

- Criar: `apps/web/src/app/api/application/agenda/reagendamentos/[id]/route.ts`
- Criar: `apps/web/src/app/api/application/agenda/reagendamentos/[id]/route.test.ts`
- Criar: `apps/web/src/server/application/rescheduleRequestService.ts`
- Criar: `apps/web/src/server/application/rescheduleRequestService.test.ts`
- Modificar: `apps/web/src/server/scheduling/agendaReagendamentoEffects.ts` somente se for preciso expor um contrato já existente.

- [ ] Escrever testes falhando para `PATCH { decision: 'accept' | 'reject' }`, autenticação, psicólogo errado, decisão inválida, repetição e todos os conflitos do “Foco da revisão”.
- [ ] O serviço deve obter instituição e profissional pelo `RequestContext`, nunca confiar em IDs enviados pelo navegador.
- [ ] No aceite bem-sucedido, chamar `concluirReagendamento` somente depois do commit, reutilizando ajuste de cobrança e os dois avisos de sessão efetivamente remarcada.
- [ ] No conflito `UNAVAILABLE`, retornar erro claro: o horário não está mais livre; orientar o psicólogo a recusar e combinar outro horário. Não alterar o pedido para recusado automaticamente.
- [ ] Na recusa bem-sucedida, avisar o paciente após o commit e retornar a lista atualizada de `appointments`.
- [ ] Executar `npm run test --workspace @thats-life/web -- 'src/app/api/application/agenda/reagendamentos/[id]/route.test.ts' src/server/application/rescheduleRequestService.test.ts src/server/scheduling/agendaReagendamentoEffects.test.ts`.
- [ ] Commit: `feat(agenda): let psychologist decide reschedule requests`

## Tarefa 5: Mostrar o estado pendente ao paciente

**Arquivos:**

- Modificar: `apps/web/src/app/api/agenda/horarios/route.ts`
- Criar ou modificar: `apps/web/src/app/api/agenda/horarios/route.test.ts`
- Modificar: `apps/web/src/app/agendar/[token]/page.tsx`
- Criar: `apps/web/src/app/agendar/[token]/reschedulePresentation.test.ts` para testar a apresentação extraída sem introduzir uma nova biblioteca de DOM.

- [ ] Fazer `agendamentoAtual` incluir `solicitacaoReagendamento?: RescheduleRequestSummary`, sem misturar horário proposto com o confirmado.
- [ ] Testar que, após solicitar, a tela mostra: “Reagendamento solicitado ao psicólogo. Seu horário atual continua válido enquanto você aguarda a resposta.”
- [ ] Mostrar dois blocos: “Horário confirmado” com o horário atual e “Horário solicitado” com selo “Aguardando resposta do psicólogo”.
- [ ] Remover “Sessão Reagendada com Sucesso” desse fluxo e impedir novo pedido enquanto existir pendência; manter o pagamento ligado somente à sessão confirmada.
- [ ] Após recusa ou aceite, o próximo carregamento deve refletir apenas o estado persistido, sem depender de estado local antigo.
- [ ] Executar os testes focais e `npm run typecheck --workspace @thats-life/web`.
- [ ] Commit: `feat(portal): show pending reschedule request`

## Tarefa 6: Mostrar e decidir o pedido na agenda do psicólogo

**Arquivos:**

- Modificar: `apps/web/src/server/scheduling/agendaRepository.ts`
- Modificar: `apps/web/src/server/scheduling/agendaListagemConclusao.test.ts`
- Criar: `apps/web/src/components/scheduling/RescheduleRequestCard.tsx`
- Criar: `apps/web/src/components/scheduling/RescheduleRequestCard.test.tsx`
- Modificar: `apps/web/src/components/scheduling/UpcomingSessions.tsx`
- Modificar: `apps/web/src/app/agenda/page.tsx`

- [ ] Estender `AgendamentoResumo` com `solicitacaoReagendamento?: RescheduleRequestSummary` e carregar somente a solicitação pendente da própria sessão/profissional.
- [ ] Extrair o bloco destacado para manter `UpcomingSessions.tsx` abaixo do limite de 250 linhas ou reduzir o arquivo durante a integração sem alterar comportamentos existentes.
- [ ] Renderizar paciente, horário atual, horário solicitado, “Aceitar” e “Recusar”; desabilitar os dois botões durante a ação e preservar erro visível sem esconder a sessão.
- [ ] Em `agenda/page.tsx`, adicionar o callback que chama `/agenda/reagendamentos/<requestId>` e substitui `appointments` pela resposta. Integrar cuidadosamente com as mudanças locais já presentes no arquivo.
- [ ] Testar aceite, recusa, clique repetido, erro de conflito e recarga da lista.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/components/scheduling/RescheduleRequestCard.test.tsx src/server/scheduling/agendaListagemConclusao.test.ts`.
- [ ] Commit: `feat(agenda): review reschedule requests in sessions`

## Tarefa 7: Adicionar notificação interna e validar a entrega

**Arquivos:**

- Modificar: `apps/web/src/server/application/notificacoes.ts`
- Modificar: `apps/web/src/server/application/notificacoesDestino.test.ts`
- Modificar: `docs/superpowers/specs/2026-10-20-aprovacao-reagendamento-paciente-design.md` apenas se a implementação revelar uma decisão nova aprovada pelo usuário.

- [ ] Derivar uma notificação pendente por solicitação, com chave incluindo o ID do pedido, título “Reagendamento solicitado” e link `comFoco('/agenda', focoSessao(appointmentId))`.
- [ ] Testar que a notificação desaparece quando não existe mais solicitação pendente e que não duplica a notificação de sessão marcada.
- [ ] Executar todos os testes focais do plano.
- [ ] Executar `npm run lint`, `npm run typecheck`, `npm run test` e `npm run web:build` na raiz.
- [ ] Executar `npm run db:status` e confirmar que `061_solicitacoes_reagendamento.sql` é a próxima migração sem colisão de versão.
- [ ] Fazer busca de regressão: `rg -n "Sessão reagendada com sucesso|foi remarcada" apps/web/src/app/api/agenda apps/web/src/app/agendar` e confirmar que nenhuma mensagem prematura permanece no fluxo do paciente.
- [ ] Revisar o diff para garantir ausência de dados sensíveis em logs, ausência de alterações fora do escopo e preservação das mudanças locais do usuário.
- [ ] Commit: `test(agenda): cover reschedule approval workflow`

## Critérios finais de aceite

- Solicitar nunca altera a sessão confirmada.
- O psicólogo recebe WhatsApp com linguagem de solicitação e link funcional para a sessão.
- Somente o psicólogo responsável decide.
- Aceite atômico altera a sessão somente se pedido e horário ainda forem válidos.
- Recusa preserva o horário confirmado e informa o paciente.
- Paciente e psicólogo veem estados inequívocos nas respectivas telas.
- Migração, lint, tipos, testes e build passam.

## Pendências conhecidas

Consolidação dos itens desmarcados e das pendências explícitas deste registro histórico. O estado abaixo reproduz o plano; não constitui uma nova auditoria do código ou da produção. Consulte as etapas originais para detalhes e confirme o estado atual antes de retomar o trabalho.

### Tarefa 1: Criar o modelo persistente e as operações transacionais

- [ ] Escrever testes falhando para: criação sem alterar `clinica_agendamentos`; rejeição do mesmo horário; prazo menor que 2 horas; sessão inexistente; duplicidade concorrente; leitura do pedido pendente; aceite; recusa; sessão já alterada/cancelada; e conflito de agenda no aceite.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/server/scheduling/rescheduleRequestRepository.test.ts` e confirmar a falha esperada.
- [ ] Criar `clinica_solicitacoes_reagendamento` com UUID, número sequencial por agendamento, instituição, agendamento, paciente, profissional, início/fim/modalidade atuais e solicitados, `status ENUM('pendente','aceita','recusada')`, `solicitado_em`, `respondido_em` e FKs coerentes com as tabelas atuais.
- [ ] Garantir uma única pendência por agendamento com uma chave gerada que seja igual ao `agendamento_id` somente quando `status = 'pendente'`, permitindo histórico de pedidos encerrados.
- [ ] Na mesma migração, ampliar `clinica_agenda_avisos.tipo` para `solicitacao_reagendamento_psicologo` e `recusa_reagendamento_paciente`, preservando todos os valores existentes.
- [ ] Expor tipos pequenos e explícitos:
- [ ] Implementar `requestPatientReschedule(...)`, `findPendingPatientRescheduleRequest(...)` e `decidePatientRescheduleRequest(...)`. A criação valida o slot disponível hoje, mas não o bloqueia. O aceite bloqueia profissional, pedido e sessão, compara o horário original, revalida bloqueios e sobreposição e atualiza sessão + pedido atomicamente. A recusa só encerra o pedido.
- [ ] No aceite, chamar `resetAppointmentChargeDue` apenas quando houver mudança real, confirmar a transação e só depois devolver os dados necessários aos efeitos externos. Não disparar efeitos de dentro da transação.
- [ ] Executar o teste focal até passar e então `npm run typecheck --workspace @thats-life/web`.
- [ ] Commit: `feat(agenda): persist patient reschedule requests`

### Tarefa 2: Trocar o endpoint público de alteração por solicitação

- [ ] Atualizar os testes para exigir que `POST /api/agenda/reagendar` chame `requestPatientReschedule`, nunca `rescheduleAppointmentPublic`, e responda com estado pendente e a frase “Reagendamento solicitado ao psicólogo”.
- [ ] Cobrir os mapeamentos HTTP: `404 NOT_FOUND`, `400 TOO_LATE/UNCHANGED`, `409 UNAVAILABLE/ALREADY_PENDING`, além de entrada e rate limit atuais.
- [ ] Executar os dois arquivos de teste e confirmar que falham pelo comportamento imediato antigo.
- [ ] Remover o caminho público que faz `UPDATE clinica_agendamentos` e seus efeitos; manter o reagendamento autenticado feito diretamente pelo próprio psicólogo sem mudanças.
- [ ] Retornar `agendamentoAtual` e `solicitacao` separadamente, sem `linkPagamento` do horário solicitado e sem a palavra “reagendada” no sucesso.
- [ ] Fazer o disparo assíncrono tolerante a falha do WhatsApp após a persistência; a resposta HTTP permanece de sucesso mesmo se o envio falhar.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/app/api/agenda/reagendar/route.test.ts src/server/scheduling/publicBooking.test.ts`.
- [ ] Commit: `feat(agenda): request patient reschedule approval`

### Tarefa 3: Avisar o psicólogo via WhatsApp com link direto

- [ ] Escrever testes para o texto da solicitação contendo paciente, horário atual, horário solicitado e URL absoluta `.../agenda?foco=sessao-<id>`; afirmar que não contém “foi remarcada”.
- [ ] Cobrir `NEXT_PUBLIC_APP_URL` com remoção de barra final e fallback `https://clinicavivermais.cloud`.
- [ ] Acrescentar as finalidades `agenda_solicitacao_reagendamento_psicologo` e `agenda_recusa_reagendamento_paciente`.
- [ ] Implementar `avisarSolicitacaoReagendamentoPsicologo(...)` usando deduplicação por solicitação. Passar o número sequencial persistido no pedido como `versao` de `clinica_agenda_avisos`; assim pedidos posteriores da mesma sessão não colidem e não dependem de hash do UUID.
- [ ] Implementar `avisarRecusaReagendamentoPaciente(...)`, dizendo que a mudança não foi aceita e que o horário confirmado continua válido.
- [ ] Garantir que ambos os disparos capturam falha e nunca lançam para o fluxo principal.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/server/application/appUrl.test.ts src/server/scheduling/agendaAvisos.test.ts`.
- [ ] Commit: `feat(whatsapp): notify reschedule approval workflow`

### Tarefa 4: Expor aceite e recusa autenticados

- [ ] Escrever testes falhando para `PATCH { decision: 'accept' | 'reject' }`, autenticação, psicólogo errado, decisão inválida, repetição e todos os conflitos do “Foco da revisão”.
- [ ] O serviço deve obter instituição e profissional pelo `RequestContext`, nunca confiar em IDs enviados pelo navegador.
- [ ] No aceite bem-sucedido, chamar `concluirReagendamento` somente depois do commit, reutilizando ajuste de cobrança e os dois avisos de sessão efetivamente remarcada.
- [ ] No conflito `UNAVAILABLE`, retornar erro claro: o horário não está mais livre; orientar o psicólogo a recusar e combinar outro horário. Não alterar o pedido para recusado automaticamente.
- [ ] Na recusa bem-sucedida, avisar o paciente após o commit e retornar a lista atualizada de `appointments`.
- [ ] Executar `npm run test --workspace @thats-life/web -- 'src/app/api/application/agenda/reagendamentos/[id]/route.test.ts' src/server/application/rescheduleRequestService.test.ts src/server/scheduling/agendaReagendamentoEffects.test.ts`.
- [ ] Commit: `feat(agenda): let psychologist decide reschedule requests`

### Tarefa 5: Mostrar o estado pendente ao paciente

- [ ] Fazer `agendamentoAtual` incluir `solicitacaoReagendamento?: RescheduleRequestSummary`, sem misturar horário proposto com o confirmado.
- [ ] Testar que, após solicitar, a tela mostra: “Reagendamento solicitado ao psicólogo. Seu horário atual continua válido enquanto você aguarda a resposta.”
- [ ] Mostrar dois blocos: “Horário confirmado” com o horário atual e “Horário solicitado” com selo “Aguardando resposta do psicólogo”.
- [ ] Remover “Sessão Reagendada com Sucesso” desse fluxo e impedir novo pedido enquanto existir pendência; manter o pagamento ligado somente à sessão confirmada.
- [ ] Após recusa ou aceite, o próximo carregamento deve refletir apenas o estado persistido, sem depender de estado local antigo.
- [ ] Executar os testes focais e `npm run typecheck --workspace @thats-life/web`.
- [ ] Commit: `feat(portal): show pending reschedule request`

### Tarefa 6: Mostrar e decidir o pedido na agenda do psicólogo

- [ ] Estender `AgendamentoResumo` com `solicitacaoReagendamento?: RescheduleRequestSummary` e carregar somente a solicitação pendente da própria sessão/profissional.
- [ ] Extrair o bloco destacado para manter `UpcomingSessions.tsx` abaixo do limite de 250 linhas ou reduzir o arquivo durante a integração sem alterar comportamentos existentes.
- [ ] Renderizar paciente, horário atual, horário solicitado, “Aceitar” e “Recusar”; desabilitar os dois botões durante a ação e preservar erro visível sem esconder a sessão.
- [ ] Em `agenda/page.tsx`, adicionar o callback que chama `/agenda/reagendamentos/<requestId>` e substitui `appointments` pela resposta. Integrar cuidadosamente com as mudanças locais já presentes no arquivo.
- [ ] Testar aceite, recusa, clique repetido, erro de conflito e recarga da lista.
- [ ] Executar `npm run test --workspace @thats-life/web -- src/components/scheduling/RescheduleRequestCard.test.tsx src/server/scheduling/agendaListagemConclusao.test.ts`.
- [ ] Commit: `feat(agenda): review reschedule requests in sessions`

### Tarefa 7: Adicionar notificação interna e validar a entrega

- [ ] Derivar uma notificação pendente por solicitação, com chave incluindo o ID do pedido, título “Reagendamento solicitado” e link `comFoco('/agenda', focoSessao(appointmentId))`.
- [ ] Testar que a notificação desaparece quando não existe mais solicitação pendente e que não duplica a notificação de sessão marcada.
- [ ] Executar todos os testes focais do plano.
- [ ] Executar `npm run lint`, `npm run typecheck`, `npm run test` e `npm run web:build` na raiz.
- [ ] Executar `npm run db:status` e confirmar que `061_solicitacoes_reagendamento.sql` é a próxima migração sem colisão de versão.
- [ ] Fazer busca de regressão: `rg -n "Sessão reagendada com sucesso|foi remarcada" apps/web/src/app/api/agenda apps/web/src/app/agendar` e confirmar que nenhuma mensagem prematura permanece no fluxo do paciente.
- [ ] Revisar o diff para garantir ausência de dados sensíveis em logs, ausência de alterações fora do escopo e preservação das mudanças locais do usuário.
- [ ] Commit: `test(agenda): cover reschedule approval workflow`
