# Checklist de testes da plataforma

Última atualização: 13/11/2026, depois da rodada no navegador.

Este checklist junta três registros: a rodada de 28/10 ([testes-plataforma-2026-10-28.md](testes-plataforma-2026-10-28.md)), o informativo de 11/11 ([informativo-verificacao-2026-11-11.md](informativo-verificacao-2026-11-11.md)) e o documento da equipe `ERROS E ACERTOS - PLATAFORMA CLÍNICA.docx`, editado pela última vez em 05/11. A rodada de 13/11 foi feita no navegador, em produção.

**Status**

- ✅ **OK**: testado e funcionando.
- ❌ **Erro**: testado e com falha. Precisa de correção.
- 🔁 **Retestar**: falta salvar para confirmar, ou falta conferir na tela.
- ⏳ **Pendente**: ainda não testado.
- 📝 **Ajuste**: pedido de mudança de regra ou conteúdo. Não é falha de funcionamento.

**Origem**: `28/10`, `11/11` e `13/11` são as rodadas registradas. `Equipe` é o docx de 05/11.

**Dados de teste**: os psicólogos e pacientes cadastrados até 13/11 são contas de teste da equipe. Ações que disparam WhatsApp, cobrança no Asaas ou NFS-e mandam mensagem ou cobrança de verdade. Por isso, combine antes de executá-las.

---

## Resumo

| Área | ✅ | ❌ | 🔁 | ⏳ | 📝 |
| --- | --- | --- | --- | --- | --- |
| Painel do psicólogo | 12 | 5 | 1 | 2 | 0 |
| Painel da gestão | 9 | 1 | 1 | 2 | 0 |
| Site e cadastros públicos | 8 | 2 | 0 | 0 | 0 |
| Fluxos e WhatsApp | 0 | 1 | 0 | 2 | 3 |
| Contrato | 0 | 0 | 0 | 0 | 1 |
| Testes automatizados e infraestrutura | 6 | 0 | 0 | 1 | 0 |
| **Total** | **35** | **9** | **2** | **7** | **4** |

---

## 1. Painel do psicólogo

### Meu cadastro

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| PSI-01 | Psicólogo recebe notificação quando a gestão aceita a alteração do perfil | Equipe | ❌ Erro | O commit `6633e15` avisa a **gestão** sobre a solicitação. Nada indica que o psicólogo passou a ser avisado do aceite. |
| PSI-02 | Na edição do perfil aparecem as durações de 50 min e 1h30 | Equipe | ✅ OK | 13/11: a edição do perfil não mostra nenhuma opção de duração. Conferido com um psicólogo com pós em Avaliação. |
| PSI-03 | Troca de pós-graduação exige novas escolhas e gera aviso à gestão | 11/11 | ⏳ Pendente | Para testar é preciso salvar uma troca de pós. |

### Meus pacientes

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| PSI-04 | Formulário de cadastro abre, vincula o paciente ao psicólogo e bloqueia envio vazio | 28/10 | ✅ OK | |
| PSI-05 | Escolher o serviço habilita a modalidade | 28/10 | ✅ OK | |
| PSI-06 | No cadastro manual, o psicólogo escolhe qualquer serviço, mesmo os que não atende pela clínica | Equipe | ✅ OK | 13/11: o cadastro oferece só o serviço homologado (Avaliação Psicológica). O **agendamento**, porém, ainda oferece todos (ver PSI-18). |
| PSI-07 | Cadastro aceita Particular junto com Conveniado = Sim, mas o sistema descarta o convênio sem avisar | 28/10 | ❌ Erro | Não foi retestado em 13/11. Detalhes no relatório de 28/10. |
| PSI-08 | Período e origem são opcionais e existe o campo de acessibilidade | 11/11 | ✅ OK | 13/11: os dois aparecem como "(opcional)" e o bloco de acessibilidade está presente. |
| PSI-09 | Agendamento manual de paciente **conveniado** mostra data de vencimento, mas quem paga é a empresa | Equipe | ✅ OK | 13/11: não aparece vencimento. A tela mostra "Custeado por Alvet Hospital Veterinário, sem cobrança ao paciente". |
| PSI-10 | Paciente encaminhado para outro psicólogo: o novo psicólogo recebe "primeiro contato há 15 dias", dado que pertence ao psicólogo anterior | Equipe | ❌ Erro | A contagem deve reiniciar no encaminhamento. |
| PSI-11 | Psicólogo não consegue registrar no prontuário | Equipe | ✅ OK | 13/11: registro salvo no Paciente Teste (HTTP 201) e exibido no histórico. O título é "TESTE PLATAFORMA 13/11 (PSI-11), pode apagar". |
| PSI-18 | No "Agendar" do paciente aparecem os 5 serviços (inclusive Psicoterapia de Casal), mas o psicólogo só tem Avaliação Psicológica homologada | 13/11 | ❌ Erro | Encontrado em 13/11. O cadastro de paciente já restringe. O agendamento precisa da mesma restrição. |

