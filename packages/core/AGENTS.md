# Domínio compartilhado

Este guia complementa o [AGENTS.md da raiz](../../AGENTS.md). O pacote é consumido como `@thats-life/core`, com entrada em `src/index.ts`.

## Onde trabalhar

- `clinicalRecord/`, `clinicalSession/`, `clinicalTimeline/`: prontuário, sessão e histórico clínico.
- `identity/`: identidade e contexto de acesso.
- `scheduling/` e `viverMaisMatchingEngine.ts`: agendamento e distribuição de pacientes.
- `communication/` e `evolutionApi.ts`: contratos e integração de comunicação.
- `financial/` e `fiscal/`: financeiro e regras fiscais.
- `academic/` e `certificados/`: domínio acadêmico e certificados de cursos, ainda presentes durante o planejamento da extração.
- `declaracaoHoras/` e `psychologicalDocuments.ts`: horas clínicas e documentos psicológicos.

Não importe Next.js, componentes React ou módulos de `apps/web`. Mantenha regras de domínio independentes da interface e use os contratos existentes para persistência e serviços externos. Migrations e schema SQL pertencem a `infra/mysql/`.

Preserve autorização, idempotência e integridade dos registros. Use implementações em memória e fixtures fictícias nos testes; não conecte testes unitários a provedores reais.

## Verificar pela raiz

```bash
npm run check --workspace @thats-life/core
npm run test --workspace @thats-life/core
# Ou um teste relacionado:
npm run test --workspace @thats-life/core -- src/patientHandoff.test.ts
```

Ao mudar tipos ou exports compartilhados, execute também `npm run typecheck` na raiz para verificar os consumidores na aplicação web.
