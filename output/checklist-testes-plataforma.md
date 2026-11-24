# Checklist de testes da plataforma

Última atualização: 24/11/2026 — ampliado com roteiro prático para execução manual sobre a produção `5850646` (mantendo o histórico de 13/11/2026). Veja também [testes-pdf-2026-11-23.md](testes-pdf-2026-11-23.md).

Este checklist junta três registros: a rodada de 28/10 ([testes-plataforma-2026-10-28.md](testes-plataforma-2026-10-28.md)), o informativo de 11/11 ([informativo-verificacao-2026-11-11.md](informativo-verificacao-2026-11-11.md)) e o documento da equipe `ERROS E ACERTOS - PLATAFORMA CLÍNICA.docx`, editado pela última vez em 05/11. A rodada de 13/11 foi feita no navegador, em produção. Na atualização de 24/11, a seção 7 reúne o roteiro completo para você executar manualmente no ambiente publicado.

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

> O resumo abaixo acompanha os 57 itens históricos das seções 1–6 (atualizados após correções publicadas até `5850646`); o roteiro prático de execução manual com checkboxes está na seção 7.

| Área | ✅ | ❌ | 🔁 | ⏳ | 📝 |
| --- | --- | --- | --- | --- | --- |
| Painel do psicólogo | 14 | 3 | 1 | 2 | 0 |
| Painel da gestão | 9 | 1 | 1 | 2 | 0 |
| Site e cadastros públicos | 8 | 2 | 0 | 0 | 0 |
| Fluxos e WhatsApp | 0 | 1 | 2 | 2 | 1 |
| Contrato | 0 | 0 | 0 | 0 | 1 |
| Testes automatizados e infraestrutura | 7 | 0 | 0 | 0 | 0 |
| **Total (seções 1–6)** | **38** | **7** | **4** | **6** | **2** |

---

## 1. Painel do psicólogo

### Meu cadastro

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| PSI-01 | Psicólogo recebe notificação quando a gestão aceita a alteração do perfil | Equipe | ✅ OK | 13/11: já estava corrigido no commit `69d3beb` (04/11), em `notificacoesDaSolicitacaoDePerfil`. O sino do psicólogo de teste mostra "Alteração de perfil aprovada". A recusa também avisa, com o motivo. O aviso fica só na plataforma, sem e-mail nem WhatsApp. |
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
| PSI-18 | No "Agendar" do paciente aparecem os 5 serviços (inclusive Psicoterapia de Casal), mas o psicólogo só tem Avaliação Psicológica homologada | 13/11 | 🔁 Retestar | Encontrado em 13/11 e corrigido no commit `1ffb8a4` (`PatientList.tsx` passou a enviar `servicosHabilitados` ao modal de agendamento). O servidor também valida (`appointmentService.ts`). Falta retestar em tela na produção `5850646`. |

### Agenda e horários

| ID | Item | Origem | Status | Observação / próximo passo |
| --- | --- | --- | --- | --- |
| PSI-12 | Agenda e formulário manual abrem; datas personalizadas atualizam o contador; dias passados ficam bloqueados | 28/10 | ✅ OK | 13/11: as abas "Sessões e confirmações" e "Agenda e disponibilidade" e o resumo da grade aparecem. |
| PSI-13 | Sem pacientes, o seletor fica vazio e o botão de confirmar fica desabilitado | 28/10 | ✅ OK | |
| PSI-14 | Disponibilidade: grade e resumo carregam; bloqueio sem datas é impedido | 28/10 | ✅ OK | |
| PSI-15 | Psicólogo registra falta na sessão e decide se cobra ou não | Equipe | ✅ OK | 13/11: "Registrar falta" pergunta "Esta sessão será cobrada do paciente?" e oferece "Cobrar a sessão" e "Não cobrar". O diálogo foi aberto, mas não confirmado. |
| PSI-16 | Reagendamento pela interface | 28/10 | ⏳ Pendente | Existe uma sessão de teste (03/11). Para testar é preciso salvar, e isso pode disparar WhatsApp. |
| PSI-19 | Sessão de paciente conveniado mostra ao mesmo tempo "Custeado por Alvet, sem cobrança" e "PAGAMENTO: PAGO · PIX" | 13/11 | ✅ Corrigido | **Publicado** em `7149c84` (Vercel e VPS) em 13/11 e conferido na tela: o psicólogo vê só "PAGO · PIX" e a gestão vê "Pago pelo paciente". **Causa:** a sessão foi marcada pelo link em 29/10 e gerou uma cobrança particular de R$ 75, paga por Pix. Depois o paciente passou a ser do convênio. A regra de custeio usada antes da confirmação ignorava a cobrança individual já existente (a confirmação já a respeitava). Isso também podia incluir a sessão na fatura da empresa. **Correção** em `custeioSql.ts`: cobrança individual ativa decide que o paciente paga. Testes: 1602 de 1602. Na produção só essa sessão de teste muda. **Falta** o deploy na VPS e conferir na tela. |

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
| FLX-03 | Comprovante de Aceite Eletrônico: o psicólogo só recebe depois da aprovação da gestão, junto com o e-mail de criar senha. O admin continua recebendo na solicitação | Equipe | 🔁 Retestar | Implementado (`ab3e4ea`/`5850646`): envio do comprovante definitivo do psicólogo ocorre somente após aprovação, mantendo envio da via da clínica após aprovação conforme `CAD-04`. Validar em tela. |
| FLX-04 | Declaração de estágio: só contam sessões confirmadas pelo psicólogo, pagas ou não | Equipe | 🔁 Retestar | Implementado (`bc348fb`, migration `091`): apuração considera apenas sessões confirmadas (pagas ou não), filtradas por período e pela duração real em horas/minutos (`AGD-07`, `AGD-09`). Validar em tela. |
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
| AUTO-07 | Confirmar o commit publicado na VPS (triagem e WhatsApp dependem de deploy manual) | 11/11 | ✅ OK | 13/11: a VPS estava em `72e731c`, o que inclui a triagem `ab7897b` e o WhatsApp `72e731c`. Depois foi atualizada para `7149c84`. |

