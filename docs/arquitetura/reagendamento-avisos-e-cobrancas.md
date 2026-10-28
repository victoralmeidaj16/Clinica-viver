# Remarcação: avisos e ajuste financeiro

Antes de publicar esta versão, aplicar as migrações pendentes, incluindo `infra/mysql/069_agenda_avisos_reenvio.sql`, pelo fluxo `npm run db:migrate` com a conexão administrativa do ambiente. A migração é reexecutável e mantém os avisos já registrados.

A remarcação grava o novo horário e a intenção de ajustar o vencimento na mesma transação. Após o commit, os avisos de WhatsApp são enviados aos dois contatos e o ajuste financeiro é processado. Os avisos usam a versão do agendamento para distinguir remarcações sucessivas e continuam sujeitos à allowlist e à configuração da Evolution API.

Nenhuma chamada de cancelamento ao provedor é feita com a agenda travada. Cada cancelamento confirmado é conciliado em uma transação própria. Uma falha mantém o trabalho pendente e bloqueia a emissão de checkout de todas as sessões envolvidas, inclusive os outros membros do grupo.

A retomada usa a rotina existente `POST /api/application/financial/charges/expire`, protegida por `x-billing-expiry-token`. Manter sua execução periódica configurada. A resposta inclui `dueResets` com quantidades concluídas, pendentes e já pagas. Pagamentos identificados como liquidados são preservados; sua conciliação contábil continua pelo webhook existente.

Os trabalhos ficam em `financeiro_ajustes_vencimento`, com `situacao` e o plano restante para diagnóstico. Os avisos ficam em `clinica_agenda_avisos`, identificados também por `versao`. Falhas de envio e reservas abandonadas são retomadas pela varredura de avisos durante o horário comercial. A fila guarda apenas horários e modalidade necessários para reconstrução; avisos desatualizados são descartados. A reserva durável de entrega impede reenvio quando o resultado do provedor é desconhecido; nesses casos, é necessária conferência operacional.

Se a sessão for cancelada e o cancelamento da cobrança falhar, a agenda mantém a opção “Conferir cancelamento” para nova tentativa, inclusive após recarregar a página. A retomada financeira nesse fluxo depende de ação do profissional.

O pós-sessão reutiliza a cobrança vinculada ao agendamento ou à sessão clínica, preservando valor, vencimento e pagamentos. Se já houver mais de uma cobrança para o mesmo atendimento, o fluxo pede conferência da gestão; não remove nem escolhe uma dívida automaticamente.

A emissão de cartão, individual ou agrupada, reserva o checkout antes da chamada ao Asaas. Os códigos `CARD_ISSUING` e `CARD_UNKNOWN` em `financeiro_checkouts_asaas.erro_codigo` impedem outra emissão quando o resultado é incerto. Uma nova tentativa consulta o pagamento pela referência externa e conclui o vínculo quando o encontra. Se o provedor continuar sem retornar o pagamento, é necessária conferência operacional antes de liberar outra emissão; essas reservas não expiram automaticamente.

A conciliação distribui cada recebimento sobre o saldo restante das sessões. Liquidações Pix diferentes acumulam valores; eventos do mesmo pagamento Asaas atualizam seu total sem somá-lo novamente ou reduzi-lo por uma entrega antiga.
