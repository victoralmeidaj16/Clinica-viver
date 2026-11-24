# Bloco A — lacunas em fluxos existentes · Plano de implementação

> **Para agentes:** sub-skill obrigatório: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** gravar o público e a duração do § 14 nas sessões, comprovar o crédito empresarial pelo valor do contrato e registrar antes/depois, com aviso ao psicólogo, de cada correção da Gestão num atendimento.

**Arquitetura:**
- Regras puras em `apps/web/src/lib/`, usadas pelos dois caminhos de agendamento (link e agenda manual).
- Trilha de alterações em `clinica_agendamentos_alteracoes` (migration 090), gravada na mesma transação da edição.
- Aviso ao psicólogo calculado a partir da trilha, no padrão de `perfil-alterado`.

**Tecnologia:** Next.js App Router, TypeScript, MySQL (`mysql2`) e vitest, em monorepo com `@thats-life/core` e `@thats-life/web`.

**Spec:** [docs/superpowers/specs/2026-11-23-bloco-a-lacunas-fluxos-design.md](../specs/2026-11-23-bloco-a-lacunas-fluxos-design.md)

## Restrições globais

- **Sem commit, push ou deploy.** O usuário autoriza commits explicitamente, e o push no `main` publica sozinho na Vercel. Cada tarefa termina com a lista de arquivos alterados, não com commit.
- **Arquivos da sessão `clinica-viver-mais-63` não são editados:** `notificacoes.ts`, `patientDirectory.ts`, `viverMaisRodizio.ts`, `persistence.ts`, `mysql/captureRepository.ts`, `paymentLinkRepository.ts`, `clinicFinanceService.ts`, `gestao/pacientes/route.ts`, `desistencias/route.ts`, rotas de triagem, `vitrine/page.tsx`, `components/patients/*` e migrations 087–089. Importar de `autorGestao.ts` é permitido.
- **Releia `agendaRepository.ts` antes de editá-lo.** A sessão 63 alterou `identifyPatient()`.
- Componentes com **menos de 250 linhas**.
- Isolamento por organização. O autor vem da sessão validada (`context.actor.userId`), nunca do corpo da requisição.
- Migration idempotente (`CREATE TABLE IF NOT EXISTS`). A aplicação continua funcionando enquanto a 090 não estiver aplicada.
- Nada de conteúdo clínico, telefone ou nome de paciente em `console.*`.
- Texto de interface e mensagens em português, com os rótulos exatos fixados nas tarefas.
- Comandos de teste:
  - web: `cd apps/web && npx vitest run <arquivo>`;
  - core: `cd packages/core && npx vitest run <arquivo>`.

## Foco da revisão

1. **Reagendamento ou edição sobrescrevendo o público.** O `ON DUPLICATE KEY UPDATE` de `upsertAppointment` não pode tocar em `publico_atendimento`. Teste na Tarefa 3.
2. **Público com acento, maiúsculas ou texto composto.** "FAMÍLIA", "Família" e "Grupo terapêutico" contam como coletivos; "Adulto" e "Criança", não. Teste na Tarefa 1.
3. **Edição que reenvia os mesmos valores.** Por exemplo, o mesmo início e término com outro `expectedVersion`. Não grava linha na trilha nem gera aviso. Teste na Tarefa 5.
4. **Migration 090 ainda não aplicada.** A edição da Gestão conclui normalmente e só registra o aviso no log (`ER_NO_SUCH_TABLE`). Qualquer outro erro desfaz a edição. Teste na Tarefa 5.
5. **Isolamento.** O aviso de correção aparece só para o psicólogo do atendimento, e o histórico de um atendimento de outra organização devolve 404. Testes nas Tarefas 5 e 6.

---

### Tarefa 1: Regras puras de público e duração da sessão

**Arquivos:**
- Criar: `apps/web/src/lib/publicoDuracaoSessao.ts`
- Teste: `apps/web/src/lib/publicoDuracaoSessao.test.ts`

