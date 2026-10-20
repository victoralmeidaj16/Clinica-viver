# Solicitação de reagendamento pelo paciente

## Objetivo

O paciente não pode mais alterar sozinho a data de uma sessão. Ao escolher outro horário, ele envia uma solicitação ao psicólogo. A sessão só muda depois que o psicólogo aceitar.

## Comportamento aprovado

1. O paciente abre o fluxo atual de reagendamento e escolhe o horário desejado.
2. Ao confirmar, o sistema mantém o horário atual da sessão e grava uma solicitação pendente.
3. A tela do paciente informa: “Reagendamento solicitado ao psicólogo. Seu horário atual continua válido enquanto você aguarda a resposta.”
4. O psicólogo recebe a solicitação na agenda, com horário atual, horário solicitado e botões “Aceitar” e “Recusar”.
5. Somente “Aceitar” altera a sessão para o horário solicitado.
6. “Recusar” encerra a solicitação e mantém a sessão no horário atual.

O prazo mínimo de antecedência que já existe no reagendamento público continua inalterado. Esta entrega não acrescenta reserva do horário solicitado, expiração automática, contraproposta ou negociação por mensagens.

## WhatsApp do psicólogo

Assim que a solicitação for gravada, o psicólogo recebe uma mensagem com:

- nome do paciente;
- frase explícita de que o paciente **solicitou** um reagendamento;
- horário atual;
- horário solicitado;
- link direto para a agenda da plataforma, focado na sessão, para aceitar ou recusar.

Texto-base:

> Olá, {psicólogo}! {paciente} solicitou um reagendamento.
>
> Horário atual: {data e hora}
> Horário solicitado: {data e hora}
>
> Acesse a plataforma para aceitar ou recusar: {link}

A mensagem nunca deve dizer que a sessão “foi remarcada” antes do aceite. Falha no envio não desfaz a solicitação gravada.

## Persistência

Criar uma tabela de solicitações com:

- identificador;
- instituição;
- agendamento, paciente e psicólogo;
- horário atual no momento do pedido;
- horário e modalidade solicitados;
- status `pendente`, `aceita` ou `recusada`;
- data da solicitação e data da resposta.

Só pode existir uma solicitação pendente por agendamento. Uma nova tentativa enquanto houver pedido pendente informa ao paciente que ele já aguarda resposta.

## Aceite

O aceite é autenticado e só pode ser feito pelo psicólogo responsável pela sessão. Dentro de uma transação, o sistema:

1. confirma que a solicitação continua pendente;
2. confirma que a sessão ainda possui o horário registrado no pedido;
3. verifica se o horário solicitado continua livre;
4. atualiza data, hora, duração, modalidade e versão da sessão;
5. marca a solicitação como aceita;
6. executa o ajuste de cobrança e os avisos de remarcação já existentes.

Se o horário não estiver mais disponível, nada muda e o psicólogo recebe uma mensagem clara para recusar o pedido e orientar o paciente.

## Recusa

Ao recusar, o sistema marca a solicitação como recusada e mantém integralmente o agendamento atual. O paciente deve receber a informação de que a mudança não foi aceita e que o horário anterior continua válido.

## Interface do paciente

Depois do envio, o paciente vê o horário confirmado e, separadamente, o horário solicitado com o estado “Aguardando resposta do psicólogo”. O conteúdo não mostra confirmação de reagendamento nem apresenta o novo horário como definitivo.

## Interface do psicólogo

Na área “Sessões e confirmações”, a sessão exibe um bloco destacado contendo:

- “Reagendamento solicitado”;
- nome do paciente;
- horário atual;
- horário solicitado;
- botões “Aceitar” e “Recusar”.

As ações bloqueiam cliques repetidos, mostram erro sem esconder a sessão e atualizam a agenda após a resposta.

## Testes

- solicitar não altera o agendamento;
- a resposta pública usa “solicitado”, nunca “reagendado”;
- só existe uma solicitação pendente por sessão;
- o WhatsApp do psicólogo contém os dois horários e o link da plataforma;
- falha do WhatsApp não desfaz a solicitação;
- somente o psicólogo responsável pode decidir;
- aceitar altera a sessão e aciona cobrança e avisos existentes;
- conflito no aceite não altera a sessão;
- recusar mantém a sessão atual;
- telas de paciente e psicólogo exibem os estados corretos.

## Migração e publicação

A migração da nova tabela deve ser aplicada antes da versão da aplicação que a consulta. Sessões existentes não precisam de conversão.

