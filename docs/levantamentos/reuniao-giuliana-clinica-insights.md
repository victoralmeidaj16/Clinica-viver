# 📌 Reunião com Giuliana — Insights, Requisitos & Lista de Afazeres (Clínica Viver Mais)

**Data da Reunião:** 05/08/2026  
**Participantes:** Giuliana (Gestora da Clínica Viver Mais Psicologia) & Equipe Técnica  
**Objetivo:** Mapeamento de dores operacionais, automação de relatórios mensais e requisitos para a plataforma Sponteiro (módulo Clínica).

---

## 🗺️ 1. Visão Geral & Contexto da Reunião

Giuliana é a responsável direta pela gestão diária da Clínica Viver Mais Psicologia. Atualmente, o controle da clínica é majoritariamente **manual e descentralizado**, exigindo que a gestão passe horas compilando planilhas e relatórios para apresentar em reuniões de equipe.

O objetivo da integração com a plataforma **Sponteiro** é automatizar o fluxo de atendimento de ponta a ponta, substituir os controles manuais, garantir a pontualidade nos comprovantes/repasses e fornecer um **Cockpit de Gestão** inteligente em tempo real.

---

## 💡 2. Principais Insights & Dores Operacionais

| # | Dor / Gargalo Atual | Impacto no Negócio | Solução no Sponteiro |
| :-: | :--- | :--- | :--- |
| **1** | **Compilação Manual de Relatórios** | Perda de tempo da gestão todo início de mês compilando dados demográficos, financeiros e de atendimentos. | Dashboard automatizado com métricas em tempo real e exportação mensal em 1 clique. |
| **2** | **Atraso no Envio de Comprovantes** | Psicólogos enviam comprovantes com meses de atraso (ex: atendimentos de abril entregues em junho), desorganizando o DRE. | Fluxo automatizado de cobrança via gateway com conciliação por webhook (fim da dependência de comprovante manual). |
| **3** | **Encaminhamentos Manuais (WhatsApp)** | Pacientes que chegam via WhatsApp/indicação não passam pelo formulário do site e ficam fora do controle da clínica. | Módulo de cadastro manual de leads com vinculação direta a psicólogos. |
| **4** | **Faturamento de Convênios Empresariais** | Parceiros PJ (ex: projetos corporativos de 6 sessões) exigem emissão de boletos e NFs separadas, sem sistema para controle. | Módulo restrito de Gestão de Convênios/Projetos com campos de data de emissão da NF e pagamento do boleto. |
| **5** | **Falta de Retenção & CQ na Desistência** | Pacientes desistem após poucas sessões sem que a gestão saiba o motivo exato (financeiro, abordagem, problema com psicólogo). | Protocolo de auditoria de desistência com obrigatoriedade de justificativa e fila de contato para reengajamento. |

---

## 🗂️ 3. Detalhamento dos Requisitos por Módulo 

## 3.1 Augusto 

### 3.1. 🌐 Vitrine de Profissionais & Gestão de Visibilidade
* **Catálogo Visual dos Psicólogos:** Botão no site direcionando para uma página/vitrine contínua de rolagem vertical (estilo catálogo PDF/scroll), com foto dos profissionais, frase de apresentação e carrossel.

* **Alteração de fluxo de agendamento pelo site** 
Não exibir a página dos profissionais no site para o agendamento, os usuários não vão poder escolher o profissional, o sistema vai atribuir automaticamente de acordo com o tipo de atendimento,  turno e a modalidade escolhida acessivel/social.




### 3.2. 👤 Cadastro Manual & Lifecycle de Pacientes
* **Cadastro Manual de Leads:** Tela interna para inserção direta de pacientes vindo de encaminhamentos manuais (WhatsApp/indicações) e vinculação com o psicólogo correspondente.
* **Status do Paciente:**
  * `Ativo`
  * `Em Férias`
  * `Desistente`
* **Filtros e Relatórios de Status:** Filtros por status e monitoramento de **Troca de Abordagem** (ex: migração de TCC para Psicanálise).
* **Auditoria de Desistências & Retenção:**
  * Campo para registro do motivo da desistência (financeiro, insatisfação, troca de abordagem).
  * (Dúvida) Fila de ação para a equipe contactar o paciente desistente, avaliar a conduta do psicólogo e oferecer opção de troca de profissional.
  * **Gestão de Perfis (Ativar/Desativar):** Painel administrativo para Giuliana privar/desativar o perfil de psicólogos que atingiram o limite de pacientes (ex: 33 pacientes ativos) ou fecharam agenda, impedindo novos recebimentos pelo site.

