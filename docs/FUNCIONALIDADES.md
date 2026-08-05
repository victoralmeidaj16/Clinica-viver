# Funcionalidades — Thats Life (TL - Psi)

**O que é:** uma plataforma de inteligência clínica e acompanhamento terapêutico
para psicólogos autônomos, clínicas de saúde mental e clínicas-escola no Brasil.

**O que resolve:** o psicólogo perde de 10 a 20 minutos de burocracia depois de
cada atendimento, e o paciente fica desassistido entre uma sessão e outra. O
Thats Life automatiza a papelada do pós-sessão e mantém o vínculo terapêutico
vivo no intervalo entre consultas.

> **Status:** protótipo em modo demonstração. As funcionalidades abaixo
> descrevem o produto especificado e operam sobre dados fictícios. A IA clínica
> é real; WhatsApp e pagamentos usam adaptadores que não produzem efeito no
> mundo real, por escolha. Consulte a seção final para o estado de cada área.

---

## 1. Atendimento e Sessão

### Sala de atendimento online
- Sala de vídeo integrada à plataforma, sem depender de link externo.
- Controles de microfone, câmera e compartilhamento durante a consulta.
- Cards de participantes reposicionáveis na tela.
- Aviso permanente de criptografia e conformidade com o CFP.
- Tela de consentimento antes de qualquer captura de áudio.

### Transcrição invisível
- A sessão é transcrita em segundo plano, sem elemento visual que interrompa o
  contato terapêutico.
- **Diarização com calibração:** identifica quem falou cada trecho e associa as
  falas ao profissional ou ao paciente antes da geração do rascunho clínico.
- A transcrição depende de consentimento ativo, versionado e revogável pelo
  paciente a qualquer momento.
- Também aceita importação de arquivo de mídia, para quem grava por fora.

### O áudio da sessão não é guardado
A plataforma **não mantém acervo de áudio de consultas**. A gravação existe
apenas como insumo momentâneo da transcrição:

| Artefato | Quanto tempo permanece | Por quê |
| :--- | :--- | :--- |
| Áudio da sessão | Até 72 horas | Só para reprocessar caso a transcrição falhe. Descartado em seguida. |
| Transcrição | 90 dias | Janela para o psicólogo retificar o prontuário com a fonte à mão. |
| Prontuário aprovado | 5 anos | Registro clínico exigido pelo CFP. |

O que persiste como registro clínico é o prontuário aprovado pelo profissional —
não a gravação nem a transcrição. Isso reduz drasticamente a superfície de risco:
um vazamento de banco não expõe a voz de nenhum paciente, e não existe biblioteca
de sessões gravadas a ser requisitada, invadida ou vendida.

### Copiloto clínico de IA (durante a sessão)
Painel lateral acionável pelo psicólogo, com quatro ações sob demanda:
- **Resumo parcial** — síntese do relato até aquele ponto da sessão.
- **Indicadores** — sinais de alerta e marcadores de estresse identificados.
- **Hipóteses** — apoio à formulação psicoterapêutica.
- **Intervenção** — sugestão de pergunta ou técnica para o momento.

O copiloto sugere; nunca decide nem registra nada sozinho no prontuário.

---

## 2. Automação Pós-Sessão em 1 Clique

O diferencial central do produto. Depois do atendimento, o psicólogo revisa uma
única tela e aprova. A partir daí a plataforma executa a cadeia inteira:

1. **Rascunho de prontuário SOAP** gerado por IA a partir da transcrição
   (Subjetivo, Objetivo, Avaliação, Plano), seguindo critérios éticos do CFP.
2. **Aprovação humana obrigatória** — nenhum conteúdo de IA vira registro
   clínico sem revisão e assinatura do profissional.
3. **Tarefas terapêuticas** extraídas da sessão e enviadas ao app do paciente.
4. **Resumo para o paciente** em linguagem acessível, com contrato de conteúdo
   separado do prontuário.
5. **Cobrança e recibo** disparados automaticamente.
6. **Notificação ao paciente** por WhatsApp.

**Meta de desempenho:** o processamento do áudio e a geração inicial do
rascunho SOAP devem ser concluídos em menos de 15 segundos, conforme o requisito
não funcional do produto.

### Proteções do conteúdo enviado ao paciente
O que chega ao paciente passa por uma triagem automática que **bloqueia**:
- trechos de transcrição;
- o prontuário SOAP e qualquer nota interna;
- hipóteses diagnósticas;
- conteúdo de risco;
- identificadores pessoais de terceiros.

Se qualquer etapa opcional falhar (cobrança, mensagem, recibo), o prontuário já
aprovado permanece intacto e a falha fica registrada para nova tentativa, sem
duplicar cobranças ou mensagens.

