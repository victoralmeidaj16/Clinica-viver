# Documentação

Este guia complementa o [AGENTS.md da raiz](../AGENTS.md). Use [README.md](README.md) como índice e leia somente o material relacionado à tarefa.

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

Os manuais e suas fontes mantêm os caminhos existentes. O documento de comunicação persistente em trabalho também foi preservado em `docs/comunicacao-persistente.md`; não o duplique ao consultar esse assunto.

## Como escrever e organizar

- Escreva em português e use nomes descritivos. Para novos registros datados, prefira `YYYY-MM-DD-assunto.md`; preserve nomes existentes quando apenas mudar a pasta.
- Identifique objetivo, data e estado quando relevantes: levantamento, proposta, especificação, plano, procedimento ou histórico. Não marque uma implementação como concluída com base apenas no plano.
- Diferencie comportamento observado no código, requisitos e pendências. Indique os arquivos que sustentam afirmações técnicas.
- Use links relativos para documentos e arquivos do repositório. Caminhos em exemplos de comandos devem partir do diretório de execução declarado.
- Ao mover um documento, revise links de entrada, links internos e referências em texto ou comandos; atualize o índice e registre origem/destino.
- Não transforme relatórios de operação em instruções para executar novamente limpezas ou resets.
- Não registre senhas, tokens, documentos clínicos ou dados pessoais reais. Preserve a exclusão do Git dos materiais externos já ignorados.
- Valide links locais e `git diff --check` em alterações documentais; testes da aplicação são necessários apenas quando houver impacto no código ou na execução.
