# Vitrine, públicos e regras das pós-graduações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a vitrine, a triagem, o rodízio, a escolha direta e a agenda respeitarem a mesma tabela de serviços, públicos e durações das pós-graduações.

**Architecture:** Uma regra pura no pacote core converte os rótulos amigáveis da vitrine nos públicos declarados pelos profissionais e passa a ser usada pelo motor de matching. Uma regra pura da aplicação web limita as opções de público por serviço/modalidade; a página da vitrine e a validação de triagem consomem essa mesma regra, eliminando divergência entre interface e servidor.

**Tech Stack:** TypeScript 5.7, React 19, Next.js 16 App Router, Vitest 4, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-23-vitrine-publicos-pos-design.md`

## Global Constraints

- Preservar os rótulos públicos `Individual`, `Infantil`, `Adolescente`, `Casal`, `Família` e `Outro`.
- `Individual` corresponde a `Homens`, `Mulheres` ou `Idoso`; `Infantil` corresponde a `Criança`.
- Perinatal e Parentalidade permanece no grupo amplo.
- Avaliação Psicológica e Neuropsicologia permitem somente Avaliação Psicológica, 50/90 minutos e os cinco públicos definidos na especificação.
- Duração manual de avaliação fica restrita ao ambiente interno do psicólogo, entre 15 e 240 minutos, em passos de 5.
- Preservar registros legados; nenhuma migração ou reescrita destrutiva de dados.
- Manter componentes abaixo de 250 linhas quando novos componentes forem criados.
- O deploy Vercel continua pela raiz do monorepo; não adicionar rewrite global de `/:path*`.
- Não incluir no commit mudanças locais não relacionadas.

## Review Focus

- Solicitação `Individual` não pode alcançar perfil exclusivo de Casais, Família, Criança, Adolescente ou Grupo — coberto nas tarefas 1 e 5.
- Solicitação `Infantil` deve aceitar `Criança` mesmo com singular/plural e acentos legados — coberto nas tarefas 1 e 5.
- Trocar serviço ou modalidade depois de escolher um público deve limpar ou ajustar uma escolha incompatível — coberto nas tarefas 2 e 3.
- Escolha direta e recomendação automática devem produzir a mesma elegibilidade — coberto na tarefa 5.
- Requisição adulterada com serviço/público incompatível deve falhar antes de persistir ou enviar WhatsApp — coberto na tarefa 4.

---

### Task 1: Centralizar a compatibilidade de públicos no core

**Files:**
- Create: `packages/core/src/viverMaisAudience.ts`
- Create: `packages/core/src/viverMaisAudience.test.ts`
- Modify: `packages/core/src/viverMaisMatchingEngine.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/viverMaisCore.test.ts`

**Interfaces:**
- Produces: `PublicoVitrine`, `normalizarPublicoAlvo(valor: string): string`, `publicosCompativeisComSolicitacao(valor: string): readonly string[]` e `publicoAlvoCompativel(publicos: readonly string[] | undefined, solicitado: string | undefined): boolean`.
- Consumes: `psicologoCompativel(...)` mantém a assinatura atual e delega a decisão de público a `publicoAlvoCompativel`.

- [ ] **Step 1: Escrever os testes de mapeamento que falham**

Cobrir em `viverMaisAudience.test.ts`:

```ts
expect(publicosCompativeisComSolicitacao('Individual')).toEqual(['homem', 'mulher', 'idoso']);
expect(publicosCompativeisComSolicitacao('Infantil')).toEqual(['crianca']);
expect(publicosCompativeisComSolicitacao('Casal')).toEqual(['casal']);
expect(publicosCompativeisComSolicitacao('Outro: gestante')).toEqual(['outro']);
expect(publicoAlvoCompativel(['Homens'], 'Individual')).toBe(true);
expect(publicoAlvoCompativel(['Criança'], 'Infantil')).toBe(true);
expect(publicoAlvoCompativel(['Casais'], 'Individual')).toBe(false);
```

Fixar também o comportamento legado: sem público solicitado não filtra; perfil antigo sem `publicoAlvo` continua elegível até ser recadastrado.

- [ ] **Step 2: Rodar os testes e confirmar a falha**

Run: `npm run test --workspace @thats-life/core -- src/viverMaisAudience.test.ts`

Expected: FAIL porque o módulo e as funções ainda não existem.

- [ ] **Step 3: Implementar a regra pura e exportá-la**

Criar as quatro interfaces acima. Normalizar acentos, caixa, singular/plural e os aliases aprovados; tratar `Outro: texto livre` como `outro`. Remover a implementação duplicada de `normalizarPublicoAlvo` do motor e importar a nova função.

- [ ] **Step 4: Fazer o motor usar a interseção de públicos**

Substituir o bloco de comparação por substring em `psicologoCompativel` por `publicoAlvoCompativel`. Não alterar os demais critérios nem a regra existente de perfil legado sem serviços declarados.

- [ ] **Step 5: Rodar core completo**

Run: `npm run check --workspace @thats-life/core && npm run test --workspace @thats-life/core`

Expected: typecheck e todos os testes do core passam.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/viverMaisAudience.ts packages/core/src/viverMaisAudience.test.ts packages/core/src/viverMaisMatchingEngine.ts packages/core/src/viverMaisCore.test.ts packages/core/src/index.ts
git commit -m "fix(core): unifica compatibilidade de públicos"
```

