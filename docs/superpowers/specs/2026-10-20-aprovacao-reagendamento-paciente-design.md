# Aprovação de reagendamento solicitado pelo paciente

## Objetivo

Impedir que o paciente altere unilateralmente uma sessão existente. O paciente solicita um novo horário, o psicólogo aceita ou recusa, e o horário original continua válido até o aceite. A solução também impede solicitações de última hora e evita que outra pessoa ocupe o horário proposto enquanto ele aguarda resposta.

## Escopo

Este desenho altera apenas o reagendamento iniciado pelo link público do paciente. Reagendamentos feitos pelo próprio psicólogo dentro da agenda continuam imediatos, porque já são uma decisão do responsável pela sessão.

Incluído:

- solicitação persistente e auditável;
- reserva temporária do horário proposto;
- prazo mínimo de duas horas para o horário atual e para o horário proposto;
- aceite, recusa e expiração;
- avisos no WhatsApp e no sino do sistema;
- atualização da cobrança somente depois do aceite;
- indicação clara do estado pendente para paciente e psicólogo.

Não incluído:

- negociação por mensagens dentro da plataforma;
- contraproposta do psicólogo;
- múltiplas solicitações pendentes para a mesma sessão;
- alteração do fluxo de reagendamento iniciado pelo psicólogo.

## Modelo de dados

Criar `clinica_solicitacoes_reagendamento` com:

- `id`, `instituicao_id` e `ref_core`;
- `agendamento_id`, `profissional_id` e `paciente_id`;
- fotografia do horário vigente: `inicio_anterior`, `fim_anterior` e `versao_agendamento`;
- proposta: `novo_inicio`, `novo_fim`, `nova_modalidade` e `duracao_min`;
- `status`: `pendente`, `aceita`, `recusada` ou `expirada`;
- `solicitado_em`, `respondido_em` e `expira_em`;
- `observacao_recusa`, opcional.

Uma chave condicional deve garantir no máximo uma solicitação pendente por agendamento. Índices por profissional/status e pelo intervalo proposto sustentam a listagem e a apuração de reservas.

`expira_em` será igual ao início proposto. Até esse instante, a proposta reserva o horário; depois dele, deixa de bloquear a agenda mesmo que a atualização explícita para `expirada` ainda não tenha ocorrido. Leituras da agenda e ações sobre solicitações materializam a expiração para manter o histórico coerente sem depender de um job agendado.

## Criação da solicitação

O endpoint público de reagendamento deixa de atualizar `clinica_agendamentos`. Dentro de uma transação, ele deve:

1. identificar paciente, psicólogo e sessão como já faz hoje;
2. travar o profissional como mutex da agenda;
3. confirmar que a sessão está ativa e pertence ao paciente;
4. rejeitar se faltarem menos de duas horas para o horário atual;
5. validar que o horário proposto começa pelo menos duas horas depois do instante atual;
6. validar a grade, bloqueios, sessões e outras reservas pendentes;
7. rejeitar uma segunda solicitação pendente para a mesma sessão;
8. inserir a solicitação sem alterar horário, status, cobrança ou versão da sessão.

A resposta pública passa a indicar `reagendamentoSolicitado: true`, o horário ainda confirmado e o horário solicitado. A tela mostra: “Solicitação enviada. Seu horário atual continua válido até o psicólogo aprovar a mudança.”

## Reserva do horário

Toda apuração de horários livres deve considerar como ocupadas as propostas com `status = 'pendente'` e `expira_em > CURRENT_TIMESTAMP(3)`. Isso vale para:

- listagem pública de horários;
- novo agendamento público;
- criação manual pelo psicólogo;
- reagendamento iniciado pelo psicólogo;
- edição direta de horário;
- bloqueios de agenda.

A confirmação final permanece transacional. A reserva reduz a chance de conflito, mas o aceite ainda revalida sessão, bloqueio e qualquer ocupação criada por caminhos concorrentes.

## Agenda do psicólogo

O resumo da agenda passa a devolver solicitações pendentes vinculadas às sessões. Em “Sessões e confirmações”, a sessão terá um bloco destacado com:

