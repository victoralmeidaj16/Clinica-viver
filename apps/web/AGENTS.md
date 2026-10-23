# Aplicação web

Este guia complementa o [AGENTS.md da raiz](../../AGENTS.md).

## Caminho de uma alteração

- `src/app/`: páginas, layouts e Route Handlers em `api/`.
- `src/components/`: interface agrupada por funcionalidade; mantenha componentes com menos de 250 linhas.
- `src/lib/applicationApi.ts`: cliente da API da aplicação. Os demais arquivos de `lib/` incluem utilitários e dados de demonstração.
- `src/server/application/`: orquestração dos casos de uso; `context.ts` resolve sessão e vínculo, `store.ts` compõe os serviços e repositórios.
- `src/server/persistence/mysql/`: repositórios persistentes. `src/server/oci/runtime.ts` configura o MySQL, apesar do nome histórico.
- `src/server/scheduling/`, `payments/`, `documents/`, `academic/`, `certificados/` e `fiscal/`: serviços especializados.
- `src/server/auth.ts`, `security/` e `src/proxy.ts`: sessão, controles de segurança e proteção de rotas.
- `public/`: assets acessíveis pelo navegador; nunca coloque segredos ou documentos clínicos aqui.

Siga os padrões do serviço e dos testes vizinhos. Mantenha acesso ao banco e credenciais no servidor; reutilize o domínio de `@thats-life/core`. Não troque persistência por dados de demonstração para contornar uma falha de banco.

## Desenvolvimento e verificação

Execute os comandos pela raiz do monorepo:

```bash
npm run web:dev
npm run lint
npm run typecheck
npm run test --workspace @thats-life/web -- src/server/application/agendaEdicaoConclusao.test.ts
npm run web:build
```

Os testes usam Vitest e o alias `@` aponta para `src/`. O ambiente local do Next.js fica em `apps/web/.env.local`; consulte o exemplo da raiz. `next.config.mjs` e o `vercel.json` da raiz definem o build e os encaminhamentos de API.

Antes de mudar acadêmico ou certificados de cursos, leia o [plano de extração](../../docs/historico/planos/2026-10-23-extracao-plataforma-educacional.md). Essa organização de arquivos não executa a separação dos produtos.