### Task 2: Definir as opções públicas permitidas por serviço

**Files:**
- Create: `apps/web/src/lib/vitrinePublico.ts`
- Create: `apps/web/src/lib/vitrinePublico.test.ts`

**Interfaces:**
- Consumes: `PublicoVitrine` exportado pela tarefa 1.
- Produces: `ServicoVitrineKey`, `ModalidadeVitrineKey`, `opcoesPublicoVitrine(servicoKey: ServicoVitrineKey, modalidade: ModalidadeVitrineKey): readonly PublicoVitrine[]`, `publicoVitrinePermitido(servicoKey: string | undefined, modalidade: string | undefined, publico: string | undefined): boolean` e `ajustarPublicoVitrineAtual(servicoKey: ServicoVitrineKey, modalidade: ModalidadeVitrineKey, atual: string): string`.

- [ ] **Step 1: Escrever a matriz de testes que falha**

```ts
expect(opcoesPublicoVitrine('AVALIACAO', 'SOCIAL')).toEqual(['Individual', 'Infantil', 'Adolescente']);
expect(opcoesPublicoVitrine('PSICOTERAPIA_CASAL', 'CASAL_PARTICULAR')).toEqual(['Casal']);
expect(opcoesPublicoVitrine('ORIENTACAO_PARENTAL', 'FAMILIA_SOCIAL')).toEqual(['Família']);
expect(opcoesPublicoVitrine('ORIENTACAO_PARENTAL', 'PARTICULAR')).toEqual(['Individual']);
expect(opcoesPublicoVitrine('PSICOTERAPIA', 'SOCIAL')).toEqual(['Individual', 'Infantil', 'Adolescente', 'Outro']);
```

