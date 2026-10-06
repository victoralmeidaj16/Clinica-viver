# Turmas por pós-graduação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Administrar e encerrar cada turma pela combinação de pós-graduação e código, com uma lista agrupada que mostre somente combinações com psicólogos aprovados.

**Architecture:** Uma identidade de turma compartilhada gera uma chave composta inequívoca para UI, API e persistência. A migração MySQL e o adaptador local convertem os encerramentos antigos por código em encerramentos por combinação; o roster continua derivando a indisponibilidade sem alterar pausas manuais. O painel monta um modelo de apresentação puro e renderiza grupos por pós-graduação com uma linha responsiva para cada código.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Tailwind CSS 3, Vitest 4, MySQL 9.2, `mysql2`.

**Spec:** `docs/superpowers/specs/2026-10-06-turmas-por-pos-graduacao-design.md`

## Global Constraints

- A identidade da turma é exclusivamente `posGraduacaoViverMais + turmaViverMais`; `segundaPosGraduacao` nunca participa.
- Somente cadastros com `status === 'APROVADO'` e ambos os campos acadêmicos preenchidos formam combinações acionáveis.
- Encerrar ou reabrir uma combinação não pode afetar outra pós-graduação com o mesmo código.
- Encerramentos continuam derivados na leitura; nunca gravar `turmaEncerrada` no cadastro do psicólogo.
- Pausas manuais e ausências de agenda permanecem independentes do encerramento acadêmico.
- Não adicionar dependências de produção nem alterar o catálogo institucional ou os códigos permitidos.
- Manter componentes abaixo de 250 linhas e preservar o deploy do monorepo pela raiz, sem rewrite global.

## Review Focus

- Dois cursos com `25A`: encerrar um deve deixar o outro em curso e elegível no rodízio; coberto nas Tasks 2 e 3.
- Espaços ou código em minúsculas vindos de dados legados: a identidade deve aparar campos e normalizar o código; coberto na Task 1.
- Curso legado fora do catálogo: deve aparecer para correção, mas a API deve recusar novo encerramento; coberto nas Tasks 4 e 5.
- Encerramento antigo sem combinação aprovada correspondente: deve desaparecer sem virar curinga para cursos futuros; coberto na Task 2.
- Falha/ausência da migração 052: leitura do roster degrada sem derrubar a equipe e escrita responde 503 com instrução correta; coberto nas Tasks 2 e 4.

---

### Task 1: Identidade composta compartilhada

**Files:**
- Create: `apps/web/src/lib/turmaEncerrada.test.ts`
- Modify: `apps/web/src/lib/turmaEncerrada.ts:1-39`
- Modify: `apps/web/src/server/application/turmaEncerradaRodizio.test.ts:1-45`

**Interfaces:**
- Produces: `IdentidadeTurma { turma: string; posGraduacao: string }`.
- Produces: `TurmaEncerrada extends IdentidadeTurma { encerradaEm: string }`.
- Produces: `normalizarIdentidadeTurma(identidade: IdentidadeTurma): IdentidadeTurma`.
- Produces: `chaveTurma(identidade: IdentidadeTurma): string`, usando serialização JSON dos dois campos normalizados.
- Preserves: `desligadoPorTurma`, `formatarDataCurta`, `hojeEmBrasilia` e `TURMAS_ATIVAS`.

- [ ] **Step 1: Escrever os testes falhos da identidade**

Adicionar testes com estas asserções:

```ts
expect(normalizarIdentidadeTurma({ turma: ' 25a ', posGraduacao: ' Psicodrama ' }))
  .toEqual({ turma: '25A', posGraduacao: 'Psicodrama' });
expect(chaveTurma({ turma: '25A', posGraduacao: 'Psicodrama' }))
  .not.toBe(chaveTurma({ turma: '25A', posGraduacao: 'Psicanálise' }));
```