### Agenda e horários

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| PSI-12 | Agenda e formulário manual abrem; datas personalizadas atualizam o contador; dias passados ficam bloqueados | 28/10 | ✅ OK | 13/11: as abas "Sessões e confirmações" e "Agenda e disponibilidade" e o resumo da grade aparecem. |
| PSI-13 | Sem pacientes, o seletor fica vazio e o botão de confirmar fica desabilitado | 28/10 | ✅ OK | |
| PSI-14 | Disponibilidade: grade e resumo carregam; bloqueio sem datas é impedido | 28/10 | ✅ OK | |
| PSI-15 | Psicólogo registra falta na sessão e decide se cobra ou não | Equipe | ✅ OK | 13/11: "Registrar falta" pergunta "Esta sessão será cobrada do paciente?" e oferece "Cobrar a sessão" e "Não cobrar". O diálogo foi aberto, mas não confirmado. |
| PSI-16 | Reagendamento pela interface | 28/10 | ⏳ Pendente | Existe uma sessão de teste (03/11). Para testar é preciso salvar, e isso pode disparar WhatsApp. |
| PSI-19 | Sessão de paciente conveniado mostra ao mesmo tempo "Custeado por Alvet, sem cobrança" e "PAGAMENTO: PAGO · PIX" | 13/11 | 🔁 Retestar | **Causa:** a sessão foi marcada pelo link em 29/10 e gerou uma cobrança particular de R$ 75, paga por Pix. Depois o paciente passou a ser do convênio. A regra de custeio usada antes da confirmação ignorava a cobrança individual já existente (a confirmação já a respeitava). Isso também podia incluir a sessão na fatura da empresa. **Correção** em `custeioSql.ts`: cobrança individual ativa decide que o paciente paga. Testes: 1602 de 1602. Na produção só essa sessão de teste muda. **Falta** o deploy na VPS e conferir na tela. |

### Meu financeiro, Relatórios e outros

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| PSI-17 | Meu financeiro abre | Equipe | ✅ OK | 13/11: abre sem erro. Os valores não foram conferidos um a um. |
| PSI-20 | Ao abrir `/relatorios` pelo endereço, o psicólogo vê "Acesso negado: permission_missing" | 13/11 | ❌ Erro | É menor: a tela não está no menu do psicólogo. O certo seria redirecionar ou mostrar uma mensagem legível. |