**Interfaces**
- Produz:
  - `publicoColetivo(publico?: string): boolean` — normaliza com `NFD`, sem acentos e em minúsculas, e testa `/\b(casal|casais|familia|grupo)\b/`.
  - `publicoDaSessao(input: { serviceKey?: string; duracaoMin: number; publicoDoVinculo?: string }): string | undefined`
  - `duracaoCompativelComPublico(serviceKey: string, duracaoMin: number, publicoDoVinculo: string | undefined, origem: 'link' | 'manual'): boolean`

- [x] **Passo 1: escrever os testes que falham**

```ts
describe('publicoColetivo', () => {
  it.each(['Casal', 'FAMÍLIA', 'familia', 'Grupo terapêutico', 'Casais'])('%s é coletivo', (p) => expect(publicoColetivo(p)).toBe(true));
  it.each(['Adulto', 'Criança', 'Adolescente', '', undefined])('%s não é coletivo', (p) => expect(publicoColetivo(p)).toBe(false));
});
describe('publicoDaSessao', () => {
  it('Orientação Parental de 90 min grava Família', () => expect(publicoDaSessao({ serviceKey: 'ORIENTACAO_PARENTAL', duracaoMin: 90, publicoDoVinculo: 'Criança' })).toBe('Família'));
  it('Orientação Parental de 50 min grava o público do vínculo', () => expect(publicoDaSessao({ serviceKey: 'ORIENTACAO_PARENTAL', duracaoMin: 50, publicoDoVinculo: 'Criança' })).toBe('Criança'));
  it('Casal sem público grava Casal', () => expect(publicoDaSessao({ serviceKey: 'PSICOTERAPIA_CASAL', duracaoMin: 90 })).toBe('Casal'));
  it('apara e limita a 160 caracteres', () => expect(publicoDaSessao({ serviceKey: 'PSICOTERAPIA', duracaoMin: 50, publicoDoVinculo: `  ${'a'.repeat(200)}  ` })).toHaveLength(160));
  it('sem público devolve undefined', () => expect(publicoDaSessao({ serviceKey: 'PSICOTERAPIA', duracaoMin: 50, publicoDoVinculo: '  ' })).toBeUndefined());
});
describe('duracaoCompativelComPublico (§ 14)', () => {
  it.each([
    ['AVALIACAO', 75, 'Adulto', 'manual', true], ['AVALIACAO', 300, 'Adulto', 'manual', false],
    ['PSICOTERAPIA_CASAL', 90, undefined, 'link', true], ['PSICOTERAPIA_CASAL', 50, 'Casal', 'manual', false],
    ['ORIENTACAO_PARENTAL', 90, 'Família', 'link', true], ['ORIENTACAO_PARENTAL', 50, 'Família', 'manual', false],
    ['ORIENTACAO_PARENTAL', 90, 'Criança', 'manual', true], ['ORIENTACAO_PARENTAL', 90, 'Criança', 'link', false],
    ['ORIENTACAO_PARENTAL', 50, undefined, 'link', true], ['ORIENTACAO_PARENTAL', 90, undefined, 'link', true],
    ['PSICOTERAPIA', 90, 'Grupo', 'link', true], ['PSICOTERAPIA', 50, 'Grupo', 'manual', false],
    ['PSICOTERAPIA', 50, 'Adulto', 'manual', true], ['PSICOTERAPIA', 90, 'Adulto', 'manual', false],
    ['PSICOTERAPIA', 90, undefined, 'manual', true], ['PSICOTERAPIA', 90, undefined, 'link', false],
    ['PSICOTERAPIA', 50, undefined, 'link', true], ['ORIENTACAO_VOCACIONAL', 90, 'Grupo', 'link', true],
    ['ORIENTACAO_PROFISSIONAL', 90, 'Adolescente', 'manual', false], ['DESCONHECIDO', 50, 'Adulto', 'manual', false],
  ] as const)('%s %i min, público %s, %s → %s', (s, d, p, o, esperado) =>
    expect(duracaoCompativelComPublico(s, d, p, o)).toBe(esperado));
});
```