Adicionar casos de troca de serviço: manter a escolha quando ainda é válida; selecionar automaticamente a única opção; limpar quando a nova matriz tem várias opções e a escolha anterior ficou inválida.

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/lib/vitrinePublico.test.ts`

Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Implementar a matriz pura**

Declarar os tipos e funções acima sem dependência de React. `Outro: texto` deve ser aceito somente quando `Outro` pertence à matriz do serviço.

- [ ] **Step 4: Rodar o teste direcionado**

Run: `npm run test --workspace @thats-life/web -- src/lib/vitrinePublico.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/vitrinePublico.ts apps/web/src/lib/vitrinePublico.test.ts
git commit -m "feat(vitrine): define públicos por serviço"
```

### Task 3: Aplicar a mesma escolha de público aos dois caminhos da vitrine

**Files:**
- Create: `apps/web/src/components/vitrine/PublicoAtendimentoField.tsx`
- Create: `apps/web/src/components/vitrine/PublicoAtendimentoField.test.tsx`
- Modify: `apps/web/src/app/vitrine/page.tsx`

**Interfaces:**
- Consumes: `opcoesPublicoVitrine` e `ajustarPublicoVitrineAtual` da tarefa 2.
- Produces: `PublicoAtendimentoField`, com props `opcoes`, `value`, `outroValue`, `onChange` e `onOutroChange`.

- [ ] **Step 1: Escrever os testes de apresentação que falham**

Testar que o componente:

- renderiza somente Individual, Infantil e Adolescente para avaliação;
- não mostra `Outro` quando a matriz não permite;
- mostra o campo de especificação apenas quando `Outro` está selecionado;
- não apresenta qualquer controle de duração.

Run: `npm run test --workspace @thats-life/web -- src/components/vitrine/PublicoAtendimentoField.test.tsx`

Expected: FAIL porque o componente não existe.

- [ ] **Step 2: Criar o componente de seleção de público**

Manter os rótulos atuais e a aparência dos botões existentes. O componente não conhece pós-graduações, profissionais nem regras de matching; recebe apenas a lista autorizada.

- [ ] **Step 3: Integrar a seleção no caminho de recomendação**

Substituir a lista literal de seis opções em `MATCH` pelo componente. Manter a numeração das quatro perguntas e a validação de `Outro`.

- [ ] **Step 4: Integrar a seleção antes da escolha direta**

Na etapa `PROFISSIONAIS`, exibir o mesmo componente antes dos turnos. Só calcular e renderizar `profissionaisCompativeis` quando público e turno estiverem preenchidos. Assim o catálogo e o rodízio recebem os mesmos critérios.

- [ ] **Step 5: Ajustar troca de serviço e submissão**

Usar `ajustarPublicoVitrineAtual` em `handleSelectServiceAndPrice`; remover listas literais divergentes como `['Criança', 'Adolescente', ...]`. Antes do POST, impedir avanço se o público atual não pertence à matriz do serviço/modalidade.

- [ ] **Step 6: Rodar testes e typecheck web**

Run: `npm run test --workspace @thats-life/web -- src/components/vitrine/PublicoAtendimentoField.test.tsx src/lib/vitrinePublico.test.ts src/app/api/application/credenciamento-psicologo/public/route.test.ts`

Run: `npm run typecheck --workspace @thats-life/web`

Expected: testes e typecheck passam.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/vitrine/PublicoAtendimentoField.tsx apps/web/src/components/vitrine/PublicoAtendimentoField.test.tsx apps/web/src/app/vitrine/page.tsx
git commit -m "fix(vitrine): aplica público nos dois caminhos"
```

### Task 4: Validar serviço e público na fronteira da triagem

**Files:**
- Modify: `apps/web/src/lib/triagemSubmissao.ts`
- Modify: `apps/web/src/lib/triagemSubmissao.test.ts`
- Modify: `apps/web/src/app/api/application/triagem/route.ts`
- Modify: `apps/web/src/app/api/application/triagem/route.test.ts`
- Test: `apps/web/src/server/application/patientDirectory.test.ts`

**Interfaces:**
- Consumes: `publicoVitrinePermitido` da tarefa 2.
- Produces: `validarSubmissaoTriagem(corpo: unknown, opcoes?: { exigirCompatibilidadeVitrine?: boolean }): ResultadoValidacao`; a rota pública passa `{ exigirCompatibilidadeVitrine: true }`, enquanto o cadastro interno de paciente preserva o comportamento atual ao omitir a opção.

- [ ] **Step 1: Escrever os testes de rejeição que falham**

Adicionar uma base válida com `paraQuemE: 'Individual'` e cobrir a validação estrita:

```ts
const estrita = { exigirCompatibilidadeVitrine: true };
expect(validarSubmissaoTriagem({ ...valido, servicoKey: 'AVALIACAO', paraQuemE: 'Casal' }, estrita).ok).toBe(false);
expect(validarSubmissaoTriagem({ ...valido, servicoKey: 'AVALIACAO', paraQuemE: 'Infantil' }, estrita).ok).toBe(true);
expect(validarSubmissaoTriagem({ ...valido, servicoKey: 'PSICOTERAPIA_CASAL', modalidade: 'CASAL_SOCIAL', paraQuemE: 'Casal' }, estrita).ok).toBe(true);
expect(validarSubmissaoTriagem({ ...valido, paraQuemE: '' }, estrita).ok).toBe(false);
expect(validarSubmissaoTriagem({ ...valido, servicoKey: 'DESCONHECIDO' }, estrita).ok).toBe(false);
```