Atualizar o fixture de `turmaEncerradaRodizio.test.ts` para conter
`posGraduacao: 'Formação e Pós-graduação em Psicodrama'` e manter as asserções
de pausa derivada e preservação da pausa manual.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/lib/turmaEncerrada.test.ts src/server/application/turmaEncerradaRodizio.test.ts`

Expected: FAIL porque `IdentidadeTurma`, `normalizarIdentidadeTurma` e `chaveTurma` ainda não existem e o fixture não satisfaz o novo contrato.

- [ ] **Step 3: Implementar os tipos e helpers no módulo compartilhado**

Implementar exatamente as interfaces e assinaturas descritas acima. A chave
deve usar `JSON.stringify([normalizada.posGraduacao, normalizada.turma])`, nunca
concatenação com um separador visual.

- [ ] **Step 4: Executar os testes direcionados**

Run: `npm run test --workspace @thats-life/web -- src/lib/turmaEncerrada.test.ts src/server/application/turmaEncerradaRodizio.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/turmaEncerrada.ts apps/web/src/lib/turmaEncerrada.test.ts apps/web/src/server/application/turmaEncerradaRodizio.test.ts
git commit -m "refactor: identifica turma pela pos-graduacao"
```

### Task 2: Migração e persistência pela chave composta

**Files:**
- Create: `infra/mysql/052_turmas_por_pos_graduacao.sql`
- Create: `apps/web/src/server/persistence/turmasEncerradas.test.ts`
- Modify: `apps/web/src/server/persistence/turmasEncerradas.ts:1-204`

**Interfaces:**
- Consumes: `IdentidadeTurma`, `TurmaEncerrada`, `chaveTurma` da Task 1.
- Produces: `TurmasEncerradasRepository.encerrar(identidade: IdentidadeTurma, encerradaPor?: string): Promise<void>`.
- Produces: `TurmasEncerradasRepository.reabrir(identidade: IdentidadeTurma): Promise<void>`.
- Produces: `TurmasEncerradasRepository.migrarLegadas(cadastros: readonly CadastroPsicologoRecord[]): Promise<void>`; implementação MySQL é no-op porque a migração SQL resolve seus dados.
- Produces: `aplicarTurmasEncerradas(cadastros: CadastroPsicologoRecord[], encerradas: readonly TurmaEncerrada[]): CadastroPsicologoRecord[]` para testar a derivação sem I/O.
- Produces: `comTurmasEncerradas(cadastros, conexao?, repositorio?)`, preservando os dois primeiros argumentos atuais e aceitando um repositório opcional para testar falhas de I/O sem alterar os consumidores.

- [ ] **Step 1: Escrever testes falhos da derivação e do arquivo legado**

Cobrir em `turmasEncerradas.test.ts`:

```ts
expect(resultadoPsicodrama.turmaEncerrada?.posGraduacao).toBe('Psicodrama');
expect(resultadoPsicanalise.turmaEncerrada).toBeUndefined();
```

Usar `mkdtemp` e `DEMO_STATE_FILE` para criar um `turmas-encerradas.json`
legado com a chave `25A`. Chamar `migrarLegadas` com Psicodrama e Psicanálise
aprovados em `25A`, mais um recusado, e verificar formato final:

```ts
expect(arquivo).toMatchObject({ versao: 2 });
expect(arquivo.turmas).toHaveLength(2);
expect(arquivo.turmas.every((item) => item.turma === '25A')).toBe(true);
```

Adicionar casos para: combinação sem aprovados produz zero linhas; arquivo v2
não é reexpandido; falha de leitura em `comTurmasEncerradas` devolve os
cadastros sem encerramento e não lança exceção.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/server/persistence/turmasEncerradas.test.ts`

Expected: FAIL pelas assinaturas antigas, ausência do formato v2 e correspondência apenas por código.

- [ ] **Step 3: Criar a migração MySQL 052**

Escrever uma migração idempotente que:

