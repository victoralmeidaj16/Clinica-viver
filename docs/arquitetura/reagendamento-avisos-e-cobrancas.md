# Remarcação: avisos e ajuste financeiro

Antes de publicar esta versão, aplicar `infra/mysql/050_reagendamento_avisos_cobrancas.sql` pelo fluxo `npm run db:migrate` com a conexão administrativa do ambiente. A migração é reexecutável e mantém as confirmações já registradas.

A remarcação grava o novo horário e a intenção de ajustar o vencimento na mesma transação. Após o commit, os avisos de WhatsApp são enviados aos dois contatos e o ajuste financeiro é processado. Os avisos usam a versão do agendamento para distinguir remarcações sucessivas e continuam sujeitos à allowlist e à configuração da Evolution API.

Nenhuma chamada de cancelamento ao provedor é feita com a agenda travada. Cada cancelamento confirmado é conciliado em uma transação própria. Uma falha mantém o trabalho pendente e bloqueia a emissão de checkout de todas as sessões envolvidas, inclusive os outros membros do grupo.

A retomada usa a rotina existente `POST /api/application/financial/charges/expire`, protegida por `x-billing-expiry-token`. Manter sua execução periódica configurada. A resposta inclui `dueResets` com quantidades concluídas, pendentes e já pagas. Pagamentos identificados como liquidados são preservados; sua conciliação contábil continua pelo webhook existente.

Os trabalhos ficam em `financeiro_ajustes_vencimento`, com `situacao` e o plano restante para diagnóstico. Os avisos ficam em `clinica_agenda_avisos`, agora identificados também por `versao`. Falha de WhatsApp não desfaz o reagendamento; este fluxo mantém o envio de melhor esforço já usado na marcação.