---

## 3. Prontuário Clínico

- Formato SOAP estruturado, com editor campo a campo.
- **Versionamento completo:** cada retificação cria uma nova revisão; as
  versões anteriores nunca são apagadas.
- Cada aprovação registra profissional, data, atestado de revisão e uma
  assinatura digital do conteúdo aprovado.
- Toda leitura de prontuário é auditada.
- Guarda pelo período regulatório mínimo de 5 anos exigido pelo CFP, com
  possibilidade de retenção legal estendida.
- Proprietários e administradores da clínica **não** têm acesso automático ao
  prontuário. Profissionais veem apenas pacientes atribuídos a eles.

---

## 4. Linha do Tempo Clínica

Visão longitudinal única do paciente, reunindo em ordem cronológica:
- prontuários aprovados;
- resultados de escalas e testes;
- registros de humor, hábitos, tarefas e metas;
- check-ins pré-sessão;
- sessões, agendamentos e alertas.

### Busca de memória clínica
- Busca por evidência dentro do histórico do paciente.
- Cada resultado vem com o trecho de origem e a referência verificável à fonte.
- Quando não há evidência suficiente, o sistema **declara que não encontrou** em
  vez de completar a resposta por inferência.
- Rascunhos não aprovados nunca aparecem na linha do tempo.

---

## 5. Avaliação Psicológica

- **Biblioteca com 44 instrumentos** catalogados, cobrindo 17 domínios:
  ansiedade, depressão, estresse, sono, TDAH, autismo, TOC, trauma, humor,
  burnout, personalidade, cognição, alimentação, substâncias, qualidade de
  vida, funcionamento geral e risco de suicídio.
  Inclui BAI, GAD-7, BDI-II, PHQ-9, DASS-21, PSQI, ISI, ASRS, Y-BOCS, MBI,
  WHOQOL-BREF, entre outros.
- Marcação de instrumentos recomendados para TCC.
- Distinção entre autorrelato pré-sessão, aplicação pelo profissional e
  entrevista diagnóstica.
- **Envio de escalas ao paciente** com resposta pelo app.
- **Gráfico longitudinal** de evolução dos escores ao longo do tratamento.
- **Interpretação clínica assistida por IA** dos resultados.
- **Alerta de risco clínico** destacado quando um instrumento validado aponta
  indicador crítico — sempre encaminhado para revisão humana, nunca gerando
  diagnóstico ou mensagem automática.

---

## 6. Plano Terapêutico e Acompanhamento

- Definição de metas terapêuticas por paciente.
- Criação e acompanhamento de tarefas entre sessões.
- Configuração de hábitos a serem monitorados pelo paciente.
- Painel de acompanhamento do progresso.
- Alerta operacional automático quando o humor registrado fica muito baixo,
  encaminhado para revisão humana.

### Painel operacional do psicólogo
- Visão consolidada da agenda e dos atendimentos confirmados.
- Quantidade de planos terapêuticos ativos e tarefas pendentes.
- Alertas de risco provenientes dos check-ins pré-sessão.
- Resumo financeiro e quantidade de comunicações aguardando envio.

---

## 7. Check-in Pré-Sessão

- Formulário enviado ao paciente antes da consulta.
- Indicadores estruturados de estado + escala validada.
- Campo opcional para **assuntos que o paciente quer abordar** (até mil
  caracteres, preservados exatamente como escritos, sem reescrita automática).
- **Briefing pré-sessão** apresentado ao psicólogo antes do atendimento.
- O check-in é material de preparação e nunca entra automaticamente no
  prontuário.
- Indicadores de risco exigem revisão humana antes de qualquer conduta.

---

## 8. Agenda

- Agendamento por paciente e profissional, com validação de conflito de
  horários.
- Atendimentos presenciais, por videochamada ou por telefone.
- Confirmação, reagendamento e cancelamento pelo painel da agenda.
- Disponibilidade semanal, bloqueios e agendamentos recorrentes.
- Ciclo completo: agendado → confirmado → realizado / cancelado / falta.
- Lembretes automáticos 24h e 2h antes da consulta, por WhatsApp, e-mail e/ou
  aplicativo.
- Vínculo do agendamento com a sessão clínica correspondente.
- **Google Calendar:** cada psicólogo poderá conectar sua própria agenda,
  individualmente, sem compartilhar credenciais com a clínica ou colegas.
- Mudanças de calendário nunca alteram registros clínicos já produzidos.

---

## 9. Financeiro