- rótulo “Reagendamento solicitado”;
- nome do paciente;
- horário atual;
- horário solicitado;
- momento da solicitação;
- botões “Aceitar” e “Recusar”.

Aceitar ou recusar usa uma rota autenticada vinculada ao profissional da sessão. A recusa permite uma observação curta e opcional. A interface bloqueia duplo clique, recarrega a agenda após a resposta e apresenta conflitos sem esconder o horário original.

## Aceite

Dentro de uma transação, o aceite deve:

1. travar o profissional, a solicitação e o agendamento;
2. confirmar que a solicitação continua pendente e não expirou;
3. confirmar que a versão e o horário original ainda correspondem à fotografia gravada;
4. revalidar o novo intervalo, ignorando somente a reserva da própria solicitação e o agendamento original;
5. atualizar início, fim, duração, modalidade, status e versão do agendamento;
6. marcar a solicitação como aceita;
7. registrar o plano de ajuste da cobrança com o novo vencimento.

Após o commit, o sistema executa o ajuste financeiro existente e envia os avisos de remarcação já usados pelo fluxo atual. Nenhuma cobrança muda enquanto a solicitação está pendente.

Se a sessão tiver sido cancelada, concluída, alterada por outro caminho ou o novo horário estiver ocupado, o aceite falha sem modificar a sessão. A solicitação permanece visível com uma mensagem acionável; quando a fotografia original não é mais válida, ela deve ser encerrada como expirada para não continuar reservando o horário.

## Recusa e expiração

Na recusa, o sistema trava a solicitação, confirma a autoria profissional, grava `recusada`, `respondido_em` e a observação opcional. O agendamento e a cobrança permanecem inalterados, e a reserva é liberada imediatamente.

Uma solicitação é expirada quando `expira_em <= agora`, ou quando o agendamento original deixou de ser compatível com a fotografia gravada. A expiração mantém o horário original que estiver vigente e libera a proposta.

## Avisos

Ao solicitar:

- WhatsApp do psicólogo: informa que o paciente solicitou, mostra horário atual e proposto e orienta a abrir a agenda para decidir;
- sino do psicólogo: item pendente com foco direto na sessão;
- paciente: confirmação na tela, sem mensagem de “sessão reagendada”.

Ao aceitar:

- paciente e psicólogo recebem a confirmação de remarcação com os dois horários;
- o aviso pendente do sino desaparece porque é derivado do estado da solicitação.

Ao recusar:

- paciente recebe que a solicitação não foi aprovada, a observação opcional e a confirmação de que o horário anterior continua válido;
- psicólogo recebe confirmação visual na agenda.

Mensagens usam chaves idempotentes por solicitação e tipo de aviso. Falha do provedor não desfaz a decisão já persistida.

## Regras de concorrência e integridade

- Uma única solicitação pendente por agendamento.
- Uma proposta pendente ocupa seu intervalo até `expira_em`.
- O mutex do profissional serializa solicitações, agendamentos, reagendamentos, edições e aceite.
- O aceite usa a versão do agendamento para detectar alteração concorrente.
- Repetir aceite ou recusa devolve o resultado existente sem duplicar cobrança ou mensagem.
- O paciente nunca recebe sucesso de reagendamento antes do aceite.

## Testes

Cobertura mínima:

- cria solicitação sem alterar a sessão;
- rejeita horário atual a menos de duas horas;
- rejeita novo horário a menos de duas horas;
- impede segunda solicitação pendente;
- reserva o novo intervalo em todas as entradas de agenda;
- aceita e atualiza sessão, versão e cobrança;
- recusa e preserva sessão e cobrança;
- expira e libera a reserva;
- rejeita aceite com sessão alterada ou novo conflito;
- garante autorização do psicólogo responsável;
- mantém idempotência de decisões e avisos;
- mostra os estados corretos nas telas do paciente e do psicólogo.

## Migração e compatibilidade

A mudança exige uma nova migração MySQL, aplicada antes da versão da aplicação que consulta a tabela. Sessões existentes não precisam de backfill. O fluxo profissional atual e agendamentos sem solicitação continuam funcionando sem mudança de dados.