---

## Próximos passos

1. **Corrigir os erros confirmados**, nesta ordem:
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

## 7. Roteiro prático de testes manuais para execução (24/11/2026)

Use os checkboxes abaixo ao executar a bateria de testes no ambiente publicado (`5850646`) ou em `npm run web:dev`, sempre com **dados fictícios**. Os códigos entre parênteses (`SEG-xx`, `OPS-xx`, `CAD-xx`, `ROD-xx`, `AGD-xx`, `FIN-xx`) ligam cada passo às evidências de [testes-pdf-2026-11-23.md](testes-pdf-2026-11-23.md).

### 7.1 Visitante / Acesso Público (sem login)

- [ ] **Rotas protegidas sem sessão (`SEG-01`):** em aba anônima, abrir `/gestao/cockpit`, `/pacientes`, `/linha-do-tempo`, `/gestao/financeiro` e `/convenios` → confirmar redirecionamento imediato para `/login?next=…`.
- [ ] **Vitrine, serviço unificado e convênios (`CAD-01`, `SITE-02`, `SITE-08`):** abrir `/vitrine` → confirmar o card único **Orientação Vocacional e Profissional**, lista de empresas parceiras ao marcar convênio = Sim e verificação de acessibilidade no agendamento pelo site (`SITE-03`).
- [ ] **Menor sem CPF com responsável (`ROD-15`):** na triagem pública da vitrine, marcar *"ainda não tem CPF"*, informar nome e CPF fictício do responsável → confirmar geração de protocolo mantendo o menor identificado sem misturar com o responsável.
- [ ] **Cadastro de psicólogo (`CAD-02`, `SEG-04`, `SITE-04`, `SITE-05`, `SITE-07`):** testar 17 cursos, soma de serviços/públicos ao escolher 2ª pós, obrigatoriedade da foto, campo de acessibilidade, ausência de seleção manual de duração em Neuro/Avaliação e bloqueio (HTTP 409) ao tentar cadastrar novamente mesmo e-mail, CRP ou WhatsApp.
- [ ] **Link público da agenda e custeio (`AGD-03`, `FIN-08`, `SITE-01`):** abrir `/agendar/[token]` com CPF inválido/zerado (rejeitado) e depois com CPF fictício → conferir horários filtrados pela duração do serviço/público; em sessão custeada pela empresa (`custeado = 1`), confirmar que o botão **"Ver fatura / pagar"** não aparece.
- [ ] **Checkout público e validação pública (`GES-07`, `OPS-07`, `OPS-10`):** abrir `/pagar/sessao/[token]` (inclusive com token inválido/expirado) → confirmar mensagem amigável sem stack trace/detalhe interno; abrir `/validar-certificado` e `/painel-certificados` e conferir login/isolamento em `/aluno/login` → `/aluno`.

### 7.2 Perfil Psicólogo