- [x] **Passo 2:** rodar `cd apps/web && npx vitest run src/lib/publicoDuracaoSessao.test.ts`. Esperado: FAIL, módulo inexistente.

- [x] **Passo 3: implementar as três funções em `publicoDuracaoSessao.ts`**
  - A Avaliação usa `isValidAppointmentDuration` de `@thats-life/core/src/scheduling/validation`.
  - Serviços fora de `CLINICAL_SERVICES` (`lib/manualAppointment.ts`) devolvem `false`.
  - A tabela de durações é a do spec, seção 1, com uma exceção: com `origem: 'link'` e público desconhecido, Psicoterapia, Orientação Vocacional e Orientação Profissional aceitam só 50 minutos, como o link faz hoje. A dupla opção de 50 ou 90 minutos vale só para a agenda manual, onde o profissional escolhe.

- [x] **Passo 4:** rodar o mesmo comando. Esperado: PASS.

---

### Tarefa 2: Link de agenda grava o público e oferece 90 min ao coletivo

**Arquivos:**
- Modificar: `apps/web/src/server/scheduling/agendaRepository.ts` (`janelasCompativeisComPaciente` e o `INSERT` em `bookAppointments`)
- Teste: `apps/web/src/server/scheduling/publicBooking.test.ts`

**Interfaces**
- Consome: `duracaoCompativelComPublico` e `publicoDaSessao` da Tarefa 1.

- [x] **Passo 1: acrescentar os testes que falham**
  - `janelasCompativeisComPaciente` com `serviceKey: 'PSICOTERAPIA'`, `publico: 'Grupo'` e grade de janelas de 50 e 90 minutos devolve só a de 90.
  - Com `publico: 'Adulto'`, devolve só a de 50.
  - `bookAppointments` com `{ ...patient, serviceKey: 'PSICOTERAPIA', publico: 'Adulto' }` faz o `INSERT INTO clinica_agendamentos` com a coluna `publico_atendimento` e o parâmetro `'Adulto'`. Use `connection.execute.mock.calls`.
  - Com `publico` ausente, o parâmetro é `null`.

- [x] **Passo 2:** rodar `cd apps/web && npx vitest run src/server/scheduling/publicBooking.test.ts`. Esperado: FAIL nos novos casos.

- [x] **Passo 3: implementar**
  - O corpo do `filter` em `janelasCompativeisComPaciente` passa a ser `duracaoCompativelComPublico(serviceKey, janela.duracaoMin, publicoDoLink, 'link')`, com `publicoDoLink = publicoColetivo(paciente.triageMode) ? paciente.triageMode : paciente.publico`.
  - Sem `serviceKey`, a grade continua inteira.
  - No `INSERT`, acrescentar `publico_atendimento` com o valor `publicoDaSessao({ serviceKey: paciente.serviceKey, duracaoMin, publicoDoVinculo: paciente.publico }) ?? null`.

- [x] **Passo 4:** rodar o mesmo arquivo e também `src/server/scheduling/patientCpfAccess.test.ts`. Esperado: PASS nos dois, incluindo os casos antigos de Orientação Parental.

---

### Tarefa 3: Agenda manual valida duração pelo público e grava o público

**Arquivos:**
- Modificar: `packages/core/src/scheduling/types.ts` (`Appointment.audience?: string`)
- Modificar: `packages/core/src/scheduling/aggregate.ts` (`ScheduleAppointmentInput.audience?`, copiado em `scheduleAppointment`)
- Modificar: `apps/web/src/lib/manualAppointment.ts` (`durationOptions` em `PSICOTERAPIA`, `ORIENTACAO_VOCACIONAL` e `ORIENTACAO_PROFISSIONAL`)
- Criar: `apps/web/src/server/scheduling/publicoDoVinculo.ts`
- Modificar: `apps/web/src/server/application/appointmentService.ts` (`createAppointmentFlow`)
- Modificar: `apps/web/src/server/persistence/mysql/appointmentRepository.ts` (`upsertAppointment`)
- Modificar: `apps/web/src/components/scheduling/ManualAppointmentDialog.tsx` (filtro de pacientes, linha ~63)
- Testes:
  - `packages/core/src/scheduling/scheduling.test.ts`
  - `apps/web/src/lib/manualAppointment.test.ts`
  - `apps/web/src/server/application/appointmentCreationCharge.test.ts`
  - `apps/web/src/server/persistence/mysql/appointmentRepository.publico.test.ts` (novo)
  - `apps/web/src/components/scheduling/ManualAppointmentDialog.test.tsx`

