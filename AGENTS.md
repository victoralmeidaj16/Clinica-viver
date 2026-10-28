# Guia para agentes — Clínica Viver Mais

Estas instruções valem para todo o repositório. Leia também o `AGENTS.md` mais próximo do arquivo que será alterado. Os nomes técnicos `thats-life`, `@thats-life/web` e `@thats-life/core` continuam em uso.

## Leitura inicial

1. Leia o [README](README.md) para execução e estrutura.
2. Consulte [docs/README.md](docs/README.md) e abra somente os documentos relacionados à tarefa.
3. Verifique `git status --short` antes de editar. Preserve alterações e arquivos não rastreados que já existiam.
4. Localize a implementação e os testes com `rg` e `rg --files`; não carregue toda a documentação ou o repositório de uma vez.

O código, as configurações e os testes mostram o comportamento implementado. Especificações e planos registram decisões e trabalho pretendido; não comprovam conclusão ou publicação. Quando houver divergência, registre-a e confirme o comportamento relevante antes de alterar.

## Mapa para localizar uma tarefa

| Assunto | Onde começar |
| --- | --- |
| Páginas e endpoints | `apps/web/src/app/` e `apps/web/src/app/api/` |
| Componentes de interface | `apps/web/src/components/` |
| Cliente de API e utilitários | `apps/web/src/lib/` |
| Casos de uso e pós-sessão | `apps/web/src/server/application/` |
| Agenda e reagendamento | `apps/web/src/server/scheduling/` e `packages/core/src/scheduling/` |
| Prontuário, sessão e linha do tempo | `packages/core/src/clinicalRecord/`, `clinicalSession/`, `clinicalTimeline/` |
| WhatsApp e comunicação | `packages/core/src/communication/`, `apps/web/src/server/application/communicationService.ts`, `viverMaisWhatsApp.ts` e `apps/web/src/server/communication/` |
| Autenticação e autorização | `apps/web/src/server/auth.ts`, `security/`, `application/context.ts` e `packages/core/src/identity/` |
| MySQL e repositórios | `apps/web/src/server/persistence/mysql/` e `apps/web/src/server/oci/runtime.ts` |
| Financeiro, pagamentos e fiscal | `packages/core/src/financial/`, `fiscal/` e `apps/web/src/server/payments/`, `fiscal/` |
| Documentos psicológicos | `apps/web/src/server/documents/` e `packages/core/src/psychologicalDocuments.ts` |
| Acadêmico e certificados de cursos | `apps/web/src/server/academic/`, `certificados/` e `packages/core/src/academic/`, `certificados/` |
| Schema, migrations e infraestrutura | `infra/mysql/`, `infra/clinic/` e `infra/evolution/` |
| Contexto de negócio e reuniões | `docs/produto/` e `docs/levantamentos/` |
| Especificações e planos | `docs/superpowers/specs/` e `docs/historico/planos/` |

## Limites de arquitetura

- `apps/web` contém a aplicação Next.js, suas APIs e integrações de servidor. Consulte [seu guia](apps/web/AGENTS.md).
- `packages/core` concentra regras de negócio e contratos compartilhados; não deve depender de `apps/web` ou do Next.js. Consulte [seu guia](packages/core/AGENTS.md).
- Schema e migrations MySQL ficam em `infra/mysql/`, e não no core. Leia o runner antes de adicionar uma migration; não renumere nem reescreva migrations já aplicadas.
- O nome `server/oci` permanece por compatibilidade. A infraestrutura vigente usa Hostinger, não OCI.
- O módulo acadêmico ainda existe aqui. Leia o [plano de extração](docs/historico/planos/2026-10-23-extracao-plataforma-educacional.md) antes de uma tarefa nessa fronteira. Não remova módulos, rotas ou tabelas apenas porque o plano prevê sua remoção futura.

## Regras de implementação

- Mantenha componentes modulares com **menos de 250 linhas**. Ao ampliar um componente, extraia responsabilidades quando necessário.
- Preserve isolamento por organização e permissões de gestão/psicólogo/aluno. Não aceite identidade enviada pelo cliente como substituta da sessão validada.
- Preserve os requisitos de privacidade de CFP/LGPD: criptografia em repouso dos registros clínicos e anonimização no fluxo de supervisão. Não declare conformidade ou garantia sem verificar o controle correspondente.
- Não exponha conteúdo clínico, documentos, telefones ou segredos em logs, fixtures, commits ou mensagens. Use dados fictícios nas verificações.
- Mantenha idempotência e proteção contra duplicação nos fluxos de comunicação e cobrança. Testes não devem disparar mensagens reais nem emitir cobranças ou notas reais.
- Não publique segredos em variáveis `NEXT_PUBLIC_*`. Use `.env.example` para conhecer os nomes; não imprima arquivos privados de ambiente.

## Comandos e validação

Execute na raiz, com Node.js compatível com `.nvmrc` e dependências instaladas por `npm ci`.

| Escopo | Comando |
| --- | --- |
| Aplicação local | `npm run web:dev` |
| Lint | `npm run lint` |
| Tipos dos dois workspaces | `npm run typecheck` |
| Testes do domínio | `npm run test --workspace @thats-life/core` |
| Testes da aplicação | `npm run test --workspace @thats-life/web` |
| Build | `npm run web:build` |
| Verificação completa do CI | `npm run check` |

Para alterações de código, execute os testes relevantes e as verificações exigidas pelo escopo; antes de publicação, use `npm run check`. Para mudanças apenas documentais, valide caminhos, links e o diff. Informe o que foi executado e eventuais falhas preexistentes, sem afirmar que verificações não executadas passaram.

`db:migrate` altera o banco configurado por `MYSQL_ADMIN_URL`; `db:reset` apaga o volume local. Scripts de seed e deploy também têm efeitos externos. Leia o script e confirme o ambiente e o escopo autorizado antes de executá-los; não os use como verificação de documentação.

## Regra de deploy Vercel + Hostinger

O projeto **`clinica-viver-web` é construído pela raiz do monorepo** e deve servir diretamente esta aplicação. **Nunca adicione rewrite global de `/:path*`** em `vercel.json` ou `next.config.mjs`. Somente as rotas de API específicas podem seguir para `app.clinicavivermais.cloud`.

As instruções vigentes estão em [Hostinger VPS](docs/operacao/hostinger-vps.md) e [Vercel](docs/operacao/vercel-setup-guia.md). Guias em `docs/historico/` não são roteiros de produção.

## Organização de novos arquivos

- Deixe na raiz os arquivos de entrada e configuração do monorepo.
- Guarde documentação na categoria indicada por [docs/README.md](docs/README.md), seguindo [docs/AGENTS.md](docs/AGENTS.md).
- Especificações históricas ficam em `docs/superpowers/specs/`; planos históricos, em `docs/historico/planos/`, com a seção final “Pendências conhecidas”. Por assunto, consulte o documento de data mais recente.
- Imagens originais de marca ficam em `docs/design/assets/`; arquivos servidos pela aplicação ficam em `apps/web/public/`.
- Exportações ficam em `output/`; projetos de vídeo em `videos/`, respeitando as instruções locais.
- Evite varrer dependências, `.next/`, `.git/`, caches, PDFs e vídeos quando a tarefa só exigir código ou texto.
- Ao mover arquivos, atualize links relativos e referências em planos e registre origem/destino. Não exclua materiais ou substitua mudanças do usuário como parte de uma organização.