## 2. Painel da gestão

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| GES-01 | Agenda da clínica: a gestão não consegue mover uma sessão para data ou horário no passado | Equipe | 🔁 Retestar | 13/11: o campo de data no "Editar Atendimento" não tem limite mínimo, então a tela aceita data passada. Falta salvar para ver se o servidor recusa. Decidir também se a gestão **deve** poder fazer isso. |
| GES-02 | Agenda da clínica: lista de sessões, edição e vencimento | 11/11 | ✅ OK | 13/11: a lista carrega com paginação. Sessões pagas por empresa não mostram "Editar vencimento", o que está correto. |
| GES-03 | Gestão de psicólogos: posição no rodízio aparece no card | 11/11 | ✅ OK | 13/11: por exemplo "Rodízio geral: 6º de 7". Contadores: 8 no rodízio, 1 pausado. |
| GES-04 | Gestão de pacientes abre | Equipe | ✅ OK | 13/11: abre sem erro. |
| GES-05 | Painel da clínica carrega e mostra a fila de triagem e os credenciamentos | 11/11 | ✅ OK | |
| GES-06 | Financeiro e repasses abre | 11/11 | ✅ OK | 13/11: abre sem erro. O modal de vencimento foi visto pela agenda. |
| GES-07 | Checkout não mostra detalhe de erro interno | 11/11 | ⏳ Pendente | Commit `0c0fb33`. Precisa de um link de pagamento. |
| GES-08 | Indicadores mensais abrem | Equipe | ✅ OK | 13/11: abre sem erro para a gestão. |
| GES-09 | Convênios PJ: fatura, painel de revisão e NFS-e | 11/11 | ⏳ Pendente | 13/11: a página abre sem erro. Falta abrir uma fatura e o painel de revisão, sem emitir. |
| GES-10 | Integrações (Asaas e WhatsApp) abrem | Equipe | ✅ OK | 13/11: abre sem erro. |
| GES-11 | Sino de notificações | 11/11 | ✅ OK | 13/11: abre com 3 não lidas e o histórico. |
| GES-12 | Ajuda abre | Equipe | ✅ OK | |
| GES-13 | A notificação de alteração de perfil mostra o nome técnico do campo: "temposAtendimento: — → 90, 50" | 13/11 | ❌ Erro | Menor. Trocar por um rótulo legível, como "Tempos de atendimento: 50 e 90 min". |

## 3. Site e cadastros públicos

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| SITE-01 | Link público: CPF obrigatório e 000.000.000-00 rejeitado | 28/10 | ✅ OK | |
| SITE-02 | Convênios: escolher Sim carrega as empresas parceiras | 28/10 | ✅ OK | |
| SITE-03 | Paciente agendando: pergunta sobre necessidade de acessibilidade | Equipe | ❌ Erro (parcial) | O commit `b65557c` incluiu a pergunta no link enviado ao paciente (`/agendar/[token]`) e no agendamento manual. O agendamento pelo **site** (`/vitrine`) ainda não tem o campo. Conferido no código. |
| SITE-04 | Cadastro de psicólogo: pergunta sobre acessibilidade | Equipe | ✅ OK | 13/11: "Acessibilidade do profissional" está presente. |
| SITE-05 | Cadastro de psicólogo: foto obrigatória | Equipe | ✅ OK | 13/11: aparece "Foto de Perfil \*" e o campo tem `required`. O bloqueio no envio não foi testado. |
| SITE-06 | Cadastro de psicólogo: o sistema diz que o e-mail já existe, mas não há psicólogo com esse e-mail | Equipe | ✅ Encerrado | 13/11: o bloqueio funciona como projetado. A causa provável é um WhatsApp repetido em dois contatos, confirmado pela equipe. Encerrado a pedido, sem reproduzir. Não há login sobrando de conta apagada. |
| SITE-07 | Cadastro de psicólogo: ao escolher pós em neuro ou avaliação, aparece a seleção de duração | Equipe | ✅ OK | 13/11: nem com Neuropsicologia nem com Avaliação aparece a seleção de duração. |
| SITE-08 | Vitrine abre | Equipe | ✅ OK | 13/11. |
| SITE-09 | Login | Equipe | ✅ OK | 13/11: login de gestão e de psicólogo funcionam. |
| SITE-10 | Existem dois cadastros aprovados com o mesmo e-mail (viv…@gmail.com) e o mesmo WhatsApp (final 5675, o número da clínica), presos a um único login | 13/11 | ❌ Erro | Encontrado na consulta à produção. Os IDs são `5cc81c4c` (08/10) e `1ad74b00` (16/10). Pelo código, editar o perfil dessa conta deve falhar com o erro de cadastro duplicado. Decidir qual cadastro fica. |

