# PRD — Product Requirements Document: Thats Life (TL - Psi)

**Nome do Produto:** Thats Life (TL - Psi)  
**Data:** 30 de Julho de 2026  
**Status:** Especificação Oficial de Produto v1.0  
**Mercado Alvo:** Psicólogos autônomos, clínicas de saúde mental e clínicas-escola / institutos de ensino no Brasil.  

---

## 1. Visão Geral & Problema do Mercado

### 1.1 O Cenário Competitivo (PsicoManager x PersonCare x SimplePractice)
Sistemas tradicionais de gestão de consultórios sofrem de duas grandes falhas estruturais:
1. **Sobrecarga Burocrática do Psicólogo:** O profissional gasta de 10 a 20 minutos após cada atendimento digitando prontuários, elaborando recibos e organizando tarefas para o paciente.
2. **Desconexão do Paciente Entre Sessões:** O paciente não possui uma experiência mobile agradável para acompanhar seu humor, consolidar hábitos e cumprir tarefas terapêuticas.

### 1.2 A Proposta de Valor do Thats Life
O **Thats Life** é uma **Plataforma de Inteligência Clínica & Acompanhamento Terapêutico Mobile** que resolve essa equação com:
* **Automação Pós-Sessão em 1 Clique:** Processamento de áudio por IA $\rightarrow$ Prontuário SOAP estruturado $\rightarrow$ Extração de tarefas para o app do paciente $\rightarrow$ Notificação de cobrança/recibo.
* **App Mobile Nativo do Paciente (`apps/mobile`):** Aplicativo interativo para diário de humor, hábitos e tarefas.
* **Integração com Evolution API:** Mensagens transacionais no WhatsApp (lembretes de consulta, chave Pix, recibos) de forma ágil e de baixo custo.
* **Módulo de Supervisão Clínica:** Ferramenta dedicada a institutos e clínicas-escola para anonimização automática de prontuários via IA para professores e supervisores.

---

## 2. Requisitos Funcionais por Módulo

### 2.1 Cockpit do Psicólogo & IA (Web - `apps/web`)
* **Gravador de Atendimento:** Registro de áudio da consulta ou importação de arquivo de mídia.
* **Gerador de Prontuário SOAP:** IA que compõe a estrutura SOAP (Subjetivo, Objetivo, Avaliação, Plano) de acordo com os critérios éticos do Conselho Federal de Psicologia (CFP).
* **Painel de 1 Clique:** O psicólogo revisa a evolução sugerida, aprova o prontuário, dispara as tarefas para o app do paciente e envia a cobrança pelo WhatsApp com um único clique.
* **Linha do Tempo Clínica Verificável:** Unificação longitudinal de registros
  clínicos, escalas, humor, hábitos, tarefas, metas, check-ins, agenda e alertas,
  sempre com referência explícita à fonte.
* **Gestão de Agenda & Finanças:** Controle de consultas, faturamento Pix/Asaas, controle de repasses para clínicas e emissão de NFSe / Receita Saúde.

### 2.2 App Mobile do Paciente (`apps/mobile`)
* **Diário de Humor:** Registro diário visual de emoções com gráficos de tendência semanal e mensal.
* **Central de Tarefas Terapêuticas:** Lista interativa com as atividades combinadas na última sessão com o terapeuta.
* **Rastreamento de Hábitos & Metas:** Monitoramento de rotinas saudáveis e exercícios pré-configurados pelo psicólogo.
* **Notificações Push:** Lembretes de hábitos e avisos de proximidade da consulta.

### 2.3 Integração Evolution API (`packages/core`)
* Disparo de lembretes automáticos de consulta (24h e 2h antes).
* Envio automático de recibos em PDF e chaves Pix para pagamento.
* Notificações de confirmação de agendamento.

### 2.4 Módulo de Supervisão Clínica
* **Anonimização Inteligente:** Filtro automático que remove informações de identificação pessoal (PII) antes de submeter os relatos clínicos para revisão pedagógica.
* **Painel do Supervisor:** Interface central para que professores de pós-graduação e supervisores clínicos analisem os prontuários dos alunos supervisionados.

---

## 3. Requisitos Não-Funcionais & Compliance

* **CFP:** Guarda de prontuários criptografados pelo período regulatório mínimo de 5 anos.
* **LGPD:** Encriptação de dados de saúde em repouso e em trânsito; controle de permissão por papel (paciente, psicólogo, supervisor, admin).
* **Desempenho:** Processamento de áudio para SOAP em menos de 15 segundos.
* **IA fundamentada:** Respostas sobre o histórico clínico devem citar evidências
  recuperadas. Na ausência de fonte suficiente, o sistema deve declarar que não
  encontrou evidência em vez de completar a resposta por inferência.

---

## 4. Fora do Escopo do Produto

* **Lista de espera e preenchimento automático de horários cancelados:** o Thats
  Life não manterá fila de pacientes nem enviará ofertas automáticas para ocupar
  vagas liberadas. O produto prioriza inteligência clínica, acompanhamento
  terapêutico e automação do trabalho relacionado ao atendimento.