1. adicione `pos_graduacao VARCHAR(255) NULL` quando ausente;
2. remova a unicidade antiga e crie temporariamente a nova unicidade
   `(instituicao_id, organizacao_ref, pos_graduacao, turma)` ainda com a coluna
   anulável; isso precisa ocorrer antes da expansão, pois a chave antiga impediria
   inserir dois cursos com o mesmo código;
3. expanda cada linha antiga, via `clinica_cadastros_psicologos`, para cada par
   distinto com `status = 'APROVADO'`, campos não vazios e a mesma instituição,
   organização e turma;
4. preserve `encerrada_em` e `encerrada_por` e gere o novo `id` com `UUID()`;
5. remova as linhas ainda sem `pos_graduacao` depois da expansão;
6. torne `pos_graduacao` `NOT NULL`, preservando a nova unicidade composta.

Cada DDL deve usar guarda em `information_schema`, seguindo o padrão das
migrações existentes, para sobreviver a uma execução parcial.

- [ ] **Step 4: Implementar os repositórios MySQL e arquivo**

No MySQL, incluir `pos_graduacao` em `SELECT`, `INSERT`, `DELETE`, ordenação e
na entrada de `rowId('turma_encerrada', chaveTurma(identidade))`. Atualizar
`MigracaoTurmasPendenteError` para citar a migração 052 e tratar também
`ER_BAD_FIELD_ERROR` como schema pendente.

No arquivo, persistir:

```ts
interface ArquivoTurmasV2 {
  versao: 2;
  turmas: TurmaEncerradaRegistro[];
}
```

Reconhecer o objeto legado por código somente dentro de `migrarLegadas`,
expandir combinações aprovadas com ambos os campos, preservar data/responsável
e gravar atomicamente o formato v2. `encerrar` deve ser idempotente pela
`chaveTurma`; `reabrir` deve remover somente a chave recebida.

- [ ] **Step 5: Implementar a aplicação isolada no roster**

Implementar `aplicarTurmasEncerradas` com um `Map` indexado por `chaveTurma` e
fazer `comTurmasEncerradas` chamar `migrarLegadas(cadastros)`, `listar()` e o
helper puro. Manter o `try/catch` que degrada para os cadastros originais.

- [ ] **Step 6: Executar testes e checagem da migração**

Run: `npm run test --workspace @thats-life/web -- src/server/persistence/turmasEncerradas.test.ts src/server/application/turmaEncerradaRodizio.test.ts`

Expected: PASS.

Run: `npm run db:status`

Expected: a migração `052_turmas_por_pos_graduacao.sql` aparece pendente em um banco até 051 ou aplicada sem erro em um banco atualizado.

- [ ] **Step 7: Verificar a expansão em MySQL descartável**

Em uma instância local sem a 052, inserir um encerramento antigo `25A`, dois
psicólogos aprovados `25A` de cursos diferentes e um recusado; aplicar
`npm run db:migrate`. Consultar `clinica_turmas_encerradas` e confirmar duas
linhas com os cursos aprovados, data/responsável preservados e nenhuma linha
nula. Executar `npm run db:migrate` novamente e confirmar que nada duplica.

- [ ] **Step 8: Commit**

```bash
git add infra/mysql/052_turmas_por_pos_graduacao.sql apps/web/src/server/persistence/turmasEncerradas.ts apps/web/src/server/persistence/turmasEncerradas.test.ts
git commit -m "feat: persiste encerramento por curso e turma"
```

### Task 3: Isolamento no rodízio, vitrine e notificação

**Files:**
- Modify: `apps/web/src/server/application/turmaEncerradaRodizio.test.ts`
- Modify: `apps/web/src/server/application/notificacoes.ts:412-427`
- Modify: `apps/web/src/server/application/notificacoesDestino.test.ts`
- Verify: `apps/web/src/server/application/viverMaisRodizio.ts:169-185`
- Verify: `apps/web/src/app/api/application/credenciamento-psicologo/public/route.ts:14-32`

**Interfaces:**
- Consumes: `TurmaEncerrada` composto e os cadastros derivados pela Task 2.
- Produces: aviso ao psicólogo com o nome da pós-graduação e o código.