**Interfaces**
- Consome: Tarefa 1.
- Produz: `publicoDoVinculo(organizationId: string, patientId: string): Promise<string | undefined>`. É o `para_quem_e` da triagem mais recente com `paciente_ref = patientId` na organização, com `ORDER BY atualizado_em DESC LIMIT 1`. Sem MySQL, lê `getCaptureRepository().read()` e usa o `paraQuemE` da triagem com `pacienteRef === patientId`.

- [x] **Passo 1: escrever os testes que falham**
  - Core: `scheduleAppointment(input({ serviceKey: 'PSICOTERAPIA', audience: 'Grupo' }), meta).appointment.audience === 'Grupo'`.
  - `manualAppointment.test.ts`:
    - `validServiceDuration('PSICOTERAPIA', 90) === true`;
    - `validServiceDuration('ORIENTACAO_VOCACIONAL', 90) === true`;
    - as opções de `PSICOTERAPIA` são `[{ minutes: 50, label: 'Individual · 50 min' }, { minutes: 90, label: 'Casal, família ou grupo · 1h30' }]`.
  - `appointmentCreationCharge.test.ts`, com `vi.mock('@/server/scheduling/publicoDoVinculo', ...)`:
    - Psicoterapia de 90 minutos com vínculo `'Adulto'` é rejeitada com `{ status: 400 }`. A mensagem contém `'Adulto'` e `'50 minutos'`.
    - Com vínculo `'Grupo'`, é aceita, e o agendamento salvo tem `audience: 'Grupo'`.
    - Orientação Parental de 90 minutos com vínculo `'Criança'` grava `audience: 'Família'`.
  - `appointmentRepository.publico.test.ts`:
    - `upsertAppointment` inclui `publico_atendimento` na lista do `INSERT` com o valor de `audience`;
    - o trecho `ON DUPLICATE KEY UPDATE` do SQL não contém `publico_atendimento`.
  - `ManualAppointmentDialog.test.tsx`: paciente com `status: 'paused'` não aparece no seletor, e paciente `active` aparece.

- [x] **Passo 2:** rodar os cinco arquivos. Esperado: FAIL nos casos novos.

- [x] **Passo 3: implementar**
  - Em `createAppointmentFlow`, depois de `validServiceDuration`:
    1. obter `const publico = await publicoDoVinculo(context.actor.organizationId, input.patientId)`. Vale também quando é a Gestão que agenda;
    2. se `!duracaoCompativelComPublico(serviceKey, durationMinutes, publico, 'manual')`, lançar `ApplicationError('INVALID_INPUT', \`Pelo público cadastrado (${publico}), este atendimento é de ${publicoColetivo(publico) ? '1h30' : '50 minutos'}.\`, 400)`;
    3. passar `audience: publicoDaSessao({ serviceKey, duracaoMin: durationMinutes, publicoDoVinculo: publico })` em `resolvedInput`.
  - Em `upsertAppointment`, `publico_atendimento` entra só nas colunas e nos valores do `INSERT`.
  - No diálogo, o filtro fica `patient.status !== 'discharged' && patient.status !== 'paused'`.

- [x] **Passo 4:** rodar os cinco arquivos, mais `src/lib/manualAppointment.test.ts`, `src/components/scheduling/ManualAppointmentDialog.test.tsx` e `src/server/application/agendaEdicaoConclusao.test.ts`. Esperado: PASS.

---

### Tarefa 4: Testes do crédito pelo valor do contrato

