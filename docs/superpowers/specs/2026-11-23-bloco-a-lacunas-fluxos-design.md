# Bloco A — lacunas em fluxos existentes

**Data:** 23/11/2026 · **Estado:** especificação aprovada em conversa, aguardando revisão do texto
**Origem:** seção 3 de [comparacao-fluxos-viver-mais-2026-11-23.md](../../../output/comparacao-fluxos-viver-mais-2026-11-23.md) e [Especificação Final de Fluxos](../../../Especificacao%20Final%20Fluxos%20Clinica%20Viver.docx.pdf) (§§ 7.04, 7.07, 10.07, 11.04 e 13.02)

## Objetivo

Fechar três lacunas em fluxos que já existem no código e que não dependem de decisão da clínica:

1. Gravar na sessão o público do atendimento e oferecer 90 minutos para psicoterapia em grupo (§§ 7.04 e 14).
2. Comprovar com testes o crédito empresarial calculado pelo valor do contrato do convênio (§§ 10.07 e 11.04).
3. Registrar antes e depois de cada correção que a Gestão faz num atendimento e avisar o psicólogo afetado (§§ 7.07 e 13.02).

## Fora do escopo

- **Prazo da oferta configurável (§ 5.02) e inativação com motivo, com desistências no MySQL (§§ 6.05–6.06).** Faziam parte do bloco A desenhado em conversa. A sessão `clinica-viver-mais-63` começou a implementá-los na mesma cópia local, nas migrations 087–089, e eles saíram deste bloco para evitar trabalho duplicado.
- **Correção de valor e de pagador em sessão encerrada.** Depende dos créditos gravados com chave única, do bloco Financeiro. A edição continua bloqueando a troca de pagador nessas sessões.
- **Aviso por WhatsApp ao psicólogo sobre a correção.** Depende da pergunta 12 à clínica. Nesta rodada o aviso fica só no sino.

## 1 · Público gravado na sessão

**Situação atual**
- A migration [085](../../../infra/mysql/085_publico_agendamento.sql) criou `clinica_agendamentos.publico_atendimento`, e `getActiveUpcomingAppointment` já lê a coluna.
- Nenhum `INSERT` grava a coluna.
- `janelasCompativeisComPaciente` ([agendaRepository.ts](../../../apps/web/src/server/scheduling/agendaRepository.ts)) trata psicoterapia de grupo como individual, de 50 minutos. Já `duracaoEsperadaDaDemanda`, no core, usa 90 minutos para grupo.

**Regra**
- O público gravado é o da reserva, um retrato do momento. Uma edição posterior da sessão ou da triagem não muda esse valor. Registros antigos ficam com `NULL`, sem preenchimento retroativo.
- A função pura `publicoDaSessao({ serviceKey, duracaoMin, publicoDoVinculo })`, em `apps/web/src/lib/`, decide o valor:
  - Orientação Parental de 90 minutos grava `Família`.
  - Psicoterapia de Casal sem público no vínculo grava `Casal`.
  - Nos demais casos, grava o `para_quem_e` da triagem do vínculo, sem espaços nas pontas e com no máximo 160 caracteres. Sem ele, grava `NULL`.