- Cobranças por sessão, com descontos, pagamentos, estornos e taxas.
- **Repasses para clínicas** com múltiplos profissionais.
- Conciliação automática: saldo por sessão, pagamento parcial, excesso,
  estorno, vencimento e cancelamento.
- **Relatórios:** faturamento, fluxo de caixa, contas a receber, inadimplência
  e repasses.
- Filtros por período, paciente, profissional, status e forma de pagamento.
- **Exportação em CSV** (compatível com Excel em português) **e PDF A4**.
- **Pix e Asaas** para recebimento.
- **NFSe e Receita Saúde** para obrigações fiscais brasileiras.
- Recibos em PDF enviados automaticamente ao paciente.

---

## 10. App Mobile do Paciente

- **Diário de humor** com registro visual diário e gráficos de tendência
  semanal e mensal.
- **Central de tarefas terapêuticas** com as atividades combinadas na sessão.
- **Rastreamento de hábitos e metas** configurados pelo psicólogo.
- **Resumo da última sessão** em linguagem acessível.
- **Card da próxima sessão** com data e horário.
- **Entrada na sala de vídeo** direto pelo app.
- **Check-in pré-sessão** e resposta a escalas enviadas pelo terapeuta.
- **Gráfico de evolução** dos próprios resultados.
- **Linha do tempo pessoal** do acompanhamento.
- **Notificações push** de hábitos e proximidade da consulta.

---

## 11. Comunicação e Notificações

Central multicanal para mensagens transacionais por **WhatsApp, notificação
push e e-mail**, respeitando o canal habilitado pelo paciente:
- confirmação de agendamento;
- alteração de agendamento;
- lembretes de consulta (24h e 2h antes);
- atribuição e vencimento de tarefas terapêuticas;
- chave Pix e link de cobrança;
- confirmação de pagamento;
- recibo em PDF.

### Fila e preferências de entrega
- Fila programada com os estados aguardando, enviando, entregue, falhou e
  cancelado.
- Nova tentativa controlada em caso de falha, sem duplicar mensagens.
- Preferências por canal e categoria, incluindo configuração de horário de
  silêncio conforme o fuso do paciente.
- Adaptadores independentes para Evolution API, Expo Push e provedor de e-mail.

Regras de proteção:
- respeita as preferências de canal e o consentimento mais recente do paciente;
- modelos de mensagem **impedem** por construção o envio de SOAP, diagnóstico,
  conteúdo de risco ou notas clínicas;
- a auditoria registra categoria, canal e resultado do envio — nunca o texto da
  mensagem nem o contato do paciente;
- reenvios não duplicam mensagens.

---

## 12. Supervisão Clínica

Voltado a clínicas-escola, institutos e pós-graduações:
- **Anonimização inteligente** que remove informações de identificação pessoal
  antes de submeter o relato clínico à revisão pedagógica.
- **Painel do supervisor** para que professores e supervisores analisem os
  casos dos alunos supervisionados.

---

## 13. Gestão da Clínica

### Papéis e permissões
| Papel | O que acessa |
| :--- | :--- |
| Proprietário / Administrador | Administração da organização, financeiro e membros — **sem** acesso ao prontuário |
| Diretor clínico | Operação clínica e supervisão, sem gerenciar membros |
| Profissional | Prontuário, sessões e avaliações dos **pacientes atribuídos a ele** |
| Assistente | Cadastro, agenda e leitura financeira, sem prontuário |
| Financeiro | Cobrança, relatórios e dados mínimos de pacientes |
| Auditor | Leitura de auditoria, relatórios e finanças |

- Um mesmo profissional pode acumular papéis (ex.: dono + psicólogo) sem que
  permissões administrativas virem permissões clínicas.
- Cadastro de pacientes e de responsáveis legais.
- Responsáveis não recebem acesso clínico automaticamente: cada permissão é
  concedida individualmente.
- Isolamento total entre clínicas: nenhum dado atravessa organizações.

### Configurações e integrações
- Painel de conexão do WhatsApp (Evolution API).
- Painel de conexão do gateway de pagamentos (Asaas).
- Indicadores de status de cada integração.

---

## 14. Privacidade, Ética e Conformidade

- **CFP:** guarda de prontuários criptografados pelo período mínimo de 5 anos.
- **LGPD:** dados de saúde criptografados em repouso e em trânsito, com
  controle de permissão por papel.
- **Consentimentos separados e revogáveis** para gravação, processamento por IA
  e conteúdo entregue ao paciente.
- **Pseudonimização antes da IA:** o provedor de IA recebe uma referência opaca
  e estável do paciente, nunca nome, contato, documento ou data de nascimento.