- [ ] **Step 1: Escrever os testes falhos de isolamento**

Montar dois cadastros aprovados em `25A`, um de Psicodrama e outro de
Psicanálise, aplicar somente o encerramento de Psicodrama e afirmar:

```ts
expect(paraPsicologoPerfil(psicodrama).pausadoNoRodizio).toBe(true);
expect(paraPsicologoPerfil(psicanalise).pausadoNoRodizio).toBe(false);
```

No teste de notificações, afirmar que o aviso contém a formação e `25A`, e que
a chave do aviso continua estável pelo cadastro e pela data.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/server/application/turmaEncerradaRodizio.test.ts src/server/application/notificacoesDestino.test.ts`

Expected: FAIL até os fixtures compostos e a nova cópia do aviso serem aplicados.

- [ ] **Step 3: Atualizar a notificação acadêmica**

Usar o título `Sua turma {turma} de {posGraduacao} foi encerrada` e preservar a
descrição atual sobre vitrine, encaminhamentos e pacientes existentes.

- [ ] **Step 4: Executar os testes de domínio, rodízio, vitrine e notificação**

Run: `npm run test --workspace @thats-life/web -- src/lib/turmaEncerrada.test.ts src/server/persistence/turmasEncerradas.test.ts src/server/application/turmaEncerradaRodizio.test.ts src/server/application/notificacoesDestino.test.ts`

Expected: PASS. Confirmar por inspeção que a rota pública continua excluindo
somente itens onde `desligadoPorTurma(item.turmaEncerrada)` é verdadeiro.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/application/turmaEncerradaRodizio.test.ts apps/web/src/server/application/notificacoes.ts apps/web/src/server/application/notificacoesDestino.test.ts
git commit -m "test: garante isolamento de turmas no rodizio"
```

### Task 4: Contrato composto da API

**Files:**
- Create: `apps/web/src/app/api/application/turmas-encerradas/route.test.ts`
- Modify: `apps/web/src/app/api/application/turmas-encerradas/route.ts:1-69`

**Interfaces:**
- Consumes: `IdentidadeTurma` da Task 1 e métodos compostos do repositório da Task 2.
- Consumes: `TURMAS_ATIVAS` e `POS_GRADUACOES_VIVER_MAIS` como listas permitidas.
- Produces: `POST` com JSON `{ turma, posGraduacao }`.
- Produces: `DELETE` com query params `turma` e `posGraduacao`.
- Preserves: resposta `{ success: boolean; error?: string }` e autenticação de gestão.

- [ ] **Step 1: Escrever testes falhos da rota**

Mockar `exigirGestao`, `readSession` e `getTurmasEncerradasRepository`. Cobrir:

- `POST` válido normaliza `25a` e chama
  `encerrar({ turma: '25A', posGraduacao: cursoValido }, 'admin-test')`;
- `DELETE` válido chama `reabrir` com a mesma identidade;
- pós vazia, curso fora do catálogo e turma fora de `TURMAS_ATIVAS` retornam 400
  sem escrever;