**Arquivos:**
- Teste: `apps/web/src/server/payments/companySessionCharge.test.ts` (novo)
- Teste: `apps/web/src/server/scheduling/agendaListagemConclusao.test.ts`
- Teste: `packages/core/src/financial/educationalCredits.test.ts`

**Interfaces**
- Consome (código existente): `registrarCobrancaContratual(connection, dados, valorCentavos)`, `precificarSessoesPendentes(connection, organizacao, convenio, centavos)`, `completeAppointment(...)` e `listEducationalCreditLines`.

- [x] **Passo 1: escrever os testes**
  - `registrarCobrancaContratual` com `10000`:
    - executa `INSERT INTO financeiro_cobrancas` com `valor_centavos` igual a `10000` e `emitida_em` igual a `confirmadaEm`;
    - atualiza `clinica_sessoes.cobranca_ref`.
  - Com `null`: executa só o `UPDATE ... valor_contrato_pendente = 1` e nenhum `INSERT`.
  - Com `0` ou `-1`: lança `'Valor contratual inválido.'`.
  - `precificarSessoesPendentes`, com duas linhas pendentes (`confirmada_em` de outubro): dois `INSERT` com a `emitida_em` de cada confirmação, e dois `UPDATE ... valor_contrato_pendente = 0`.
  - `completeAppointment` com agendamento custeado, `valor_sessao_contrato_centavos: 10000` e `valor_sessao_centavos: 12000`: o `INSERT` da cobrança empresarial usa `10000`.
  - Core: `listEducationalCreditLines` com cobrança empresarial de 10.000 centavos confirmada em 10/11/2026 devolve crédito de 7.000 na competência `2026-11`. Uma quitação em dezembro não acrescenta linha.

- [x] **Passo 2:** rodar os três arquivos.
  - Esperado: PASS, porque o código já existe.
  - Se algum teste falhar, aplicar superpowers:systematic-debugging, corrigir o defeito no código de produção e registrar a correção no resumo da tarefa.

---

### Tarefa 5: Trilha de alterações do atendimento (migration 090 e gravação na edição da Gestão)

**Arquivos:**
- Criar: `infra/mysql/090_agendamentos_alteracoes.sql`
- Criar: `apps/web/src/lib/alteracoesAgendamento.ts` (diferença pura)
- Criar: `apps/web/src/server/persistence/mysql/agendamentoAlteracoesRepository.ts`
- Modificar: `apps/web/src/server/scheduling/agendaRepository.ts` (`UpdateAppointmentOptions` e `updateAppointmentDetails`, incluindo `a.custeado_pela_empresa` no `SELECT ... FOR UPDATE`)
- Modificar: `apps/web/src/server/application/agendaService.ts` (`editAgendaAppointment` repassa a nova opção)
- Modificar: `apps/web/src/server/application/gestaoAgendaService.ts` (`editGestaoAppointment` e `updateGestaoChargeDue`)
- Modificar: `apps/web/src/server/scheduling/gestaoAgendaRepository.ts` (`vencimentoDoAgendamentoGestao`)
- Testes:
  - `apps/web/src/lib/alteracoesAgendamento.test.ts`
  - `apps/web/src/server/persistence/mysql/agendamentoAlteracoesRepository.test.ts`
  - `apps/web/src/server/scheduling/agendaEdicaoStatus.test.ts`
  - `apps/web/src/server/application/gestaoAgendaService.test.ts`

