# Acessibilidade do paciente — plano de implementação

Objetivo: perguntar sobre deficiência/necessidade de acessibilidade no cadastro manual e nos agendamentos público e manual.

Arquitetura: campo JSON opcional no cadastro do paciente, reutilizado pelos três formulários. A pergunta aceita Sim, Não e Prefiro não informar; em Sim, permite descrever adaptações em até 1.000 caracteres. Sem solicitar diagnóstico. Os dados seguem as permissões existentes de paciente/organização.

- [x] Criar validação compartilhada e componente de formulário; testar respostas inválidas, descrição longa e limpeza ao selecionar Não.
- [x] Adicionar migration idempotente e leitura/escrita no cadastro, incluindo edição e listagem autorizada. Preservar informações quando clientes antigos omitirem o campo.
- [x] Incluir pergunta no cadastro e nos agendamentos. Carregar dados existentes e salvar somente após autorização; no link público salvar na mesma transação da reserva.
- [x] Executar testes relevantes, tipos e lint; conferir o diff.

## Pendências conhecidas

Implementado e validado em 05/11/2026: lint sem erros (46 avisos existentes), tipos, 195 testes do domínio, 1.519 testes da aplicação e build de produção. O build precisou ser repetido fora do sandbox porque o Turbopack não conseguiu abrir sua porta de compilação.

A migration `079_paciente_acessibilidade.sql` ainda precisa ser aplicada no banco do ambiente de publicação antes de disponibilizar esta versão. Não foi realizado deploy nem teste no navegador em produção nesta tarefa.