- **Reserva pelo link:** `bookAppointments` usa `paciente.publico`, que já vem da triagem em `identifyPatient`, e inclui `publico_atendimento` no `INSERT`.
- **Agenda manual:** `Appointment` e `ScheduleAppointmentInput`, no core, ganham o campo opcional `audience`. O serviço de criação lê o `para_quem_e` da triagem do vínculo, aplica `publicoDaSessao` e preenche `audience`. O `upsertAppointment` grava a coluna só no `INSERT`, nunca no `ON DUPLICATE KEY UPDATE`, para que o reagendamento preserve o valor original.
- **Duração pelo § 14.** Os conjuntos B e C preveem "50 minutos individual e 1h30 casal/grupo" para Atendimento Psicológico, Orientação Parental, Orientação Vocacional e Orientação Profissional. Avaliação, do conjunto A, mantém 50 minutos, 1h30 ou duração variável. Uma função pura, `duracaoCompativelComPublico(serviceKey, duracaoMin, publicoDoVinculo)` em `apps/web/src/lib/`, aplica a regra nos dois caminhos. Considera-se coletivo o público que indica casal, família ou grupo (a mesma expressão de `duracaoEsperadaDaDemanda` no core).

  | Serviço | Público coletivo | Público individual | Público desconhecido |
  |---|---|---|---|
  | Avaliação | variável (15–240) | variável (15–240) | variável (15–240) |
  | Psicoterapia de Casal | 90 | 90 | 90 |
  | Orientação Parental | 90 | 50, ou 90 "em família" | 50 ou 90 |
  | Psicoterapia, Orientação Vocacional, Orientação Profissional | 90 | 50 | 50 ou 90 |

  - **Link:** `janelasCompativeisComPaciente` passa a usar essa função. O resultado é 90 minutos para grupo, casal ou família, e 50 para o público individual. Na Orientação Parental, o link continua oferecendo só 50 minutos para o público individual, como hoje e já testado. Com público desconhecido, Psicoterapia, Orientação Vocacional e Orientação Profissional continuam oferecendo só 50 minutos pelo link, como hoje. A opção "50 ou 90" da tabela vale só para a agenda manual.
  - **Agenda manual:** Psicoterapia, Orientação Vocacional e Orientação Profissional ganham as opções "Individual · 50 min" e "Casal, família ou grupo · 1h30", no mesmo modelo da Orientação Parental. O diálogo não recebe o público do paciente, e quem fornece esse dado (`patientDirectory.ts`) está sendo alterado pela sessão `clinica-viver-mais-63`. Por isso, `createAppointmentFlow` lê o público do vínculo na triagem e recusa, com HTTP 400 e mensagem que cita o público cadastrado, a duração que não corresponde a ele. Mostrar já no diálogo só a opção certa fica como melhoria posterior.
- **Pacientes inativados:** o seletor do `ManualAppointmentDialog` passa a esconder também os pacientes `paused`, além dos `discharged`. A sessão `clinica-viver-mais-63` usa `paused` para o vínculo inativado.

**Testes**
- Reserva pelo link grava o público: adulto com 50 minutos, grupo com 90.
- O filtro de janelas oferece 90 minutos para grupo.
- Orientação Parental em família, na agenda manual, grava `Família` com 90 minutos.
- O reagendamento preserva o público gravado.
- As funções `publicoDaSessao` e `duracaoCompativelComPublico` são testadas isoladamente, cobrindo cada linha da tabela do § 14.
- Na agenda manual, uma psicoterapia de 90 minutos para paciente de público adulto é recusada com 400. Para paciente de público grupo, é aceita e grava o público.
- O seletor de pacientes do diálogo manual não mostra pacientes `paused` nem `discharged`.

## 2 · Valor contratual do convênio

**Situação atual:** já está implementado na cópia local, sem commit.
- Migration [084](../../../infra/mysql/084_valor_sessao_convenio.sql) e campo no formulário do convênio.
- `registrarCobrancaContratual` e `precificarSessoesPendentes`, em [companySessionCharge.ts](../../../apps/web/src/server/payments/companySessionCharge.ts).
- Uso na confirmação, em `completeAppointment`, e na transferência de custeio.

O relatório ainda lista o item como pendente.

**Testes a acrescentar**
- Confirmação de sessão custeada com contrato de R$ 100 e tabela do profissional de R$ 120: a cobrança empresarial é gravada com 10.000 centavos, e o crédito dos dois painéis é R$ 70.
- Confirmação sem valor de contrato: nenhuma cobrança é criada, e a sessão fica com `valor_contrato_pendente = 1`.
- Cadastro posterior do valor (`precificarSessoesPendentes`): cada sessão pendente recebe uma única cobrança com a data da confirmação original, e a pendência é zerada.

Se um teste revelar defeito, a correção entra neste bloco.

## 3 · Antes/depois e aviso nas correções da Gestão

**Situação atual**
- `editGestaoAppointment` ([gestaoAgendaService.ts](../../../apps/web/src/server/application/gestaoAgendaService.ts)) edita horário, formato, situação e pagador por `updateAppointmentDetails`, dentro de uma transação que lê o agendamento com `FOR UPDATE`.
- Não fica registro do valor anterior, e o psicólogo não recebe aviso.

**Dados:** migration `090_agendamentos_alteracoes.sql`, idempotente, cria `clinica_agendamentos_alteracoes`:

| Coluna | Conteúdo |
|---|---|
| `id` | `CHAR(36)` |
| `instituicao_id` | FK para `instituicoes` |
| `organizacao_ref` | organização |
| `agendamento_id` | linha de `clinica_agendamentos` |
| `profissional_ref` | psicólogo afetado, que recebe o aviso |
| `alterado_por_usuario_ref`, `alterado_por_nome` | autor, vindo só da sessão assinada |
| `alterado_em` | `TIMESTAMP(3)` |
| `mudancas` | JSON `[{ campo, rotulo, de, para }]` |

- Chave única: `(instituicao_id, agendamento_id, alterado_em)`.
- Índice: `(instituicao_id, organizacao_ref, profissional_ref, alterado_em)`.

**Gravação**
- `UpdateAppointmentOptions` ganha `registrarAlteracaoGestao?: { usuarioRef, nome? }`.
- Quando a opção está presente, `updateAppointmentDetails` calcula a diferença entre a linha travada e os valores novos, antes do `commit` e na mesma transação.
- Campos comparados:
  - data e horário (início e término);
  - formato;
  - situação;
  - pagador (paciente ou empresa).
- Os valores são gravados em texto legível: data e hora no fuso da clínica, e "On-line", "Presencial" ou "Telefone".
- Sem diferença, nenhuma linha é gravada.
- Se a tabela ainda não existe (migration não aplicada, erro `ER_NO_SUCH_TABLE`), a edição continua e o aviso é registrado no log, sem dados do paciente. Em qualquer outro erro, a transação é desfeita.
- `editGestaoAppointment` passa a opção, com autor tirado de `context.actor` e nome resolvido por `nomeDoUsuario` (de `autorGestao.ts`). Vale para qualquer atendimento editado pela Gestão, aberto ou encerrado.
- **Vencimento da cobrança (§ 7.07).** `updateGestaoChargeDue` lê o vencimento anterior, aplica a troca e, só depois de aceita, grava a linha com o campo "Vencimento da cobrança". A troca passa pela integração bancária, que usa transação própria, por isso esta linha não entra na mesma transação. Se a gravação do histórico falhar, o vencimento continua alterado e o erro vai para o log, sem dados do paciente.

**Aviso ao psicólogo**
- A função pura `notificacoesDeCorrecaoDaGestao`, num arquivo novo em `server/application/`, transforma as alterações do psicólogo dentro da janela de 30 dias que o sino já usa em avisos com:
  - chave `agenda-corrigida:<agendamento>:<alterado_em>`;
  - texto "A Gestão alterou o atendimento de <paciente> de <data>: <rótulo> de <de> para <para>";
  - destino na agenda.
- A leitura junta o nome de exibição do paciente na consulta.
- A ligação é feita em [notificacoesDaSessao.ts](../../../apps/web/src/server/application/notificacoesDaSessao.ts), no mesmo controle de lida dos demais avisos. O arquivo `notificacoes.ts` não é editado, porque a sessão `clinica-viver-mais-63` está trabalhando nele.
- A Gestão não recebe esse aviso, porque é ela quem fez a alteração.

**Consulta pela Gestão:** a gaveta de edição da agenda da Gestão mostra o histórico do atendimento (quem, quando, de, para), lido por uma rota `GET` do próprio agendamento.

**Testes**
- A diferença inclui só os campos alterados.
- Uma edição sem mudança não grava linha.
- O autor vem da sessão, nunca do corpo da requisição.
- A gravação acontece na mesma transação: falha no `INSERT` desfaz a edição, exceto quando a tabela está ausente.
- O psicólogo afetado vê o aviso, e outro psicólogo não vê.
- O aviso sai do sino pela retenção padrão de 30 dias, a mesma dos demais avisos encerrados.
- A troca de vencimento pela Gestão grava o vencimento anterior e o novo.
- Uma troca recusada (cobrança paga ou data inválida) não grava histórico.

## Validação e entrega

- TDD em cada item, com vitest no padrão dos testes vizinhos.
- Ao final, `npm run check`, informando falhas preexistentes ou causadas pelas alterações paralelas.
- Nada de commit, push ou deploy sem pedido explícito. A migration 090 é aplicada na VPS só com autorização.
- O relatório tem só as linhas 136, 137 e 142 atualizadas, depois que a sessão `clinica-viver-mais-63` terminar a edição dela.