Adicionar um caso de `Outro: descrição` permitido em psicoterapia e recusado em avaliação. Adicionar também um teste sem a opção estrita para provar que o cadastro interno existente continua aceito sem `paraQuemE`.

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/lib/triagemSubmissao.test.ts`

Expected: os novos casos incompatíveis ainda são aceitos.

- [ ] **Step 3: Implementar a validação autoritativa**

Quando `exigirCompatibilidadeVitrine` for verdadeiro, após sanear `servicoKey`, `modalidade` e `paraQuemE`, exigir que os três existam e chamar `publicoVitrinePermitido`. A rota `/api/application/triagem` ativa a opção antes da consulta ao WhatsApp; `createPatient` continua usando o modo compatível com o cadastro interno atual.

- [ ] **Step 4: Rodar os testes de validação e rota**

Run: `npm run test --workspace @thats-life/web -- src/lib/triagemSubmissao.test.ts src/app/api/application/triagem/route.test.ts src/server/application/patientDirectory.test.ts`

Expected: PASS, sem chamadas externas nos casos recusados.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/triagemSubmissao.ts apps/web/src/lib/triagemSubmissao.test.ts apps/web/src/app/api/application/triagem/route.ts apps/web/src/app/api/application/triagem/route.test.ts
git commit -m "fix(triagem): valida combinação de serviço e público"
```

### Task 5: Provar paridade e a tabela completa das pós

**Files:**
- Modify: `apps/web/src/app/api/application/credenciamento-psicologo/public/route.test.ts`
- Modify: `apps/web/src/components/forms/opcoesPsicologo.test.ts`
- Test: `apps/web/src/components/scheduling/ManualAppointmentDialog.test.tsx`
- Test: `apps/web/src/components/scheduling/SessionDurationField.test.tsx`

**Interfaces:**
- Consumes: regras implementadas nas tarefas 1–4.
- Produces: cobertura de regressão ponta a ponta entre cadastro, vitrine, rodízio e agenda interna.

- [ ] **Step 1: Expandir o teste de paridade da escolha direta e rodízio**

Adicionar à matriz existente casos em que `profissionalCompativelNaVitrine(...)` e `alocarLeadEscolhido(...)` devem devolver o mesmo booleano:

- Individual × Homens, Mulheres e Idoso: `true`;
- Infantil × Criança: `true`;
- Individual × Casais, Família, Criança, Adolescente e Grupo: `false`;
- Casal × Casais: `true`;
- Avaliação × profissional com serviço `AVALIACAO` e público compatível: `true`;
- serviço ou público incompatível: `false`.

- [ ] **Step 2: Tornar a tabela das pós exaustiva**

Em `opcoesPsicologo.test.ts`, testar todos os cursos da especificação, inclusive segunda pós e precedência do grupo amplo. As duas pós de avaliação devem retornar exatamente `{ tempos: [50, 90], servicos: ['Avaliação Psicológica'], publico: ['Adolescente', 'Criança', 'Idoso', 'Homens', 'Mulheres'] }`.

- [ ] **Step 3: Fixar a separação de duração paciente/profissional**

Manter os testes de agenda interna para 50min, 1h30min e duração manual. No teste do componente público da tarefa 3, confirmar que nenhum input ou opção de duração é renderizado para o paciente.

- [ ] **Step 4: Rodar verificações direcionadas**

Run: `npm run test --workspace @thats-life/core -- src/viverMaisAudience.test.ts src/viverMaisCore.test.ts`

Run: `npm run test --workspace @thats-life/web -- src/lib/vitrinePublico.test.ts src/lib/triagemSubmissao.test.ts src/components/vitrine/PublicoAtendimentoField.test.tsx src/app/api/application/credenciamento-psicologo/public/route.test.ts src/components/forms/opcoesPsicologo.test.ts src/components/scheduling/ManualAppointmentDialog.test.tsx src/components/scheduling/SessionDurationField.test.tsx`

Expected: todos passam.

