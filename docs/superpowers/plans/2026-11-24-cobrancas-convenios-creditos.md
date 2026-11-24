# Plano de implementação de cobranças, convênios e créditos

> Para execução por agentes, usar `superpowers:executing-plans` ou `superpowers:subagent-driven-development`. Conferir cada tarefa na cópia corrente antes de marcar seus passos.

**Objetivo.** Entregar os seis fluxos dos §§ 9–11 pela agenda, Gestão e Financeiro, preservando os recebimentos e a competência de cada crédito.

**Arquitetura.** As regras de origem e rateio ficam no core. Eventos de pagamento e realização geram lançamentos no MySQL. Extrato, apuração mensal e exportações consultam esses lançamentos. A integração bancária continua no servidor e usa a fila existente para repetir operações interrompidas.

**Tecnologia.** TypeScript, Next.js, MySQL, Vitest, PDFKit e um escritor de XLSX no servidor. [Especificação aprovada](../specs/2026-11-24-cobrancas-convenios-creditos-design.md).

## Resultado local em 24/11/2026

Os seis fluxos estão implementados na cópia local. Os nomes de arquivos e os testes indicados no roteiro abaixo correspondem ao desenho inicial. Na implementação, a gravação automática dos créditos ocorre na transação do MySQL e os testes que atravessam várias camadas estão reunidos na [jornada financeira em MySQL](../../../apps/web/src/server/application/financeiroFluxos.mysql.test.ts).

| Verificação | Resultado observado |
| --- | --- |
| Pacote de R$ 400 | Um crédito de R$ 280. Duas reservas simultâneas disputaram a última unidade e uma foi aceita. Um recebimento divergente ficou em conciliação. |
| Cobrança avulsa | R$ 40 e R$ 60 recebidos em competências diferentes geraram R$ 28 e R$ 42. Uma simulação de timeout confirmou o novo prazo por consulta ao Pix na retomada. |
| Decisão da Gestão | Uma redução de R$ 28 manteve o crédito original. A repetição devolveu a decisão existente. A Gestão também registrou uma decisão de manter o crédito empresarial após reembolso da fatura. |
| Convênio | A falta consumiu cota segundo o contrato. O cancelamento de uma reserva antiga respeitou a política vigente. A cobrança agendada que mudou de período ficou fora da segunda fatura. A quitação de uma fatura fixa preservou o crédito da sessão realizada. |
| Importação histórica | O ensaio partiu da migration 093 com dados fictícios. Uma origem empresarial ambígua bloqueou a 099. Após corrigir o dado de teste e repetir o runner, restaram três créditos de R$ 28, R$ 42 e R$ 70 em duas competências. |
| Apuração mensal | O Excel reaberto e o texto extraído do PDF conferiram com as quatro origens de crédito e o total de R$ 350 do conjunto de teste. Os dois formatos aceitaram competência vazia. |

`npm run check` concluiu com 230 testes do core, 1.960 da aplicação e build aprovado. O ESLint registrou 44 avisos e o Turbopack emitiu um aviso de rastreamento de arquivos. A [comparação dos fluxos](../../../output/comparacao-fluxos-viver-mais-2026-11-23.md) reúne os links para as implementações.

## Convenções e execução

Os caminhos abaixo partem de `apps/web/src/`, salvo prefixo explícito do monorepo. Usar centavos inteiros e o rateio 70/30 do core. Identificar organização, autor e permissões pela sessão. Manter os componentes abaixo de 250 linhas. Usar dados fictícios e adaptadores simulados. Preservar alterações simultâneas da outra sessão. Ler `infra/mysql/migrate.mjs` e escolher os próximos números livres na hora de criar as migrations. Na elaboração deste plano, 091–093 já existiam.

Cada tarefa começa pelos testes de aceitação descritos nela. Executar a suíte antes da mudança, implementar e executar novamente. Comandos na raiz: `npm run test --workspace @thats-life/web -- <arquivo>` e `npm run test --workspace @thats-life/core -- <arquivo>`. As tarefas 1–2 sustentam 3, 4 e 7. As tarefas 5 e 6 podem ser validadas separadamente. Executar 8 por último.

## Casos prioritários de revisão

1. Webhook repetido e dois processadores simultâneos devem produzir um único lançamento (tarefas 1–3).
2. Duas reservas disputam a última unidade do pacote (tarefa 3).
3. O banco efetiva a mudança, a resposta se perde e um pagamento chega antes da retomada (tarefa 5).
4. O contrato muda depois de uma falta ou emissão de fatura (tarefa 6).
5. Uma confirmação perto da meia-noite UTC e um ajuste posterior aparecem nas competências e nos totais corretos dos três formatos (tarefas 4 e 7).

## Tarefa 1 — Identidade e armazenamento do crédito