- **Áudio não é acervo:** a gravação da consulta é descartada em até 72h e a transcrição em 90 dias. Só o prontuário aprovado persiste. (Detalhe na
  seção 1.)
- Registros de auditoria nunca carregam nome, e-mail, telefone, CPF,
  transcrição ou nota clínica.
- **Nenhuma decisão clínica é automatizada.** A IA gera rascunhos e sugestões;
  toda conduta exige aprovação humana explícita.

---

## 15. O que a plataforma deliberadamente **não** faz

- **Lista de espera e preenchimento automático de horários cancelados.** O
  produto não mantém fila de pacientes nem envia ofertas automáticas para ocupar vagas liberadas. A prioridade é inteligência clínica e acompanhamento
  terapêutico, não maximização de ocupação de agenda.
- **Diagnóstico automático.** Nenhum indicador de risco vira diagnóstico,
  conduta ou mensagem sem um profissional no meio.
- **Resposta inventada sobre o histórico.** Sem evidência, o sistema informa
  que não encontrou.

---

## 16. Como o Thats Life se posiciona no mercado

| | PsicoManager | PersonCare | SimplePractice | **Thats Life** |
| :--- | :--- | :--- | :--- | :--- |
| Foco | ERP de gestão clássico | Gestão + app simples | Prontuário eletrônico EUA | **Inteligência clínica e automação em 1 clique** |
| Prontuário por IA | Rascunho manual | Transcrição simples | Transcrição de nota | **SOAP automatizado com aprovação humana** |
| App do paciente | Genérico / web | Humor e hábitos | Portal básico | **App nativo: humor, hábitos, tarefas, escalas** |
| WhatsApp | Proprietário | Ilimitado | Não suporta | **Nativo, com proteção de conteúdo clínico** |
| Supervisão | Genérico | Não focado | Grupos simples | **Anonimização por IA + painel do supervisor** |
| Fiscal brasileiro | NFSe, Receita Saúde | NFSe, Receita Saúde | Não atende o Brasil | **Pix, Asaas, NFSe, Receita Saúde** |

**A tese:** o PsicoManager tem mais de 75 funcionalidades soltas e uma interface
poluída. O Thats Life concentra o fluxo de atendimento em uma tela só.

---

## 17. Estado atual de cada área

A plataforma opera em **modo demonstração**: as funcionalidades funcionam de
verdade, sobre dados fictícios. A distinção que importa é entre o que executa a
lógica real e o que apenas parece executá-la.

| Área | Situação |
| :--- | :--- |
| Regras clínicas, financeiras, agenda, identidade e prontuário | Implementadas e testadas (85 testes) |
| Automação pós-sessão de ponta a ponta | Funcional |
| Interfaces web e mobile | Navegáveis |
| **Geração de SOAP por IA** | **Real.** Claude redige o rascunho a partir da transcrição. Requer `AI_PROVIDER_API_KEY` |
| **Copiloto de sessão** | **Real.** Responde sobre a transcrição acumulada até o instante da consulta. Requer `AI_PROVIDER_API_KEY` |
| **Diarização (quem falou o quê)** | **Real.** Identificação de profissional e paciente com calibração |
| Áudio da consulta | Não capturado. As falas vêm de transcrições de demonstração |
| Painel operacional consolidado | API funcional; ainda não possui uma página dedicada na interface |
| WhatsApp (Evolution API) | Adaptador de demonstração: registra a mensagem numa caixa de saída, **não envia** |
| Notificações push e e-mail | Contratos, preferências e modelos definidos; adaptadores reais pendentes |
| Pagamentos (Asaas / Pix) | Adaptador de demonstração: gera cobrança e código Pix marcados como sem valor, **não movimenta dinheiro** |
| Persistência | Arquivo local. O estado sobrevive a reinícios; ainda não é banco de dados |
| Autenticação | Resolvida por cabeçalhos de demonstração; não é autenticação real |
| Descarte automático de áudio e transcrição | Política definida e centralizada; rotina de expurgo ainda não implementada |
| Google Calendar | Contrato definido, adaptador pendente |
| Supervisão clínica | Especificada; implementação pendente |
| Exportação de prontuário em PDF | Controle visual existente; geração e download ainda não implementados |

**Por que WhatsApp e pagamentos continuam falsos por escolha:** mensagem enviada
e cobrança criada são irreversíveis. Uma demonstração não deve produzir efeitos
no mundo de ninguém. Os adaptadores respeitam os mesmos contratos dos reais e
são determinísticos — repetir a operação devolve o mesmo identificador, que é
exatamente o que a idempotência real precisa garantir.

> ⚠️ Por estar em fase de protótipo, a plataforma **não deve receber dados
> clínicos reais** no estado atual.