- [ ] **Ativação, redefinição e revogação de sessão (`SEG-02`, `SITE-09`):** testar `/ativar-conta` ou `/redefinir-senha` em uma janela mantendo outra sessão aberta com a senha antiga → confirmar que a sessão anterior é invalidada na próxima requisição.
- [ ] **Meu Cadastro (`CAD-03`, `CAD-07`, `OPS-09`, `PSI-02`, `PSI-03`):** abrir `/meu-cadastro` → baixar o PDF do Termo de Adesão aceito, conferir os vínculos acadêmicos independentes (1ª/2ª pós), editar campo livre (ex.: turno) salvando direto e enviar solicitação de campo protegido (ex.: capacidade/pós) conferindo que não aparece escolha de duração indevida.
- [ ] **Meus Pacientes e cadastro manual (`ROD-05`, `ROD-10`, `ROD-16`, `PSI-04`..`PSI-08`, `PSI-18`):** cadastrar paciente fictício conferindo restrição aos públicos e serviços homologados, opção **Projeto Acolhe** (sem consumir vaga do limite de 5), menor sem CPF com responsável, vínculo coletivo (casal/família/grupo) e teste de `PSI-07` (Particular + Conveniado = Sim); clicar em **Agendar** direto no card de Meus Pacientes e validar que `PSI-18` exibe só os serviços homologados.
- [ ] **Agenda, disponibilidade e férias (`OPS-01`, `OPS-02`, `AGD-02`, `PSI-12`..`PSI-14`):** configurar disponibilidade presencial/on-line, bloquear dia inteiro (férias) e confirmar retirada do rodízio (preservando pausa manual) + aviso no sino da Gestão; testar Orientação Parental (50 min individual / 1h30 família), Avaliação variável (ex.: 120 min) e bloqueio de choque de horário no intervalo reservado.
- [ ] **Falta paga, realização sem prontuário, reagendamento e recusa (`OPS-03`, `OPS-04`, `ROD-11`, `PSI-15`, `PSI-16`):** registrar falta em sessão particular paga (opções cobrar vs. não cobrar), confirmar realização de outra sessão sem preencher prontuário (conferindo que só a realizada conta para estágio), testar reagendamento/cancelamento (horário antigo liberado e público preservado) e recusar um encaminhamento em `/confirmar-contato/[id]` preenchendo motivo opcional.
- [ ] **Sigilo, linha do tempo e documentos psicológicos (`AGD-05`, `AGD-06`, `SEG-05`, `OPS-05`, `PSI-11`):** abrir `/linha-do-tempo`, iniciar rascunho e alternar de ficha para confirmar retenção do rascunho; conferir que Psicólogo B não acessa paciente exclusivo de Psicólogo A; consultar vínculo encerrado para ver apenas registros próprios e adicionar complemento datado; abrir `/pacientes/[id]/documentos` e gerar prévia de documento.
- [ ] **Meu Financeiro e isolamento de rotas (`FIN-01`, `FIN-04`, `FIN-05`, `PSI-17`, `PSI-20`):** abrir `/meu-financeiro` → conferir coluna **Atendimento / Origem** (serviço + data/hora ou pacote), clicar em aviso de cobrança vencida no sino para focar a linha, exportar CSV e validar bloqueio ao tentar abrir `/gestao/cockpit` e `/relatorios` (`PSI-20`).

### 7.3 Perfil Gestão

