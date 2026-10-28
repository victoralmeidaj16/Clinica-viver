# Documentação

Este guia complementa o [AGENTS.md da raiz](../AGENTS.md). Use [README.md](README.md) como índice e leia somente o material relacionado à tarefa.

As instruções desta pasta se aplicam à documentação da Clínica Viver Mais. Os nomes internos `thats-life` e `@thats-life/*` ainda são usados pelo código; não são evidência de que um documento pertence a outro projeto. Confira conteúdo, caminhos e decisões vigentes.

## Destino de novos documentos

| Conteúdo | Pasta |
| --- | --- |
| Escopo e jornadas do produto | `produto/` |
| Arquitetura, contratos e fluxos técnicos | `arquitetura/` |
| Deploy, integrações e procedimentos operacionais | `operacao/` |
| Reuniões, pesquisas e propostas | `levantamentos/` |
| Identidade visual e imagens originais | `design/` e `design/assets/` |
| Material externo de consulta | `referencias/`, respeitando as regras do Git |
| Infraestrutura substituída e operações datadas | `historico/` |
| Especificações de mudanças | `superpowers/specs/` |
| Planos históricos e pendências conhecidas | `historico/planos/` |

Os caminhos da tabela são relativos a `docs/`. Os manuais HTML/PDF, o mapa do psicólogo e suas fontes em `manual-psicologo-fonte/` mantêm os caminhos existentes. O documento `comunicacao-persistente.md` também permanece diretamente nesta pasta; não crie uma segunda versão em `arquitetura/`.

Mantenha o índice em `README.md` e o registro de estrutura e movimentações em [organizacao-arquivos.md](organizacao-arquivos.md). Documentação junto à infraestrutura permanece em `infra/clinic/README.md` e `infra/evolution/README.md`. Projetos de vídeo ficam em `videos/`; novas exportações gerais, em `output/`.

O manual disponibilizado pela rota `/ajuda` fica em `apps/web/public/ajuda/manual-pratico-psicologo.pdf`, com caminho a partir da raiz. Ao atualizar os manuais em `docs/`, confira também a página, o conteúdo em `apps/web/src/lib/ajuda/` e os componentes em `apps/web/src/components/ajuda/`. Não presuma sincronização automática entre as cópias.

## Como escrever e organizar

- Escreva em português e use nomes descritivos. Para novos registros datados, prefira `YYYY-MM-DD-assunto.md`; preserve nomes existentes quando apenas mudar a pasta.
- Identifique objetivo, data e estado quando relevantes: levantamento, proposta, especificação, plano, procedimento ou histórico. Não marque uma implementação como concluída com base apenas no plano.
- Diferencie comportamento observado no código, requisitos e pendências. Indique os arquivos que sustentam afirmações técnicas.
- Não restaure o fluxo integrado de “1 clique: SOAP + tarefas + cobrança” como prioridade: ele foi retirado do escopo, conforme esclarecimento do responsável em 28/10/2026. Trate menções antigas como decisões a revisar, sem inferir a remoção dos módulos individuais.
- Comece pelo registro mais recente do assunto, mas confirme sua validade com decisões atuais e implementação. Identifique divergências; não transforme planos históricos em comprovação de funcionalidades.
- Use links relativos para documentos e arquivos do repositório. Caminhos em exemplos de comandos devem partir do diretório de execução declarado.
- Ao mover um documento, revise links de entrada, links internos e referências em texto ou comandos; atualize o índice e registre origem/destino.
- Preserve o histórico de movimentações e acrescente a data de cada nova conferência. Diferencie verificação de existência dos arquivos de revisão de conteúdo ou validação em produção.
- Não transforme relatórios de operação em instruções para executar novamente limpezas ou resets.
- Não registre senhas, tokens, documentos clínicos ou dados pessoais reais. Preserve a exclusão do Git dos materiais externos já ignorados.
- Valide links locais e `git diff --check` em alterações documentais; testes da aplicação são necessários apenas quando houver impacto no código ou na execução.