- [ ] Estender `packages/core/src/financial/educationalCredits.ts` e seu teste. Modelar origens de recebimento avulso, pacote integral, realização empresarial e ajuste. Para empresa, usar a confirmação do atendimento como identidade econômica estável mesmo se a cobrança for substituída. Para pagamento distribuído, usar a alocação efetivamente recebida e o vínculo à cobrança.
- [ ] Criar migration e `server/persistence/mysql/educationalCreditRepository.ts` com escrita `registrarCredito(connection, entrada)` e leitura por organização, profissional e período. Persistir origem, referência, base, crédito, instante de competência, vínculos e lançamento original quando houver ajuste. Chave única sobre instituição, organização, tipo e referência de origem.
- [ ] Testar em `educationalCreditRepository.test.ts` repetição equivalente, divergência de valor para a mesma origem, rollback e isolamento. O replay equivalente preserva o lançamento existente; uma divergência permanece visível para revisão.

## Tarefa 2 — Produção de créditos e transição dos dados existentes

- [ ] Nos testes de `server/payments/paymentSettlement.ts`, `companySessionCharge.ts` e na baixa manual da rota `app/api/application/financial/clinica/[chargeId]/payments/`, cobrir parcelas de R$ 40 e R$ 60 em meses diferentes, sessão empresarial de R$ 100 e quitação posterior. Esperar R$ 28, R$ 42 e R$ 70 respectivamente.
- [ ] Integrar a escrita do crédito à transação que aceita a baixa ou materializa a cobrança contratual. Cobrir `precificarSessoesPendentes` preservando a data original da confirmação. Identificar todos os caminhos de baixa, inclusive a implementação do repositório financeiro e o adaptador de demonstração. Um pagamento da fatura empresarial não cria segundo crédito.
- [ ] Preparar reconciliação por organização e mês: simular a importação histórica usando as mesmas chaves, comparar origens e totais com a apuração atual e identificar origens ambíguas para revisão. Testar duas execuções e eventos novos durante a carga. A troca de leitura de `server/application/financialService.ts` e `clinicFinanceService.ts` ocorre após reconciliar os dados. Ensaiar em base descartável com fixtures.

## Tarefa 3 — Venda e uso do pacote integral

- [ ] Criar `server/application/patientPackageService.ts`, `server/persistence/mysql/patientPackageRepository.ts`, migration, rotas sob `app/api/application/gestao/pacotes/` e painel de pacotes na Gestão. Operações: criar pacote, cobrar o total, consultar saldo e vincular atendimento. Incluir quantidade positiva, preço total, paciente, profissional e organização. Distinguir a cobrança do pacote de uma cobrança de sessão.
- [ ] Integrar a identificação do pacote no checkout e na baixa da tarefa 2. Liberar unidades e gravar o crédito uma vez na confirmação integral. Recebimento divergente fica em conciliação e não libera saldo nem entra como pagamento avulso. O formulário oferece pagamento integral.
- [ ] Nos caminhos `server/application/appointmentService.ts` e `server/scheduling/agendaRepository.ts`, resolver o vínculo autorizado e reservar a unidade dentro da transação do agendamento. Tornar único o consumo por agendamento. Na criação, recuperação e conclusão, `server/payments/sessionCharge.ts` deve reconhecer a cobertura do pacote antes de gerar cobrança. Preservar a unidade no reagendamento.
- [ ] Cobrir API, repositório e fluxo completo em `patientPackageService.test.ts` e testes da agenda. Quatro sessões por R$ 400 liberam quatro unidades e R$ 280 no mês da confirmação; reservar uma deixa três. Confirmar no mês seguinte não credita novamente. Disputa pela última unidade aceita uma reserva. Pacote pendente, replay de webhook, outro profissional e outra organização também têm casos próprios.

## Tarefa 4 — Decisão da Gestão sobre estorno e reembolso

- [ ] Criar `server/application/creditAdjustmentService.ts`, rota sob `app/api/application/gestao/creditos/[id]/ajustes/` e ação no detalhe financeiro. O comando recebe a referência do evento, a decisão, a justificativa, o valor do ajuste e a chave de idempotência. Resolver autor, original e organização no servidor.
- [ ] Registrar decisão e ajuste na mesma transação. Conservar o valor original e permitir decisão de manter o crédito. Exibir original, motivo, ajuste e resultado. Repetir solicitação idêntica devolve o resultado já registrado. Reutilizar a chave com conteúdo divergente gera conflito.
- [ ] Em `creditAdjustmentService.test.ts` e no teste da rota, cobrir redução de R$ 28, manutenção, justificativa vazia, rollback, leitura pelo Financeiro e recusa de escrita por Financeiro ou psicólogo. Incluir estorno bancário recebido antes da decisão.

## Tarefa 5 — Alteração do vencimento sobre o saldo aberto