**Interfaces**
- Produz:
  - `interface EstadoAuditavel { inicio?: string; fim?: string; modalidade?: string; status?: string; custeadoPelaEmpresa?: boolean; venceEm?: string }`
  - `interface MudancaAgendamento { campo: 'horario' | 'formato' | 'situacao' | 'pagador' | 'vencimento'; rotulo: string; de: string; para: string }`
  - `diferencasDoAgendamento(antes: EstadoAuditavel, depois: EstadoAuditavel): MudancaAgendamento[]`, que só compara as chaves presentes em `depois`.
  - `interface AlteracaoAgendamento { id: string; agendamentoId: string; profissionalRef: string; alteradoPorNome?: string; alteradoEm: string; mudancas: MudancaAgendamento[] }`
  - `interface AlteracaoAgendamentoComPaciente extends AlteracaoAgendamento { pacienteNome: string; inicio: string }`
  - `registrarAlteracaoAgendamento(executor: { execute: PoolConnection['execute'] }, linha: { organizacaoRef: string; agendamentoId: string; profissionalRef: string; usuarioRef: string; nome?: string; alteradoEm: Date; mudancas: MudancaAgendamento[] }): Promise<void>`
  - `alteracoesDoAgendamento(organizationId: string, agendamentoId: string): Promise<AlteracaoAgendamento[]>`
  - `alteracoesRecentesDoProfissional(organizationId: string, profissionalRef: string, desde: Date): Promise<AlteracaoAgendamentoComPaciente[]>`, que junta `clinica_pacientes` para trazer `pacienteNome` (nome social primeiro) e `inicio`.
  - `tabelaDeAlteracoesAusente(error: unknown): boolean`, verdadeiro para `code === 'ER_NO_SUCH_TABLE'`.
  - `vencimentoDoAgendamentoGestao(organizationId: string, id: string): Promise<{ agendamentoId: string; profissionalRef: string; venceEm?: string } | null>`, que lê `clinica_agendamentos.cobranca_vence_em`.
  - `UpdateAppointmentOptions.registrarAlteracaoGestao?: { usuarioRef: string; nome?: string }`
- Consome: `nomeDoUsuario(userId)` de `server/application/autorGestao.ts` e `dataHoraSessao` de `lib/sessionReference.ts`.

**Rótulos e valores exatos**
- Rótulos dos campos: `Data e horário`, `Formato`, `Situação`, `Responsável pelo pagamento`, `Vencimento da cobrança`.
- Formato: `online` → `On-line`, `presencial` → `Presencial`, `telefone` → `Telefone`.
- Situação: `agendado` → `Agendado`, `confirmado` → `Confirmado`, `realizado` → `Realizado`, `cancelado` → `Cancelado`.
- Pagador: `true` → `Empresa (convênio)`, `false` → `Paciente`.
- Horário: `${dataHoraSessao(inicio)} – ${HH:mm do fim no fuso da clínica}`.

- [x] **Passo 1: escrever os testes que falham**
  - Diferença:
    - mudança só de formato gera um único item, `{ campo: 'formato', rotulo: 'Formato', de: 'On-line', para: 'Presencial' }`;
    - o mesmo início e término gera `[]`;
    - mudança de horário gera o item `horario` com os dois textos formatados.
  - Migration: o arquivo contém `CREATE TABLE IF NOT EXISTS clinica_agendamentos_alteracoes`, a chave única `(instituicao_id, agendamento_id, alterado_em)` e o índice `(instituicao_id, organizacao_ref, profissional_ref, alterado_em)`. Seguir o padrão de `captureRepository.recusasMigration.test.ts`.
  - Repositório: `registrarAlteracaoAgendamento` executa `INSERT` com `JSON.stringify(mudancas)`, e `tabelaDeAlteracoesAusente({ code: 'ER_NO_SUCH_TABLE' })` devolve `true`.
  - `agendaEdicaoStatus.test.ts`:
    - com `registrarAlteracaoGestao`, uma edição de `presencial` para `online` executa o `INSERT INTO clinica_agendamentos_alteracoes` antes do `commit`;
    - a mesma edição sem a opção não executa esse `INSERT`;
    - se o `INSERT` rejeitar com `{ code: 'ER_NO_SUCH_TABLE' }`, a edição chega ao `commit`;
    - se rejeitar com `new Error('falha')`, chama `rollback` e propaga o erro;
    - edição que reenvia os mesmos valores não executa o `INSERT`.
  - `gestaoAgendaService.test.ts`:
    - `editGestaoAppointment` repassa `{ registrarAlteracaoGestao: { usuarioRef: 'admin-1', nome: <mock de nomeDoUsuario> } }`;
    - `updateGestaoChargeDue`, com sucesso, grava uma linha `vencimento` com o `de` vindo de `vencimentoDoAgendamentoGestao`;
    - quando `updateAgendaAppointmentChargeDue` rejeita, nenhuma linha é gravada.