### 3.3. 📊 Cockpit de Gestão & Relatórios Automáticos
Automação dos **11 indicadores essenciais** da clínica:
1. **Fila de Espera:** Posição dos psicólogos na fila de recebimento de novos pacientes.
2. **SLA de Contato (24h):** Alerta visual de psicólogos que **não confirmaram contato dentro do prazo de 24 horas**.
3. **Distribuição por Gênero:** Percentual de pacientes masculinos / femininos.
4. **Faixa Etária Predominante:** Mapeamento demográfico (ex: maior concentração entre 18 e 28 anos).
5. **Origem dos Leads:** Métricas de "Como ficou sabendo da clínica" (site, tráfego pago, indicação, redes sociais).
6. **Total de Atendimentos Efetuados:** Contagem real de sessões realizadas no mês (geral e por psicólogo).
7. **Detalhamento por Modalidade:** Quantidade de avaliações e sessões no valor social vs. particular.
8. **Detalhamento por Faixa de Valor:** Tabela comparativa de atendimento por faixa de preço.
9. **Custo por Paciente (CPA / CAC):** Cálculo automático: `Investimento em Marketing ÷ Quantidade de Leads Gerados`.
10. **Projetos Especiais & Convênios:** Volume de atendimentos vinculados a pacotes corporativos.
11. **Histórico de Agendamentos (Audit Log):** Backup seguro dos e-mails e confirmações de agendamento para resguardo jurídico.

### 3.4. 🏢 Módulo de Convênios Empresariais & Projetos Especiais
* **Permissão de Acesso:** Estritamente restrito à **Giuliana e Financeiro** (invisível para psicólogos).
* **Gestão de Faturamento PJ:**
  * Associação de 1 ou múltiplos pacientes e psicólogos ao mesmo projeto/empresa.
  * Registro de **Data de Emissão da Nota Fiscal** e **Data de Pagamento do Boleto**.
  * Emissão de relatórios consolidados separados do fluxo normal da clínica.

---

## 📋 4. Lista de Afazeres (To-Do List por Prioridade)

### 🔴 Prioridade Alta (Imediato & Alinhamentos Estratégicos)
- [ ] **Alinhamento com Augusto:** Apresentar a especificação dos gatilhos iniciais e fluxo de dados da clínica.
- [ ] **Reunião de Alinhamento Financeiro:** Confirmar fluxo de notas fiscais, boletos de convênios e conciliação com a equipe financeira (Ester/Mari) antes de travar os relatórios.
- [ ] **Desenho da Regra de Transbordo (SLA 24h):** Definir ação automática do sistema quando o psicólogo não confirmar o WhatsApp em 24h (expirar alocação e repassar ao próximo da fila).

### 🟡 Prioridade Média (Desenvolvimento de Funcionalidades do Módulo Clínica)
- [ ] **Módulo de Cadastro Manual de Leads:** Formulario administrativo no Sponteiro para cadastro direto de pacientes via WhatsApp + seleção manual de psicólogo.
- [ ] **Gestão de Perfis de Psicólogos:** Botão de ativação/desativação (privar/exibir) no catálogo visual do site.
- [ ] **Módulo Restrito de Convênios / Projetos PJ:**
  - [ ] Tela de vínculo: Psicólogo ↔ Paciente(s) ↔ Empresa Parceira.
  - [ ] Controle de Faturamento: Data de emissão da NF e vencimento/pagamento do boleto.
- [ ] **Cockpit de Gestão da Clínica (11 Relatórios):**
  - [ ] Painel da Fila de Espera e SLA 24h.
  - [ ] Gráfico de Origem de Pacientes ("Como ficou sabendo").
  - [ ] Métricas Demográficas (Idade e Gênero).
  - [ ] Gráfico de Custo por Paciente (CPA de Marketing).
  - [ ] Relatório de Sessões Efetuadas por Modalidade (Social vs. Particular).

### 🟢 Prioridade Normal (Retenção, Qualidade & Segurança)
- [ ] **Módulo de Auditoria de Desistência:**
  - [ ] Formulário/modal para captura do motivo da desistência.
  - [ ] Fila de trabalho para contato de reengajamento e feedback sobre a conduta do profissional.
- [ ] **Segurança & Audit Log de Agendamentos:** Banco de dados auditável de todas as solicitações de agendamento (backup de resguardo jurídico da clínica).
- [ ] **Vitrine de Profissionais no Site:** Página de catálogo em scroll/carrossel contínuo com a equipe de psicólogos.