- [ ] Revisar os contratos oficiais e os adaptadores `server/adapters/asaasAdapter.ts` e `interPixAdapter.ts` por meio de pagamento. Documentar no teste de cada adaptador o campo de data, a precisão permitida e o retorno que comprova a alteração. Para um instrumento sem suporte à hora solicitada, preservar o prazo vigente e devolver a limitação específica.
- [ ] Em `server/payments/sessionChargeDue{,Plan,Queue,Worker}.ts`, separar vencimento vigente, solicitado e resultado bancário. Calcular o saldo pelas baixas confirmadas, sob trava. Guardar identificador da operação e da instrução, reencontrar a operação após timeout e conferir saldo, identificador e prazo antes de promover o novo vencimento. Preservar o fluxo de expiração existente.
- [ ] Atualizar o botão `components/financial/ChargeDueButton.tsx`, agenda e histórico para distinguir pendência, confirmação e falha. Testar em `sessionChargeDue.test.ts` e nos adaptadores: saldo de R$ 60 após baixa de R$ 40, quitação simultânea, resposta repetida, divergência de data, precisão limitada, timeout após sucesso e simples cancelamento da instrução antiga. Testar as permissões de Gestão e de profissional.

## Tarefa 6 — Contrato do convênio, consumo e demonstrativo

- [ ] Estender `server/application/convenioService.ts`, `server/persistence/mysql/convenioRepository.ts`, migration e `components/convenios/ConvenioFormModal.tsx`. Reutilizar campos de contrato já existentes e persistir as políticas ausentes: consumo por falta e por cancelamento, destino dos excedentes e base do faturamento. Preservar o comportamento dos contratos antigos até edição explícita.
- [ ] Integrar a política à reserva, `server/scheduling/agendaFalta.ts`, cancelamento e cálculo da cota. Persistir o consumo efetivo por atendimento, inclusive quando a falta consome cota. As três saídas para excedente são impedir custeio, cobrar funcionário ou aguardar autorização administrativa. Proteger a última vaga contra concorrência.
- [ ] Em `components/convenios/FaturamentoPanel.tsx` e no fechamento da fatura, usar a base do período para prévia e emissão; persistir a composição e os ajustes aprovados. Testar quantidades distintas para realizadas, agendadas e fixas e conferir o valor emitido. Alterar o contrato posteriormente preserva a fatura emitida.
- [ ] Ampliar `agendaFalta.test.ts` e `FaturamentoPanel.test.tsx` com dois contratos de políticas opostas, cancelamento, repetição e cada saída de excedente. Demonstrar que uma falta contratualmente consumida gera zero horas e zero crédito empresarial.

## Tarefa 7 — Apuração por profissional, XLSX e PDF

- [ ] Implementar uma consulta em `server/application/clinicFinanceService.ts` por competência e profissional, incluindo origens, ajustes e referências autorizadas aos comprovantes. Usar limites do mês no fuso da clínica. Expor ao Financeiro na página `app/gestao/financeiro/page.tsx`, com a competência anterior disponível no quinto dia útil e consulta histórica. Manter o extrato do psicólogo restrito ao próprio perfil.
- [ ] Criar rota sob `app/api/application/financial/creditos/relatorio/` e renderizadores em `server/reports/`. Tela, PDFKit e XLSX recebem o mesmo resultado da consulta. Gravar valores monetários numéricos na planilha e texto como texto. Selecionar biblioteca de escrita XLSX compatível com Node no servidor, registrar a dependência no workspace web e conferir o lockfile.
- [ ] Em `server/reports/educationalCreditReport.test.ts` testar XLSX reaberto por leitor de planilha, texto extraído do PDF e dados da tela. Reconciliar os três totais com pagamentos em dois meses, pacote, sessão empresarial, ajuste e mês vazio. Testar fronteira UTC, comprovantes e exclusão de registros de outra organização.

## Tarefa 8 — Verificação integrada e atualização do relatório

- [x] Exercitar com dados fictícios a jornada de criação, pagamento, agenda, correção e apuração. Testar concorrência real sobre MySQL descartável para chave única e última unidade, além dos testes de serviços com provedores simulados. Conferir que a adoção das migrations preserva organizações com dados anteriores.
- [x] Rodar `npm run check`, conferir links e `git diff --check`. Atualizar somente os seis itens correspondentes em `output/comparacao-fluxos-viver-mais-2026-11-23.md` conforme evidências obtidas. Distinguir código validado localmente de homologação bancária e aplicação de migrations na VPS.

## Pendências conhecidas

A homologação com os bancos e a aplicação das migrations 094–103 na VPS permanecem pendentes. A alteração automática com data e hora foi validada com o Pix Inter simulado. Para uma instrução Asaas já emitida, a interface informa que o meio aceita somente data. A exportação XLSX usa `write-excel-file`.