- [x] **Passo 2:** rodar os quatro arquivos. Esperado: FAIL.

- [x] **Passo 3: implementar**
  - A tabela segue o spec, seção 3.
  - Em `updateAppointmentDetails`, logo antes do `commit`:
    - `depois` contém só os campos presentes em `input`;
    - o `inicio`/`fim` novos são os já calculados (`novoInicio` e `novoFim`);
    - se `mudancas.length > 0`, chamar `registrarAlteracaoAgendamento(connection, …)` com `profissionalRef = professionalId`, `organizacaoRef = organizationId` e `alteradoEm = agora`;
    - capturar só `tabelaDeAlteracoesAusente`, com `console.warn('[agenda] Trilha de alterações indisponível: aplique a migration 090.')`.
  - Em `updateGestaoChargeDue`, a gravação é feita depois do sucesso, com `getMysqlPool()` como executor e falha só no log.

- [x] **Passo 4:** rodar os quatro arquivos e também `src/server/application/agendaEdicaoConclusao.test.ts` e `src/server/scheduling/agendaReagendamento.test.ts`. Esperado: PASS.

---

### Tarefa 6: Histórico do atendimento para a Gestão

**Arquivos:**
- Criar: `apps/web/src/app/api/application/gestao/agenda/[id]/alteracoes/route.ts` (`GET`)
- Modificar: `apps/web/src/server/application/gestaoAgendaService.ts` (`historicoGestaoAppointment`)
- Criar: `apps/web/src/components/scheduling/HistoricoAlteracoesSessao.tsx`
- Modificar: `apps/web/src/components/scheduling/EditSessionModal.tsx` (renderiza o histórico quando a prop `admin` está presente; o arquivo continua com menos de 250 linhas)
- Testes:
  - `apps/web/src/app/api/application/gestao/agenda/[id]/alteracoes/route.test.ts`
  - `apps/web/src/server/application/gestaoAgendaService.test.ts`
  - `apps/web/src/components/scheduling/HistoricoAlteracoesSessao.test.tsx`

**Interfaces**
- Consome: `alteracoesDoAgendamento` (Tarefa 5) e `profissionalDoAgendamentoGestao`, já existente.
- Produz: `historicoGestaoAppointment(context: RequestContext, id: string): Promise<{ alteracoes: AlteracaoAgendamento[] }>`.

- [x] **Passo 1: escrever os testes que falham**
  - O serviço nega `professional` e `billing` com 403.
  - Agendamento fora da organização, com `profissionalDoAgendamentoGestao` devolvendo `null`, recebe 404.
  - O caso de sucesso devolve as linhas do repositório.
  - A rota responde com `success(...)` e devolve `failure` para `ApplicationError`.
  - O componente:
    - com duas alterações, mostra autor, data e "Formato: On-line → Presencial";
    - com lista vazia, mostra "Nenhuma alteração registrada pela Gestão.".

- [x] **Passo 2:** rodar os três arquivos. Esperado: FAIL.

- [x] **Passo 3: implementar**
  - O componente busca `/gestao/agenda/${id}/alteracoes` via `applicationRequest`, como em `app/gestao/agenda/page.tsx`.

- [x] **Passo 4:** rodar os três arquivos e também `src/components/scheduling/EditSessionModal*.test.tsx`, se existirem. Esperado: PASS.

---

### Tarefa 7: Aviso ao psicólogo no sino

**Arquivos:**
- Criar: `apps/web/src/server/application/notificacoesCorrecaoAgenda.ts`
- Modificar: `apps/web/src/server/application/notificacoesDaSessao.ts` (só o ramo do psicólogo)
- Teste: `apps/web/src/server/application/notificacoesCorrecaoAgenda.test.ts`

