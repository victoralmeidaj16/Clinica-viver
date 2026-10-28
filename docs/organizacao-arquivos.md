# Registro da organização de arquivos

## Conferência da estrutura — 28/10/2026

Foram conferidos os caminhos locais, os arquivos de entrada e as referências à ajuda da aplicação. Os 38 destinos registrados nas tabelas abaixo existem nesta cópia do repositório. Esta revisão não moveu nem excluiu arquivos e não validou publicação ou todo o conteúdo do acervo.

Os caminhos nesta página partem da raiz do repositório. Consulte o [índice](README.md) para navegar e o [guia de documentação](AGENTS.md) antes de criar ou mover documentos.

| Caminho | Conteúdo conferido |
| --- | --- |
| `README.md` e `AGENTS.md` | Entrada do projeto e instruções gerais |
| `docs/README.md` e `docs/AGENTS.md` | Índice e instruções específicas de documentação |
| `docs/produto/` | Seis documentos de produto e jornadas |
| `docs/arquitetura/` | Três documentos de arquitetura e fluxos técnicos |
| `docs/operacao/` | Quatro guias de infraestrutura e integrações |
| `docs/levantamentos/` | Seis documentos de reuniões, propostas e pesquisa |
| `docs/design/` e `docs/design/assets/` | Guia visual e duas imagens originais de marca |
| `docs/referencias/` | Apostila PDF local, ignorada pelo Git |
| `docs/historico/` | Sete documentos diretamente na pasta, além de `planos/` |
| `docs/historico/planos/` | Oito planos históricos |
| `docs/superpowers/specs/` | Sete especificações; a antiga pasta irmã `plans/` está ausente |
| `docs/manual-psicologo-fonte/` | Scripts de geração e captura, CSS, ícones e imagens do manual |
| `infra/clinic/README.md` e `infra/evolution/README.md` | Documentação mantida junto à infraestrutura |
| `videos/` e `output/` | Projetos de vídeo e exportações gerais |

Permanecem diretamente em `docs/`: `comunicacao-persistente.md`, `mapa-plataforma-psicologo.md`, `guia-visual-psicologo.html`, `guia-visual-psicologo.pdf`, `guia-visual-psicologo-celular.pdf`, `manual-pratico-psicologo.pdf`, `apresentacao-funcionalidades.html` e este registro, além de `README.md` e `AGENTS.md`.

A ajuda em [apps/web/src/app/ajuda/page.tsx](../apps/web/src/app/ajuda/page.tsx) usa conteúdo e componentes próprios e oferece o PDF em [apps/web/public/ajuda/](../apps/web/public/ajuda/). Os materiais em `docs/` e o arquivo servido são caminhos distintos; sua existência não comprova que estejam sincronizados.

Os identificadores `thats-life` e `@thats-life/*` ainda aparecem nos manifests deste monorepo. Sua presença não indica, por si só, arquivos de outro projeto. A prioridade antiga de “1 clique: SOAP + tarefas + cobrança” foi removida do `AGENTS.md` da raiz após o esclarecimento do responsável sobre a retirada desse fluxo do escopo.

## Histórico da organização — 23/10/2026

O registro original informa a preservação dos nomes, o ajuste dos links internos e das referências e a ausência de exclusões na organização. As tabelas abaixo preservam as origens e os destinos registrados naquela ocasião.

Os caminhos abaixo são relativos à raiz. Para desfazer um movimento, devolva o destino à origem e ajuste as referências. O PDF em `docs/referencias/` é material local ignorado pelo Git.