- [ ] **Cockpit, rodízio e configuração de oferta (`ROD-01`..`ROD-03`, `ROD-13`, `AGD-01`, `GES-03`, `GES-05`, `GES-11`):** conferir ordem do rodízio e nota `"empate, decidido por sorteio"`, pedido direcionado expirado/recusado com botão **"Devolver ao rodízio"**, selo **"Aceito"** após aceite, alerta de 48h sem primeiro agendamento no sino e edição do prazo configurável da oferta (1 a 168h) com histórico antes/depois.
- [ ] **Cursos, turmas, demandas e vínculos (`CAD-04`..`CAD-07`):** em `/gestao/cursos`, editar permissões de um curso, criar turma com datas, editar demanda clínica e encerrar uma turma conferindo saída prevista (+3 meses), contagem regressiva e prorrogação/reabertura (mantendo outra pós válida); em `/gestao/psicologos`, conferir bloqueio do comprovante definitivo antes da aprovação, aprovar candidato para liberar envio do Termo e aprovar/recusar 1ª e 2ª pós independentemente.
- [ ] **Pacientes, vínculo direto, espera e inativação (`ROD-09`, `ROD-12`, `ROD-14`, `ROD-17`, `GES-04`):** em `/gestao/pacientes`, abrir gaveta de paciente e conferir histórico por CPF + motivos de recusa, testar escolha **"Pedir aceite (24h)"** vs. **"Vincular diretamente"**, testar exceção de capacidade `"6 de 5"` com justificativa obrigatória, incluir em lista de espera automática/manual, conferir preferências originais com histórico e comparar **Inativar vínculo** com **Registrar desistência**.
- [ ] **Agenda da clínica e declaração de estágio (`AGD-04`, `AGD-07`, `AGD-08`, `AGD-09`, `GES-01`, `GES-02`):** em `/gestao/agenda`, filtrar por `Realizada`/`Cancelada`, editar horário, formato, valor (R$) e pagador conferindo histórico antes/depois e trava em cobrança já paga, além de testar movimentação para data passada (`GES-01`); em `/relatorios/declaracao`, filtrar período (`inicio`/`fim`) e conferir cálculo em horas e minutos reais (ex.: 50 min + 90 min = `2 horas e 20 minutos`).
- [ ] **Financeiro da clínica e convênios PJ (`FIN-01`, `FIN-02`, `FIN-07`, `FIN-09`..`FIN-12`, `OPS-06`..`OPS-08`, `GES-06`, `GES-09`):** em `/gestao/financeiro`, conferir conciliação de 70% por recebimento (e taxa de cartão separada), pacote antecipado de sessões com saldo, alteração de vencimento com baixa parcial, registro de decisão da Gestão em estorno com justificativa e bloqueio para cobrança agrupada entre meses diferentes; em `/convenios`, configurar valor contratual por sessão e políticas (falta/cancelamento/excedente/base), fechar fatura, baixar demonstrativo PDF/CSV sem dados clínicos e abrir prévia de boleto/NFS-e sem emitir em produção.
- [ ] **Sigilo clínico e notificações (`SEG-03`, `OPS-09`, `GES-08`, `GES-10`, `GES-12`, `GES-13`):** tentar abrir `/linha-do-tempo` como Gestão (deve bloquear/redirecionar), aprovar/recusar alteração protegida de perfil de psicólogo e conferir no sino o rótulo exibido para alterações (`GES-13`), além de abrir `/relatorios`, `/configuracoes/integracoes` e `/ajuda`.

### 7.4 Perfil Financeiro (`billing`)

- [ ] **Login próprio e isolamento (`FIN-06`, `SEG-03`):** entrar com usuário vinculado apenas a `billing` → confirmar redirecionamento para `/gestao/financeiro` e menu lateral exibindo apenas **Financeiro & Repasses**, **Convênios PJ** e **Ajuda**.
- [ ] **Bloqueio de sigilo e gestão (`FIN-06`, `SEG-03`):** tentar navegar diretamente para `/linha-do-tempo`, `/gestao/cockpit`, `/gestao/pacientes`, `/gestao/psicologos`, `/gestao/agenda`, `/pacientes` e `/relatorios` → confirmar redirecionamento para `/gestao/financeiro` e ausência de dados clínicos em relatórios/exportações.
- [ ] **Operação financeira e ausência de emissão fiscal (`FIN-13`, `OPS-08`):** consultar a apuração mensal de créditos gravados por profissional em `/gestao/financeiro`, exportar **Excel (`.xlsx`)** e **PDF** validando os valores e abrir `/convenios` confirmando operação das faturas sem botão/permissão de emissão de NFS-e.

### 7.5 Regressões e pendências antigas (13/11) para conferir na mesma bateria

- [ ] **Sem disparo real sem combinar antes:** testar somente após alinhar ambiente/destinatário `PSI-16` (reagendamento com aviso), `FLX-05` (protocolo único na triagem), `FLX-06` (decisão só pelo link WhatsApp) e `FLX-01` (conferência de textos).
- [ ] **Decisões/cadastros da equipe:** validar resolução de `SITE-10` (cadastros duplicados em produção), `PSI-10` (reinício da contagem de primeiro contato ao encaminhar para outro psicólogo) e `CTR-01` (paginação do Termo de Adesão em ~5 páginas).

---

## Histórico de rodadas

| Data | Tipo | Registro |
| --- | --- | --- |
| 28/10/2026 | Interface publicada e testes automatizados | [testes-plataforma-2026-10-28.md](testes-plataforma-2026-10-28.md) |
| 05/11/2026 | Testes manuais da equipe | `ERROS E ACERTOS - PLATAFORMA CLÍNICA.docx` |
| 11/11/2026 | Lint, testes, build e rotas publicadas | [informativo-verificacao-2026-11-11.md](informativo-verificacao-2026-11-11.md) |
| 13/11/2026 | Navegador em produção (Playwright), perfis de gestão e de psicólogo, só leitura. Consulta de leitura ao banco para o SITE-06 | Seções 1–6 deste checklist. Nada foi salvo e nenhum diálogo foi confirmado |
| 24/11/2026 | Ampliação do roteiro manual pós-deploy `5850646` (inclui segurança, sigilo, operação diária, perfil Financeiro e reteste de itens de 13/11) | Seção 7 deste checklist e [testes-pdf-2026-11-23.md](testes-pdf-2026-11-23.md) |
