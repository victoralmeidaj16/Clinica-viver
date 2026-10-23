# Índice da documentação

Comece pelo assunto da tarefa. Documentos de produto, reuniões e planos registram intenções e decisões; confira o código e os testes antes de assumir que uma funcionalidade está implementada. A situação publicada deve ser verificada no ambiente correspondente.

## Leitura recomendada

1. [README do projeto](../README.md): estrutura, execução e comandos.
2. [Guia dos agentes](../AGENTS.md): limites de arquitetura e regras comuns.
3. [Resumo da plataforma](produto/RESUMO-DA-PLATAFORMA.md): contexto funcional.
4. [Arquitetura](arquitetura/ARCHITECTURE.md): visão técnica, confrontada com os módulos atuais.
5. Documento do assunto e, quando houver, especificação em `superpowers/specs/` e plano em `historico/planos/`.

## Produto e jornadas — `produto/`

| Documento | Uso |
| --- | --- |
| [Resumo da plataforma](produto/RESUMO-DA-PLATAFORMA.md) | Visão geral para apresentação e contexto |
| [PRD](produto/PRD.md) | Requisitos e escopo de produto |
| [Funcionalidades](produto/FUNCIONALIDADES.md) | Catálogo funcional; validar implementação ao usar |
| [Fluxo de navegação](produto/fluxo-navegacao-e-funcionalidades.md) | Áreas e jornadas da plataforma |
| [Jornada do paciente](produto/USER_FLOW_PACIENTE.md) | Entrada, atendimento e comunicação |
| [Onboarding do psicólogo](produto/USER_FLOW_PSICOLOGO.md) | Cadastro e credenciamento |

## Arquitetura e fluxos técnicos — `arquitetura/`

- [Arquitetura técnica](arquitetura/ARCHITECTURE.md).
- [Documentos psicológicos](arquitetura/documentos-psicologicos.md).
- [Reagendamento, avisos e cobranças](arquitetura/reagendamento-avisos-e-cobrancas.md).
- [Comunicação persistente](comunicacao-persistente.md): documento em trabalho já existente, mantido no caminho original nesta organização.

Para localizar arquivos de implementação, use a tabela do [AGENTS.md](../AGENTS.md). A antiga API demonstrativa foi movida para o histórico: seus cabeçalhos de identidade não representam a autenticação atual.

## Operação — `operacao/`

- [Hostinger VPS](operacao/hostinger-vps.md): referência de infraestrutura vigente e publicação.
- [Vercel](operacao/vercel-setup-guia.md): configuração e diagnóstico de deploy.
- [Banco Inter / Pix](operacao/INTEGRACAO_BANCO_INTER_PIX.md): configuração da integração.
- [Pendências da VPS](operacao/operacao-vps-pendente.md): itens registrados; verificar no ambiente se continuam pendentes.
- [Backend e Docker](../infra/clinic/README.md) e [Evolution API](../infra/evolution/README.md): documentação junto à infraestrutura.

Scripts operacionais podem alterar dados e serviços. Sua presença neste índice não autoriza execução em produção.

## Levantamentos — `levantamentos/`

Fontes de contexto e requisitos. Propostas e benchmarks não são inventários comprovados do código atual.

- [Reunião com Giuliana](levantamentos/reuniao-giuliana-clinica-insights.md).
- [Reunião de alinhamento](levantamentos/requisitos-reuniao-alinhamento.md).
- [Proposta de automatização da clínica-escola](levantamentos/CLINICA_ESCOLA_PROPOSTA_AUTOMATIZACAO.md).
- [Fluxo WhatsApp da clínica-escola](levantamentos/clinica-escola-fluxo-whatsapp.md).
- [Panorama da Viver Mais Psicologia](levantamentos/Viver-Mais-Psicologia.md).
- [Benchmark competitivo](levantamentos/BENCHMARK_COMPETITIVO.md).

## Design e referências

