# Valor personalizado por paciente — Design

## Objetivo e resultado esperado

A Gestão deve poder configurar, no cadastro administrativo de cada paciente, a
categoria financeira da sessão e, quando necessário, um valor individual. A
necessidade é manter pacientes em valores acordados anteriormente sem alterar a
tabela padrão de um psicólogo nem o preço de outros pacientes.

Uma alteração de configuração afeta somente agendamentos criados depois de ela
ser salva. O valor já gravado em um agendamento, uma cobrança existente, um
pagamento ou uma sessão concluída nunca é recalculado.

## Escopo

O recurso fica no drawer de detalhes do paciente em **Gestão de Pacientes**,
sem revelar conteúdo clínico. A área exibirá a modalidade/serviço solicitado
pelo paciente como contexto e a seção **Categoria e valor da sessão** com:

- categorias `Acessível`, `Particular` e `Personalizado`;
- campo monetário em BRL habilitado e obrigatório para `Personalizado`;
- resumo da configuração ativa (modalidade/serviço, categoria e valor por
  sessão);
- explicação de que o valor personalizado é restrito àquele paciente e só se
  aplica a novos agendamentos;
- opção explícita de substituir uma configuração personalizada por Acessível
  ou Particular.

`Acessível` e `Particular` não guardam preço próprio: usam, respectivamente,
o valor social e o valor padrão do psicólogo que atenderá o paciente. A
categoria `Personalizado` guarda um valor em centavos no paciente e vence os
valores do profissional para novos agendamentos.

## Modelo de dados

Uma nova migração idempotente acrescentará a `clinica_pacientes`:

- `categoria_valor_sessao`: `NULL`, `acessivel`, `particular` ou
  `personalizado`;
- `valor_sessao_personalizado_centavos`: inteiro positivo, nulo exceto para a
  categoria `personalizado`.

`NULL` em ambos preserva a regra legada: a modalidade declarada na triagem
define se a sessão usa o valor social ou o valor padrão do profissional. Isso
evita alterar automaticamente pacientes já cadastrados.

A operação de atualização será limitada a usuários de Gestão (owner, admin ou
direção clínica, conforme a autorização administrativa já usada no módulo),
escopada por instituição e organização. Ela valida a categoria e aceita valor
entre 1 centavo e o limite seguro de inteiro monetário; o navegador envia BRL,
mas a API converte e persiste apenas centavos inteiros.

## Resolução de preço e histórico

Será criada uma única regra de resolução do preço de uma nova sessão:

1. Categoria personalizada com valor válido do paciente: usa esse valor.
2. Categoria acessível: usa `valor_social_centavos` do profissional vinculado.
3. Categoria particular: usa `valor_sessao_centavos` do profissional vinculado.
4. Sem configuração: mantém a regra legada baseada na modalidade da triagem.

Todo caminho que cria `clinica_agendamentos` consultará essa regra dentro do
fluxo de criação e gravará o resultado em `clinica_agendamentos.valor_centavos`.
O checkout e a cobrança continuam a preferir esse snapshot; portanto, editar
o paciente depois não modifica agendamentos existentes, inclusive os futuros
que já foram criados antes da edição.

O preço não é recebido de uma rota pública, do link de agenda nem de um corpo
de criação de cobrança. É sempre resolvido no servidor a partir do paciente e
do profissional efetivamente vinculados.

## Interface e contrato

O payload de Gestão que lista pacientes passará a expor a configuração
financeira atual e o valor efetivo exibível. O drawer receberá um painel
isolado, responsável pelo estado do formulário, máscara `R$ 0,00`, feedback de
salvamento e tratamento de erro. O botão geral de edição cadastral permanece
focado em dados pessoais/endereço; a configuração financeira fica disponível
mesmo sem abrir esse modal.

Uma rota administrativa específica atualizará somente essa configuração. Ela
não aceitará IDs de profissional, valores de cobrança nem dados clínicos. Após
sucesso, a listagem administrativa será recarregada para refletir o resumo.

## Erros e segurança

- Valor personalizado ausente, zero, negativo, malformado ou fora do limite é
  rejeitado com erro de entrada.
- Categoria desconhecida é rejeitada.
- Um usuário sem papel administrativo recebe 403 e não pode ler nem alterar a
  configuração por essa rota.
- Paciente inexistente ou fora da organização recebe 404, sem expor dados de
  outra organização.
- Falha de persistência não fecha o drawer nem faz o cliente exibir um valor
  como salvo.

## Testes de aceitação

- A API autoriza Gestão e recusa profissional sem privilégio administrativo.
- As três categorias persistem conforme suas regras; só Personalizado aceita e
  exige valor próprio.
- A remoção da personalização retorna à resolução padrão, sem alterar sessões
  prévias.
- A identificação do paciente para agenda resolve preço personalizado antes de
  social/particular e o `INSERT` do novo agendamento recebe esse valor.
- Alterar a categoria ou o valor depois de um agendamento não altera o
  `valor_centavos` dele nem de sua cobrança.
- O painel mostra a categoria, o valor formatado e mensagens de validação;
  somente Gestão consegue salvar.

## Fora de escopo

Não haverá tabela de reajustes por vigência, histórico de versões da condição
comercial, edição de valor de uma cobrança emitida ou alteração em lote de
pacientes. Esses casos exigem regras de auditoria e reconciliação financeira
próprias e não são necessários para preservar os valores legados atuais.