- [ ] **Step 5: Rodar a regressão completa**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run lint`

Run: `npm run web:build`

Expected: typecheck, suítes core/web e build passam; lint sem novos erros.

- [ ] **Step 6: Conferir invariantes de deploy e alterações**

Run: `git diff --check`

Run: `git diff -- vercel.json apps/web/vercel.json apps/web/next.config.mjs`

Expected: nenhum whitespace inválido e nenhuma alteração nas regras de roteamento/deploy.

- [ ] **Step 7: Commit de cobertura final**

```bash
git add apps/web/src/app/api/application/credenciamento-psicologo/public/route.test.ts apps/web/src/components/forms/opcoesPsicologo.test.ts
git commit -m "test(vitrine): cobre regras das pós e públicos"
```

### Task 6: Validar o fluxo publicado sem criar uma triagem real

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: build e commits das tarefas anteriores.
- Produces: evidência operacional de que a vitrine publicada oferece as opções corretas e não expõe duração manual ao paciente.

- [ ] **Step 1: Enviar a série de commits para `main`**

Run: `git push origin main`

Expected: push aceito sem incluir mudanças locais não relacionadas.

- [ ] **Step 2: Aguardar o deploy de produção**

Run: `npx vercel ls clinica-viver-web`

Run: `npx vercel inspect <deployment-url> --wait --timeout 3m`

Expected: deploy do commit final com status `Ready` e aliases de produção.

- [ ] **Step 3: Conferir a vitrine em modo somente leitura**

Na produção, percorrer sem enviar o formulário:

- Avaliação mostra somente Individual, Infantil e Adolescente;
- Casal mostra somente Casal;
- Orientação Parental individual/família seleciona o público coerente;
- escolha direta exige público e turno antes de listar profissionais;
- recomendação usa os mesmos rótulos;
- nenhuma etapa pública oferece duração manual.

- [ ] **Step 4: Registrar o resultado**

Relatar commit final, URL do deploy, verificações executadas e qualquer aviso preexistente que não pertença ao escopo.

## Pendências conhecidas

Consolidação dos itens desmarcados e das pendências explícitas deste registro histórico. O estado abaixo reproduz o plano; não constitui uma nova auditoria do código ou da produção. Consulte as etapas originais para detalhes e confirme o estado atual antes de retomar o trabalho.

### Task 1: Centralizar a compatibilidade de públicos no core

- [ ] **Step 1: Escrever os testes de mapeamento que falham**
- [ ] **Step 2: Rodar os testes e confirmar a falha**
- [ ] **Step 3: Implementar a regra pura e exportá-la**
- [ ] **Step 4: Fazer o motor usar a interseção de públicos**
- [ ] **Step 5: Rodar core completo**
- [ ] **Step 6: Commit**

### Task 2: Definir as opções públicas permitidas por serviço

- [ ] **Step 1: Escrever a matriz de testes que falha**
- [ ] **Step 2: Rodar o teste e confirmar a falha**
- [ ] **Step 3: Implementar a matriz pura**
- [ ] **Step 4: Rodar o teste direcionado**
- [ ] **Step 5: Commit**

### Task 3: Aplicar a mesma escolha de público aos dois caminhos da vitrine

- [ ] **Step 1: Escrever os testes de apresentação que falham**
- [ ] **Step 2: Criar o componente de seleção de público**
- [ ] **Step 3: Integrar a seleção no caminho de recomendação**
- [ ] **Step 4: Integrar a seleção antes da escolha direta**
- [ ] **Step 5: Ajustar troca de serviço e submissão**
- [ ] **Step 6: Rodar testes e typecheck web**
- [ ] **Step 7: Commit**

### Task 4: Validar serviço e público na fronteira da triagem

- [ ] **Step 1: Escrever os testes de rejeição que falham**
- [ ] **Step 2: Rodar o teste e confirmar a falha**
- [ ] **Step 3: Implementar a validação autoritativa**
- [ ] **Step 4: Rodar os testes de validação e rota**
- [ ] **Step 5: Commit**

### Task 5: Provar paridade e a tabela completa das pós

- [ ] **Step 1: Expandir o teste de paridade da escolha direta e rodízio**
- [ ] **Step 2: Tornar a tabela das pós exaustiva**
- [ ] **Step 3: Fixar a separação de duração paciente/profissional**
- [ ] **Step 4: Rodar verificações direcionadas**
- [ ] **Step 5: Rodar a regressão completa**
- [ ] **Step 6: Conferir invariantes de deploy e alterações**
- [ ] **Step 7: Commit de cobertura final**

### Task 6: Validar o fluxo publicado sem criar uma triagem real

- [ ] **Step 1: Enviar a série de commits para `main`**
- [ ] **Step 2: Aguardar o deploy de produção**
- [ ] **Step 3: Conferir a vitrine em modo somente leitura**
- [ ] **Step 4: Registrar o resultado**