- [Identidade visual](design/design.md): guia de referência; confira tokens e componentes da aplicação ao implementar.
- [Imagens originais](design/assets/): materiais da marca. Os assets servidos pelo site continuam em `apps/web/public/`.
- `referencias/`: materiais externos locais, como a apostila de documentos psicológicos. O PDF continua ignorado pelo Git e pode não existir em um clone novo.

## Especificações e planos históricos

As pastas [specs/](superpowers/specs/) e [planos/](historico/planos/) são registros históricos; para cada assunto, o documento vigente é sempre o mais recente pela data no nome.

| Assunto | Especificação | Plano |
| --- | --- | --- |
| Turmas por pós-graduação | [06/10](superpowers/specs/2026-10-06-turmas-por-pos-graduacao-design.md) | [06/10](historico/planos/2026-10-06-turmas-por-pos-graduacao.md) |
| Portal do aluno | [13/10](superpowers/specs/2026-10-13-portal-aluno-design.md) | [13/10](historico/planos/2026-10-13-portal-aluno.md) |
| Certificados do portal | [14/10](superpowers/specs/2026-10-14-certificados-portal-aluno-design.md) | [14/10](historico/planos/2026-10-14-certificados-portal-aluno.md) |
| Cadastro único de psicólogo | — | [16/10](historico/planos/2026-10-16-cadastro-unico-psicologo.md) |
| Reagendamento pelo paciente | [20/10](superpowers/specs/2026-10-20-aprovacao-reagendamento-paciente-design.md) | [20/10](historico/planos/2026-10-20-solicitacao-reagendamento-paciente.md) |
| Valor personalizado por paciente | [21/10](superpowers/specs/2026-10-21-valor-personalizado-por-paciente-design.md) | [21/10](historico/planos/2026-10-21-valor-personalizado-por-paciente.md) |
| Extração educacional | [23/10](superpowers/specs/2026-10-23-extracao-plataforma-educacional-design.md) | [23/10](historico/planos/2026-10-23-extracao-plataforma-educacional.md) |
| Públicos da vitrine | [23/10](superpowers/specs/2026-10-23-vitrine-publicos-pos-design.md) | [23/10](historico/planos/2026-10-23-vitrine-publicos-pos.md) |

A extração educacional tem destino planejado em um projeto independente. Código acadêmico e certificados de cursos ainda existem neste monorepo; não confunda o estado desejado com uma migração concluída.

## Manuais e apresentações

Estes materiais mantêm seus caminhos existentes para preservar as fontes de geração e referências da ajuda:

- [Mapa da plataforma do psicólogo](mapa-plataforma-psicologo.md).
- [Guia visual HTML](guia-visual-psicologo.html), [PDF](guia-visual-psicologo.pdf) e [PDF para celular](guia-visual-psicologo-celular.pdf).
- [Manual prático em PDF](manual-pratico-psicologo.pdf) e [fontes do manual](manual-psicologo-fonte/).
- [Apresentação de funcionalidades](apresentacao-funcionalidades.html).

Projetos de vídeo ficam em `videos/`; exportações gerais, em `output/`. Consulte as instruções locais antes de trabalhar nesses materiais.

## Histórico — `historico/`

Não use estes documentos como roteiro vigente de infraestrutura ou autenticação. Registros de limpeza e reset descrevem operações datadas, não rotinas a repetir.

- [Plano de implantação no Sponteiro](historico/clinica-plano-implantacao.md).
- [Migração OCI](historico/oci-migracao.md).
- [Proposta de evolução da plataforma](historico/proposta-evolucao-plataforma.md).
- [Contrato da API demonstrativa](historico/APPLICATION_API.md).
- [Limpeza de 25/08/2026](historico/operacao-limpeza-producao-2026-08-25.md).
- [Reset de 03/09/2026](historico/operacao-reset-producao-2026-09-03.md).
- [Reset de 29/09/2026](historico/operacao-reset-producao-2026-09-29.md).

## Manutenção do acervo

Siga [docs/AGENTS.md](AGENTS.md) ao criar documentos. O [registro de organização](organizacao-arquivos.md) registra a organização inicial de 30 arquivos e a transferência dos oito planos históricos.