- `MigracaoTurmasPendenteError` retorna 503;
- erro inesperado retorna 500 sem vazar detalhes.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/app/api/application/turmas-encerradas/route.test.ts`

Expected: FAIL porque a rota ainda aceita e envia somente `turma`.

- [ ] **Step 3: Implementar validação e operações compostas**

Substituir `turmaDoPedido` por
`identidadeDoPedido(turma: unknown, posGraduacao: unknown): IdentidadeTurma`.
Validar depois de aparar/normalizar e enviar somente a identidade validada ao
repositório. No `DELETE`, ler ambos os query params.

- [ ] **Step 4: Executar o teste da rota**

Run: `npm run test --workspace @thats-life/web -- src/app/api/application/turmas-encerradas/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/application/turmas-encerradas/route.ts apps/web/src/app/api/application/turmas-encerradas/route.test.ts
git commit -m "feat: encerra turma por pos-graduacao na api"
```

### Task 5: Modelo de apresentação e lista agrupada

**Files:**
- Modify: `apps/web/src/components/gestao/PainelTurmas.tsx:1-120`
- Modify: `apps/web/src/components/gestao/PainelTurmas.test.ts:1-49`

**Interfaces:**
- Consumes: `PsicologoItem`, `TurmaEncerrada`, `IdentidadeTurma`, `chaveTurma`.
- Produces: `TurmaPainel { identidade: IdentidadeTurma; quantidade: number; encerramento?: TurmaEncerrada }`.
- Produces: `GrupoTurmasPainel { posGraduacao: string; turmas: TurmaPainel[] }`.
- Produces: `ModeloPainelTurmas { grupos: GrupoTurmasPainel[]; cadastrosIncompletos: number; cursosForaCatalogo: number }`.
- Produces: `montarModeloPainelTurmas(psicologos, encerradas): ModeloPainelTurmas`.
- Changes callbacks to `onEncerrar(identidade: IdentidadeTurma)` and `onReabrir(identidade: IdentidadeTurma)`.

- [ ] **Step 1: Substituir testes antigos por testes falhos do modelo agrupado**

Cobrir no helper puro:

- Psicodrama `25A` e `25B` formam um grupo com duas linhas;
- Psicanálise `25A` forma outro grupo;
- duplicatas contam psicólogos, mas não duplicam a linha;
- `EM_ANALISE`, `RECUSADO`, campo vazio e `segundaPosGraduacao` não formam turmas;
- grupos usam `localeCompare('pt-BR')` e códigos são ordenados;
- encerramento liga apenas à chave composta exata;
- aprovado sem um dos campos incrementa `cadastrosIncompletos`;
- curso preenchido fora de `POS_GRADUACOES_VIVER_MAIS` incrementa
  `cursosForaCatalogo` e aparece sem ação de encerramento.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/components/gestao/PainelTurmas.test.ts`

Expected: FAIL porque `montarModeloPainelTurmas` e os novos tipos não existem.

- [ ] **Step 3: Implementar o modelo puro**

Implementar as interfaces e `montarModeloPainelTurmas` no mesmo arquivo do
componente. Remover `posGraduacoesDaTurma`. Derivar somente combinações de
aprovados e associar encerramentos com `chaveTurma`.

- [ ] **Step 4: Renderizar a lista agrupada responsiva**

Manter o container e cabeçalho visual da seção. Para cada grupo, renderizar um
bloco com nome da pós e quantidade de turmas; para cada turma, uma linha com:
código em destaque, contagem, badge `Em curso` ou data de encerramento e botão.
Usar layout `flex-col` no mobile e `sm:flex-row` no desktop, bordas discretas,
estados `hover`, `focus-visible` e `disabled`, sem gradiente.

Exibir aviso âmbar quando `cadastrosIncompletos > 0` ou
`cursosForaCatalogo > 0`. Curso fora do catálogo permanece visível, mas sua linha
mostra `Corrija o cadastro para administrar esta turma` no lugar do botão.

O `confirm` deve citar curso, código e quantidade. `ocupado` usa
`turma:${chaveTurma(identidade)}` para bloquear somente a combinação acionada.

- [ ] **Step 5: Executar o teste do componente**

Run: `npm run test --workspace @thats-life/web -- src/components/gestao/PainelTurmas.test.ts`

Expected: PASS.

- [ ] **Step 6: Executar typecheck para validar props e consumidores pendentes**

Run: `npm run typecheck --workspace @thats-life/web`