**Interfaces**
- Consome: `alteracoesRecentesDoProfissional` (Tarefa 5), `comFoco` e `focoSessao` de `lib/focoNotificacao.ts`, e `dataHoraSessao`.
- Produz: `notificacoesDeCorrecaoDaGestao(alteracoes: readonly AlteracaoAgendamentoComPaciente[]): NotificacaoDerivada[]`.

**Texto exato de cada item**
- `chave`: `agenda-corrigida:${agendamentoId}:${alteradoEm}`
- `tipo`: `agenda-corrigida`
- `titulo`: `Atendimento alterado pela Gestão`
- `descricao`: `${pacienteNome} — ${dataHoraSessao(inicio)}: ${mudancas.map((m) => `${m.rotulo}: ${m.de} → ${m.para}`).join('; ')}.`
- `ocorridoEm`: `alteradoEm`
- `severidade`: `ATENCAO`
- `href`: `comFoco('/agenda', focoSessao(agendamentoId))`
- `pendente`: `false`

- [x] **Passo 1: escrever os testes que falham**
  - Uma alteração com duas mudanças gera um item com o texto acima. As duas mudanças vêm separadas por `; `.
  - Duas alterações do mesmo atendimento em horários diferentes geram duas chaves distintas.
  - A lista vazia gera `[]`.
  - No ramo do psicólogo, `alteracoesRecentesDoProfissional` é chamado com o `professionalId` da sessão. Testar uma função auxiliar exportada, `correcoesDaGestao(organizationId, userId)`, com mocks.
  - Sem MySQL, a lista é `[]`.
  - Falha na consulta devolve `[]` sem derrubar os demais avisos.

- [x] **Passo 2:** rodar o arquivo. Esperado: FAIL.

- [x] **Passo 3: implementar**
  - Em `notificacoesDaSessao.ts`, acrescentar `...(await correcoesDaGestao(session.organizationId, session.userId))` ao retorno do psicólogo.
  - `correcoesDaGestao` segue o mesmo padrão de `agendamentosDoPsicologo`: MySQL obrigatório, `profissionalDaSessao`, janela `inicioDaJanela()` e `console.error` sem dados pessoais.

- [x] **Passo 4:** rodar o arquivo e também `src/server/application/notificacoesDestino.test.ts`. Esperado: PASS.

---

### Tarefa 8: Relatório e verificação completa

**Arquivos:**
- Modificar: `output/comparacao-fluxos-viver-mais-2026-11-23.md`, só nas linhas dos itens de público na sessão (≈136), correção administrativa (≈137) e valor contratual (≈142). As linhas 127–132 são da sessão 63.

- [x] **Passo 1:** rodar `npm run check` na raiz.
  - Esperado: `lint` com 0 erros, `typecheck` com 0 erros, todas as suítes e `web:build` passando.
  - Falha em arquivo da sessão 63 deve ser registrada como alheia, com o nome do teste, sem correção.

- [x] **Passo 2: atualizar o relatório**
  - Os três itens vão da seção 3 para a seção 2, "Na cópia local, ainda sem commit", com links para os testes.
  - A correção de valor e pagador continua na seção 3.
  - Antes de salvar, reler o arquivo para não sobrescrever a edição da sessão 63.

- [x] **Passo 3:** `git diff --check` e conferência dos links novos do relatório.

- [x] **Passo 4:** informar ao usuário:
  - o resultado do `check`, com números;
  - a lista de arquivos alterados;
  - que a migration 090 aguarda autorização para ser aplicada na VPS;
  - que nada foi commitado.

## Verificação final em 24/11/2026

O comando `npm run check` passou com 230 testes do domínio e 1.889 da aplicação. O lint registrou 43 avisos e zero erros. Tipos e build passaram. O Turbopack emitiu um aviso de rastreamento de arquivos. Os dez links dos três itens do relatório foram conferidos. O histórico do repositório já continha o Bloco A em `ab3e4ea`. O ajuste da edição com conclusão permanece na cópia local. A aplicação da migration 090 na VPS aguarda autorização.
