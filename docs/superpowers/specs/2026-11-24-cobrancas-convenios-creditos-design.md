# Cobranças, convênios e Créditos Educacionais

**24/11/2026 · Especificação aprovada pela clínica.** Escopo dos §§ 9–11 da [especificação de fluxos](../../../Especificacao%20Final%20Fluxos%20Clinica%20Viver.docx.pdf). A clínica confirmou que o paciente paga o pacote integralmente em uma única cobrança. Em cobranças avulsas, cada recebimento parcial confirmado tem valor e competência próprios.

## Pacote antecipado do paciente

A Gestão cadastra paciente, profissional, quantidade de sessões e valor total. A confirmação bancária integral libera o saldo e gera um único crédito de 70% do valor do pacote. Um recebimento de valor divergente fica identificável para conciliação, sem liberar o pacote. A agenda vincula cada atendimento a uma unidade. A relação entre pacote e agendamento deve impedir cobrança individual pelo mesmo serviço, consumo duplicado em reenvios e saldo negativo em reservas simultâneas. Reagendar mantém o vínculo. A Gestão consulta quantidade prevista, utilizada e restante.

**Aceite.** Quatro sessões por R$ 400 pagas em novembro geram R$ 280 naquele mês. Depois de utilizar uma unidade, restam três. Confirmar essa sessão em dezembro e receber novamente o evento do banco preservam os mesmos totais.

## Vencimento e saldo em aberto

Psicólogo e Gestão podem solicitar alteração dentro das permissões existentes. A interface distingue prazo vigente de prazo solicitado. O processamento identifica provedor, cobrança e saldo, preserva as baixas anteriores e registra a resposta. A data e a hora efetivas só mudam quando confirmadas pela instituição. Se um meio de pagamento só aceitar data, a aplicação deve comunicar essa limitação. Um cancelamento da instrução anterior, isoladamente, não comprova o novo prazo.

**Aceite.** Numa cobrança de R$ 100 com R$ 40 recebidos, o novo prazo aplica-se aos R$ 60 em aberto. Cobrança liquidada durante a solicitação, falha de comunicação e retorno bancário repetido têm testes específicos. No caso de retorno incerto, a retomada consulta o estado remoto antes de reenviar. Os testes usam provedores simulados.

## Créditos persistidos e correções

O extrato do psicólogo e a apuração pelo Financeiro passam a ler os mesmos lançamentos. Cada lançamento preserva organização, profissional, origem, identificador do evento econômico, valor-base, crédito em centavos e data da competência. Uma restrição única no banco identifica a origem por organização e tipo. A gravação suporta reprocessamento e eventos simultâneos. A transição dos registros existentes usa as mesmas chaves, com conferência por profissional e mês antes da troca da leitura.

| Origem | Base dos 70% | Competência |
| --- | --- | --- |
| Cobrança avulsa | Cada novo valor bruto efetivamente recebido | Confirmação do pagamento |
| Pacote do paciente | Total integral recebido uma vez | Confirmação do pagamento do pacote |
| Atendimento custeado pela empresa | Valor individual do contrato | Confirmação da realização |

A quitação de uma fatura empresarial preserva o crédito já lançado pela sessão. Quando o preço contratual for informado depois, a competência continua sendo a da confirmação original. Estorno, devolução e contestação ficam vinculados à origem. A Gestão registra a decisão de manter ou ajustar o crédito, com justificativa, autoria da sessão autenticada, data e valor. Um ajuste é um novo lançamento vinculado ao original. Reenviar a mesma decisão não altera novamente o saldo.

**Aceite.** Uma sessão de R$ 100 paga em duas partes de R$ 40 e R$ 60 gera créditos de R$ 28 e R$ 42 nas competências dos recebimentos. Um reembolso posterior mantém o original disponível. Uma decisão administrativa de reduzir R$ 28 gera um único ajuste de −R$ 28. O Financeiro consulta a decisão e o psicólogo vê somente os próprios lançamentos.

## Política contratual de convênios

O cadastro do convênio define separadamente o consumo de cota por falta e por cancelamento. Ao atingir o limite, aplica-se a opção do contrato para bloquear novo custeio, cobrar o funcionário ou solicitar autorização administrativa. Preservar os efeitos já registrados quando o contrato mudar. Para contratos existentes sem política explícita, manter o comportamento vigente até a Gestão definir a regra.

O demonstrativo aplica a base da empresa no período escolhido: sessões realizadas, sessões agendadas ou quantidade fixa contratada. A Gestão confere quantidades, valores e ajustes antes de emitir a fatura. O consumo da cota, o faturamento e a realização clínica são fatos distintos.

**Aceite.** Duas empresas com políticas opostas de falta produzem saldos diferentes para a mesma ocorrência. Nenhuma falta gera estágio ou crédito empresarial. Repetir com cancelamento, testar cada opção de excedente e confrontar a prévia das três bases com a fatura emitida.

## Apuração mensal para o Financeiro

No quinto dia útil do mês seguinte, o Financeiro deve conseguir consultar a competência anterior por profissional, com origem, datas, bases, créditos, ajustes e comprovantes aplicáveis. A tela, o arquivo Excel (.xlsx) e o PDF usam a mesma consulta e os mesmos totais, respeitando o fuso da clínica, as permissões e o isolamento por organização. A operação sobre o boleto acadêmico continua a cargo do Financeiro em seu outro sistema.

**Aceite.** Conferir os três formatos com pagamento parcial entre meses, pacote, sessão empresarial, ajuste manual e competência vazia. Verificar o conteúdo dos arquivos gerados e a exclusão de registros de outra organização e de dados de prontuário.

## Pontos de integração existentes

- [Cálculo de créditos no domínio](../../../packages/core/src/financial/educationalCredits.ts), [extrato](../../../apps/web/src/server/application/financialService.ts) e [apuração da clínica](../../../apps/web/src/server/application/clinicFinanceService.ts).
- [Plano de vencimento](../../../apps/web/src/server/payments/sessionChargeDuePlan.ts) e [processamento bancário](../../../apps/web/src/server/payments/sessionChargeDueWorker.ts).
- [Registro de falta](../../../apps/web/src/server/scheduling/agendaFalta.ts) e [painel de faturamento](../../../apps/web/src/components/convenios/FaturamentoPanel.tsx).