Expected: FAIL somente em `gestao/psicologos/page.tsx`, que ainda fornece callbacks por string; qualquer outra falha deve ser corrigida antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/gestao/PainelTurmas.tsx apps/web/src/components/gestao/PainelTurmas.test.ts
git commit -m "feat: agrupa painel por pos-graduacao"
```

### Task 6: Integração da página de gestão

**Files:**
- Modify: `apps/web/src/app/gestao/psicologos/page.tsx:20-117,445-451`

**Interfaces:**
- Consumes: callbacks por `IdentidadeTurma` definidos na Task 5.
- Produces: requisições POST/DELETE com ambos os campos e estado ocupado por chave composta.

- [ ] **Step 1: Atualizar `alterarTurma` para a identidade composta**

Usar a assinatura:

```ts
const alterarTurma = async (identidade: IdentidadeTurma, metodo: 'POST' | 'DELETE') => Promise<void>
```

No POST, enviar `JSON.stringify(identidade)`. No DELETE, enviar `turma` e
`posGraduacao` com `URLSearchParams`. Usar `chaveTurma(identidade)` no estado
`ocupado`.

- [ ] **Step 2: Garantir migração local antes da primeira listagem**

Alterar o efeito inicial para aguardar `loadPsicologos()` antes de
`loadTurmas()`. Isso garante que o endpoint de credenciamento execute a
migração do arquivo legado antes de o painel pedir o formato v2. Depois de uma
ação, manter a recarga conjunta das duas fontes.

- [ ] **Step 3: Conectar os callbacks compostos do painel**

Fazer `onEncerrar={(identidade) => alterarTurma(identidade, 'POST')}` e o
equivalente para reabrir. Importar `IdentidadeTurma` e `chaveTurma` do módulo
compartilhado.

- [ ] **Step 4: Executar testes, typecheck e lint direcionado**

Run: `npm run test --workspace @thats-life/web -- src/components/gestao/PainelTurmas.test.ts src/app/api/application/turmas-encerradas/route.test.ts`

Expected: PASS.

Run: `npm run typecheck --workspace @thats-life/web`

Expected: PASS.

Run: `npx eslint src/app/gestao/psicologos/page.tsx src/components/gestao/PainelTurmas.tsx` from `apps/web`.

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/gestao/psicologos/page.tsx
git commit -m "feat: integra gestao de turmas compostas"
```

### Task 7: Verificação completa e acabamento visual

**Files:**
- Modify if needed: only files already listed in Tasks 1-6.

**Interfaces:**
- Consumes: feature completa das Tasks 1-6.
- Produces: evidência automatizada e visual dos critérios de aceitação.

- [ ] **Step 1: Executar a suíte web completa**

Run: `npm run test --workspace @thats-life/web`

Expected: todos os testes passam.

- [ ] **Step 2: Executar verificações estáticas**

Run: `npm run lint`

Expected: exit 0.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 3: Executar o build de produção pela raiz**

Run: `npm run web:build`

Expected: build Next.js concluído sem erros, servindo a aplicação diretamente pelo monorepo.

- [ ] **Step 4: Validar o fluxo no navegador em desktop e mobile**

Com dados locais contendo Psicodrama `25A` e `25B`, Psicanálise `25A`, um
aprovado incompleto e um curso legado, verificar em aproximadamente 1440 px e
390 px:

- grupos e linhas aparecem na ordem correta;
- nomes longos quebram sem sobrepor contagem, badge ou botão;
- confirmação cita curso, turma e quantidade;
- encerrar Psicodrama `25A` altera apenas essa linha e seus psicólogos;
- Psicanálise `25A` permanece em curso e na vitrine;
- recarregar a página preserva o estado;
- reabrir restaura apenas Psicodrama `25A`;
- avisos de cadastro incompleto/legado são compreensíveis e não oferecem uma ação insegura;
- foco por teclado e estados desabilitados permanecem visíveis.

- [ ] **Step 5: Revisar o diff e criar commit de acabamento apenas se necessário**

Run: `git diff --check && git status --short`

Expected: sem whitespace errors e somente arquivos esperados. Se a verificação exigir ajustes, repetir os checks afetados e criar:

```bash
git add <arquivos-ajustados>
git commit -m "fix: finaliza painel de turmas por curso"
```
