# PRD — Product Requirements Document: Clínica Viver Mais

**Nome do Produto:** Clínica Viver Mais  
**Data de Atualização:** Agosto de 2026  
**Status:** Especificação Oficial de Produto v2.0  
**Mercado Alvo:** Psicólogos autônomos, estudantes de pós-graduação, clínicas de saúde mental e clínicas-escola / institutos de ensino no Brasil.  

---

## 1. Visão Geral & Problema do Mercado

### 1.1 O Cenário Competitivo (PsicoManager x PersonCare x SimplePractice)
Sistemas tradicionais de gestão de consultórios e clínicas-escola sofrem de três grandes falhas estruturais:
1. **Sobrecarga Burocrática do Psicólogo:** O profissional perde de 10 a 20 minutos após cada atendimento digitando prontuários, elaborando recibos e organizando tarefas para o paciente.
2. **Triagem & Distribuição Manual de Pacientes:** A gestão de clínicas-escola passa horas alocando pacientes manualmente via planilhas/WhatsApp sem controle de SLA de resposta ou transbordo automático.
3. **Desconexão Financeira & do Paciente Entre Sessões:** Dificuldade na conciliação de repasses com abatimento em mensalidades de pós-graduação e falta de um aplicativo mobile para acompanhamento terapêutico do paciente.

### 1.2 A Proposta de Valor da Clínica Viver Mais
A **Clínica Viver Mais** é uma **Plataforma de Inteligência Clínica & Gestão de Clínica-Escola (Web & Mobile)** que resolve essa equação com:
* **Automação Pós-Sessão em 1 Clique:** Processamento de áudio por IA $\rightarrow$ Prontuário SOAP estruturado $\rightarrow$ Extração de tarefas para o app do paciente $\rightarrow$ Disparo de cobrança por WhatsApp via Link Único.
* **Fila Inteligente & Atribuição Automática (Round-Robin):** Triagem no site por turno e modalidade com timer de SLA de 24h via Evolution API e transbordo automático para o próximo psicólogo.
* **Checkout Transparente via Link Único (`vivermais.com.br/p/[ID]`):** Pagamento via Pix Copia e Cola / Cartão com conciliação automática por Webhook, eliminando o envio manual de comprovantes.
* **Split de Receita 70/30 & Abatimento no Boleto de Pós:** 30% retidos pela clínica e 70% creditados para abatimento automático na mensalidade/boleto do aluno.
* **Cockpit de Gestão da Clínica (11 Relatórios Automáticos):** Dashboard em tempo real monitorando SLAs, CPA/CAC de marketing, distribuição demográfica, volume social vs. particular e audit log de agendamentos.
* **App Mobile Nativo do Paciente (`apps/mobile`):** Aplicativo interativo para diário de humor, hábitos, tarefas, escalas psicológicas e sala de vídeo nativa.
* **Módulo de Supervisão & Retenção:** Anonimização automática de prontuários via IA para supervisores de pós-graduação e protocolo de auditoria de desistências.

---

## 2. Requisitos Funcionais por Módulo

### 2.1 Cockpit do Psicólogo & IA (Web - `apps/web`)
* **5 Abas Principais:** Leads & SLA 24h, Meus Pacientes & Status, Agenda & Atendimentos, Desconto na Mensalidade (70%) e Cockpit SOAP & IA.
* **Gravador de Atendimento & Diarização:** Identificação das falas de psicólogo e paciente para geração do prontuário.
* **Gerador de Prontuário SOAP:** IA que compõe a estrutura SOAP (Subjetivo, Objetivo, Avaliação, Plano) em <15 segundos de acordo com os critérios do CFP.
* **Painel de 1 Clique:** Aprovação humana do prontuário, envio de tarefas para o app do paciente e notificação de cobrança pelo WhatsApp com 1 clique.
* **Linha do Tempo Clínica Verificável:** Histórico unificado de registros clínicos, escalas, check-ins pré-sessão e metas com referência verificável de fonte.

### 2.2 Painel de Gestão da Clínica & Clínica-Escola (Web - `apps/web`)
* **Fila Inteligente & SLA 24h:** Visualização do rodízio Round-Robin, status de contatos e transbordo automático.
* **Cockpit de 11 Relatórios:** Dashboards de SLA 24h, CPA/CAC de marketing, faixa etária/gênero, total por modalidade e audit log de agendamentos.
* **Gestão de Convênios PJ:** Módulo restrito de projetos corporativos com controle de data de emissão de NF e pagamento de boletos corporativos.
* **Auditoria de Desistências:** Registro de motivos de evasão (financeiro, insatisfação, troca de abordagem) e fila de reengajamento.
* **Gestão de Perfis:** Ativação/desativação de visibilidade de psicólogos no site ao atingir limite de capacidade (ex: 33 pacientes ativos).

### 2.3 App Mobile do Paciente (`apps/mobile`)
* **Diário de Humor:** Registro diário visual de emoções com gráficos de tendência.
* **Central de Tarefas Terapêuticas:** Atividades combinadas na consulta enviadas automaticamente pós-sessão.
* **Rastreamento de Hábitos & Metas:** Monitoramento de rotinas configuradas pelo psicólogo.
* **Check-in Pré-Sessão & Escalas:** Resposta a formulários e aos 44 instrumentos psicológicos validados.
* **Sala de Vídeo Nativa:** Entrada direta em consultas virtuais pelo smartphone.

### 2.4 Integração Evolution API & Pagamentos (`packages/core`)
* Disparo duplo no WhatsApp para paciente e psicólogo ao alocar nova lead.
* Timer de SLA de 24h com opção "Confirmei o Contato" e transbordo automático.
* Checkout via Link Único dedicado com conciliação automática por Webhook (sem prints de comprovantes).
* Lembretes automáticos de consulta (24h e 2h antes).

### 2.5 Módulo de Supervisão Clínica
* **Anonimização Inteligente:** Filtro por IA que remove dados pessoais identificáveis (PII) antes da revisão por professores e supervisores.
* **Painel do Supervisor:** Interface para validação, assinatura e emissão de pareceres em atendimentos de pós-graduação.

---

## 3. Requisitos Não-Funcionais & Compliance

* **CFP:** Guarda de prontuários criptografados pelo período regulatório mínimo de 5 anos.
* **LGPD:** Encriptação de dados de saúde em repouso e trânsito; pseudonimização no envio de prompts de IA.
* **Retenção de Áudio:** Expurgo automático de áudios de consultas em até 72h e transcrições em 90 dias.
* **Desempenho:** Processamento de áudio para SOAP em menos de 15 segundos.
* **IA Fundamentada:** Respostas sobre histórico clínico baseadas estritamente em evidências verificáveis; declaração explícita quando a informação não for encontrada.

---

## 4. Diretrizes Clínicas & Éticas

* **Diagnóstico automático proibido:** Nenhum indicador de risco vira diagnóstico ou conduta sem avaliação de profissional com CRP.
* **Aprovação Humana Obrigatória:** Prontuários e tarefas enviadas ao paciente exigem validação e clique explícito do profissional responsável.