| Origem | Destino |
| --- | --- |
| `docs/PRD.md` | `docs/produto/PRD.md` |
| `docs/FUNCIONALIDADES.md` | `docs/produto/FUNCIONALIDADES.md` |
| `docs/RESUMO-DA-PLATAFORMA.md` | `docs/produto/RESUMO-DA-PLATAFORMA.md` |
| `docs/USER_FLOW_PACIENTE.md` | `docs/produto/USER_FLOW_PACIENTE.md` |
| `docs/USER_FLOW_PSICOLOGO.md` | `docs/produto/USER_FLOW_PSICOLOGO.md` |
| `docs/fluxo-navegacao-e-funcionalidades.md` | `docs/produto/fluxo-navegacao-e-funcionalidades.md` |
| `docs/ARCHITECTURE.md` | `docs/arquitetura/ARCHITECTURE.md` |
| `docs/documentos-psicologicos.md` | `docs/arquitetura/documentos-psicologicos.md` |
| `docs/reagendamento-avisos-e-cobrancas.md` | `docs/arquitetura/reagendamento-avisos-e-cobrancas.md` |
| `docs/hostinger-vps.md` | `docs/operacao/hostinger-vps.md` |
| `docs/vercel-setup-guia.md` | `docs/operacao/vercel-setup-guia.md` |
| `docs/INTEGRACAO_BANCO_INTER_PIX.md` | `docs/operacao/INTEGRACAO_BANCO_INTER_PIX.md` |
| `docs/operacao-vps-pendente.md` | `docs/operacao/operacao-vps-pendente.md` |
| `reuniao-giuliana-clinica-insights.md` | `docs/levantamentos/reuniao-giuliana-clinica-insights.md` |
| `CLINICA_ESCOLA_PROPOSTA_AUTOMATIZACAO.md` | `docs/levantamentos/CLINICA_ESCOLA_PROPOSTA_AUTOMATIZACAO.md` |
| `clinica-escola-fluxo-whatsapp.md` | `docs/levantamentos/clinica-escola-fluxo-whatsapp.md` |
| `Viver-Mais-Psicologia.md` | `docs/levantamentos/Viver-Mais-Psicologia.md` |
| `docs/requisitos-reuniao-alinhamento.md` | `docs/levantamentos/requisitos-reuniao-alinhamento.md` |
| `docs/BENCHMARK_COMPETITIVO.md` | `docs/levantamentos/BENCHMARK_COMPETITIVO.md` |
| `clinica-plano-implantacao.md` | `docs/historico/clinica-plano-implantacao.md` |
| `docs/oci-migracao.md` | `docs/historico/oci-migracao.md` |
| `docs/proposta-evolucao-plataforma.md` | `docs/historico/proposta-evolucao-plataforma.md` |
| `docs/APPLICATION_API.md` | `docs/historico/APPLICATION_API.md` |
| `docs/operacao-limpeza-producao-2026-08-25.md` | `docs/historico/operacao-limpeza-producao-2026-08-25.md` |
| `docs/operacao-reset-producao-2026-09-03.md` | `docs/historico/operacao-reset-producao-2026-09-03.md` |
| `docs/operacao-reset-producao-2026-09-29.md` | `docs/historico/operacao-reset-producao-2026-09-29.md` |
| `design.md` | `docs/design/design.md` |
| `LOGO-HEADER-viver mais psicologia.png` | `docs/design/assets/LOGO-HEADER-viver mais psicologia.png` |
| `capa login viver mais clinica.png` | `docs/design/assets/capa login viver mais clinica.png` |
| `APOSTILA DE MODELOS DE DOCUMENTOS PARA PSICOLOGOS (1).pdf · versão 1 (1).pdf` | `docs/referencias/APOSTILA DE MODELOS DE DOCUMENTOS PARA PSICOLOGOS (1).pdf · versão 1 (1).pdf` |

## Consolidação dos planos históricos

Os oito planos receberam a seção final “Pendências conhecidas” e foram movidos para `docs/historico/planos/`. A pasta original foi removida após a transferência.

| Origem | Destino |
| --- | --- |
| `docs/superpowers/plans/2026-10-06-turmas-por-pos-graduacao.md` | `docs/historico/planos/2026-10-06-turmas-por-pos-graduacao.md` |
| `docs/superpowers/plans/2026-10-13-portal-aluno.md` | `docs/historico/planos/2026-10-13-portal-aluno.md` |
| `docs/superpowers/plans/2026-10-14-certificados-portal-aluno.md` | `docs/historico/planos/2026-10-14-certificados-portal-aluno.md` |
| `docs/superpowers/plans/2026-10-16-cadastro-unico-psicologo.md` | `docs/historico/planos/2026-10-16-cadastro-unico-psicologo.md` |
| `docs/superpowers/plans/2026-10-20-solicitacao-reagendamento-paciente.md` | `docs/historico/planos/2026-10-20-solicitacao-reagendamento-paciente.md` |
| `docs/superpowers/plans/2026-10-21-valor-personalizado-por-paciente.md` | `docs/historico/planos/2026-10-21-valor-personalizado-por-paciente.md` |
| `docs/superpowers/plans/2026-10-23-extracao-plataforma-educacional.md` | `docs/historico/planos/2026-10-23-extracao-plataforma-educacional.md` |
| `docs/superpowers/plans/2026-10-23-vitrine-publicos-pos.md` | `docs/historico/planos/2026-10-23-vitrine-publicos-pos.md` |