## 4. Fluxos e WhatsApp

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| FLX-01 | Paciente não recebe a mensagem certa | Equipe | ❌ Erro | Falta detalhar qual mensagem, em qual etapa e o que deveria chegar. |
| FLX-02 | Mensagem de agendamento diz "responda para remarcar ou cancelar", mas responder não faz nada | Equipe | 📝 Ajuste | Pedido: trocar por um link de solicitação de remarcação ou por contato direto com o profissional. |
| FLX-03 | Comprovante de Aceite Eletrônico: o psicólogo só recebe depois da aprovação da gestão, junto com o e-mail de criar senha. O admin continua recebendo na solicitação | Equipe | 📝 Ajuste | |
| FLX-04 | Declaração de estágio: só contam sessões confirmadas pelo psicólogo, pagas ou não | Equipe | 📝 Ajuste | Regra de negócio a implementar ou conferir. |
| FLX-05 | Triagem: protocolo único, sem duplicidade | 11/11 | ⏳ Pendente | Commit `ab7897b`. Exige registrar uma triagem. |
| FLX-06 | Encaminhamento de lead ao psicólogo: decisão só pelo link e sem resposta automática a saudação | — | ⏳ Pendente | Commit `72e731c`, de 11/11. |

## 5. Contrato

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| CTR-01 | Termo de adesão atualizado em 04/11: reduzir espaçamento e margens até chegar a cerca de 5 páginas, sem cortar conteúdo | Equipe | 📝 Ajuste | |

## 6. Testes automatizados e infraestrutura

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| AUTO-01 | Lint | 11/11 | ✅ OK | |
| AUTO-02 | Typecheck (core e web) | 11/11 | ✅ OK | |
| AUTO-03 | Testes do core: 195 de 195 | 11/11 | ✅ OK | |
| AUTO-04 | Testes do web: 1637 de 1637 | 11/11 | ✅ OK | |
| AUTO-05 | Build de produção | 11/11 | ✅ OK | |
| AUTO-06 | Domínios respondem e rotas protegidas redirecionam para o login | 11/11 | ✅ OK | 13/11: 17 telas abertas nos dois perfis. Só `/relatorios` do psicólogo deu erro (PSI-20). |
| AUTO-07 | Confirmar o commit publicado na VPS (triagem e WhatsApp dependem de deploy manual) | 11/11 | ⏳ Pendente | |

---

## Próximos passos

1. **Corrigir os erros confirmados**, nesta ordem:
   - PSI-19: corrigido no código, falta o deploy na VPS;
   - SITE-10: decidir qual dos dois cadastros duplicados fica;
   - PSI-18, serviços no agendamento;
   - SITE-03, acessibilidade no agendamento pelo site;
   - PSI-10, encaminhamento;
   - os menores: PSI-20 e GES-13.
2. **Testes que exigem salvar** (precisam de autorização):
   - GES-01, data no passado;
   - PSI-03, troca de pós;
   - PSI-16, reagendamento: pode disparar WhatsApp;
   - FLX-05, triagem: dispara WhatsApp.
3. **Os 4 ajustes (📝)** dependem de decisão da equipe.

## Histórico de rodadas

| Data | Tipo | Registro |
| --- | --- | --- |
| 28/10/2026 | Interface publicada e testes automatizados | [testes-plataforma-2026-10-28.md](testes-plataforma-2026-10-28.md) |
| 05/11/2026 | Testes manuais da equipe | `ERROS E ACERTOS - PLATAFORMA CLÍNICA.docx` |
| 11/11/2026 | Lint, testes, build e rotas publicadas | [informativo-verificacao-2026-11-11.md](informativo-verificacao-2026-11-11.md) |
| 13/11/2026 | Navegador em produção (Playwright), perfis de gestão e de psicólogo, só leitura. Consulta de leitura ao banco para o SITE-06 | Este checklist. Nada foi salvo e nenhum diálogo foi confirmado |
