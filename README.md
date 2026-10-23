# Clínica Viver Mais

Plataforma de gestão clínica da Viver Mais Psicologia, também identificada no código como **Thats Life (TL - Psi)**. Reúne vitrine e triagem, cadastro de pacientes e profissionais, agenda, prontuários, automação pós-sessão, comunicação por WhatsApp e financeiro.

O monorepo usa npm workspaces, TypeScript, Next.js 16, React 19 e MySQL. Os nomes dos pacotes continuam sendo `@thats-life/web` e `@thats-life/core`.

## Por onde começar

- **Desenvolvimento e agentes de IA:** leia [AGENTS.md](AGENTS.md) e o guia da pasta que será alterada.
- **Documentação por assunto:** consulte o [índice de documentação](docs/README.md).
- **Visão do produto:** leia o [resumo da plataforma](docs/produto/RESUMO-DA-PLATAFORMA.md).
- **Infraestrutura vigente:** consulte [Hostinger VPS](docs/operacao/hostinger-vps.md) e [Vercel](docs/operacao/vercel-setup-guia.md).

## Estrutura do projeto

```text
Clinica Viver Mais/
├── AGENTS.md                  # Instruções comuns para agentes
├── README.md                  # Entrada do projeto e execução local
├── apps/web/                  # Aplicação Next.js: páginas, APIs e servidor
│   ├── AGENTS.md              # Guia de navegação e trabalho na aplicação
│   ├── public/                # Arquivos servidos pelo site
│   └── src/
│       ├── app/               # App Router e Route Handlers
│       ├── components/        # Interface organizada por funcionalidade
│       ├── lib/               # Utilitários, cliente de API e dados de demonstração
│       └── server/            # Serviços, autenticação, integrações e persistência
├── packages/core/             # Regras de domínio, contratos e testes
├── infra/                     # MySQL, migrations, Docker, deploy e Evolution API
├── scripts/                   # Utilitários de desenvolvimento e operação
├── docs/
│   ├── README.md              # Índice e ordem de leitura
│   ├── produto/               # Escopo, funcionalidades e jornadas
│   ├── arquitetura/           # Arquitetura e fluxos técnicos
│   ├── operacao/              # Guias de infraestrutura e integrações
│   ├── levantamentos/         # Reuniões, propostas e pesquisa
│   ├── design/                # Identidade visual e imagens originais
│   ├── historico/             # Infraestrutura anterior, registros e planos/
│   ├── referencias/           # Material externo local, quando disponível
│   ├── superpowers/specs/     # Especificações históricas por data
│   └── manual-psicologo-fonte/ # Fontes do manual e capturas
├── videos/                    # Projetos de vídeo, com instruções próprias
└── output/                    # Artefatos exportados
```

Os manuais PDF/HTML existentes continuam em `docs/`, junto de seu mapa de navegação. O [registro de organização](docs/organizacao-arquivos.md) relaciona os caminhos anteriores e novos.

## Estado do módulo acadêmico

O portal do aluno (`/aluno`), a gestão acadêmica (`/gestao/academico`) e os certificados de cursos ainda têm implementação neste repositório. O aluno usa identidade e sessão próprias; o portal depende de MySQL.

A separação para **Viver Mais Educacional** está descrita na [especificação](docs/superpowers/specs/2026-10-23-extracao-plataforma-educacional-design.md) e no [plano de extração](docs/historico/planos/2026-10-23-extracao-plataforma-educacional.md). Esses documentos descrevem a migração pretendida; sua existência não significa que a extração já foi concluída. Turmas da clínica-escola, declarações de horas clínicas e NFS-e têm responsabilidades clínicas distintas.

## Executar localmente

Requisitos: Node.js **20.19.4 ou superior** (versão de referência em `.nvmrc`), npm e Docker se for usar o banco local. Execute os comandos abaixo na raiz.

```bash
npm ci
# Somente se ainda não existir uma configuração local da aplicação:
cp -n .env.example apps/web/.env.local
npm run web:dev
```

Acesse `http://localhost:3000`. O comando inicia o workspace `apps/web`; configure as variáveis do Next.js em `apps/web/.env.local`. Um `.env.local` apenas na raiz não substitui a configuração desse workspace.

Sem `DATABASE_URL` e sem a configuração alternativa completa `MYSQL_*`, a aplicação usa os adaptadores de demonstração. Deixe `BACKEND_ORIGIN` vazio para trabalhar com as APIs locais. O catálogo de variáveis está em [.env.example](.env.example); use somente dados fictícios na demonstração.

### MySQL local

```bash
npm run db:up
MYSQL_ADMIN_URL='mysql://root:dev-root-local@127.0.0.1:3307/viver_mais_clinica' npm run db:migrate
```

Configure em `apps/web/.env.local` a `DATABASE_URL` local, `ORGANIZATION_ID` e `AUTH_SESSION_SECRET`. O [Compose de desenvolvimento](infra/mysql/docker-compose.dev.yml) define o banco `viver_mais_clinica`, o usuário local `viver_mais_app` e a senha descartável `dev-app-local`, na porta `3307`. Ajuste também `NEXT_PUBLIC_DEMO_MODE` ao modo de execução.

O runner de migrations recebe `MYSQL_ADMIN_URL` pelo ambiente do processo; não depende de carregar o `.env.local` do Next.js. A aplicação usa a credencial própria do banco. Consulte o [guia operacional](docs/operacao/hostinger-vps.md) para provisionamento e acessos; não use credenciais da VPS no ambiente de desenvolvimento.

## Comandos de verificação

| Comando na raiz | O que executa |
| --- | --- |
| `npm run lint` | ESLint da aplicação web |
| `npm run typecheck` | TypeScript do core e da aplicação web |
| `npm test` | Vitest dos dois workspaces |
| `npm run web:build` | Build de produção do Next.js |
| `npm run check` | Lint, tipos, testes e build, como no CI |
| `npm run db:status` | Consulta migrations usando `MYSQL_ADMIN_URL` (`--dry-run`) |
| `npm run demo:documentos` | Ambiente local de demonstração dos documentos |

Para rodar somente os testes relacionados a uma mudança:

```bash
npm run test --workspace @thats-life/core -- src/patientHandoff.test.ts
npm run test --workspace @thats-life/web -- src/server/application/agendaEdicaoConclusao.test.ts
```

`npm run db:reset` remove o volume do banco local. Não é uma etapa de instalação ou verificação rotineira.

## Deploy

A Vercel serve as páginas e os assets. O backend persistente e o MySQL ficam na VPS Hostinger; a Evolution API atende à integração de WhatsApp. As migrations SQL ficam em `infra/mysql/`.

O projeto Vercel **`clinica-viver-web` é construído pela raiz do monorepo**, conforme [vercel.json](vercel.json). `BACKEND_ORIGIN` permite encaminhar os namespaces de API definidos em [next.config.mjs](apps/web/next.config.mjs) para `app.clinicavivermais.cloud`.

**Nunca adicione um rewrite global de `/:path*`.** A aplicação publicada na Vercel deve servir diretamente o Next.js deste repositório.

Siga os guias de [publicação na Hostinger](docs/operacao/hostinger-vps.md) e [diagnóstico da Vercel](docs/operacao/vercel-setup-guia.md). Material de OCI/Sponteiro está em `docs/historico/`; não descreve a produção vigente.
