# Levantamento de Requisitos e Ajustes — Reunião de Alinhamento (Plataforma Viver Mais / TL - Psi)

Documento elaborado a partir da transcrição de reunião de alinhamento operacional e de produto, consolidando todas as solicitações, melhorias e novos requisitos apontados pela equipe de gestão da clínica.

---

## 1. Indicadores de resultados
- **Na pagina de indicadores de resultados** já existe um campo para modalidade, nesta modalidade poderá ser selecionado uma modalidade de atendimento (ex: Atendimento Psicológico, Atendimento Acessível, Atendimento Particular, Avaliação Psicológica, Orientação Profissional/Vocacional, etc.).


## 2. formulario de cadastrar psicologos
- **No formulario de cadastrar psicologos:** habilitar um campo para o psicologo cadastrar quais tipos de atendimentos ele oferece, e o qual o curso de Pós-Graduação que ele faz na Viver Mais Psicologia, e ter um campo para ele se ele tiver outra pós-graduação para ele clicar e ira abrir a lista de pós-graduações que ele tem, e ele pode escolher quantas pós-graduações ele tiver.

- **Vínculo de Serviços aos Psicólogos:** Permitir atribuir quais serviços e modalidades cada psicólogo está habilitado/interessado em atender.

- **Métricas e Relatórios por Modalidade:**
  - Distribuição das sessões realizadas no mês por tipo de serviço prestado.

- **Upload de Fotos:** Adicionar campo para upload de foto de perfil (psicólogos e pacientes).
- **Nome Social:** Adicionar campo explícito de "Nome Social" nos formulários de cadastro e triagem, garantindo prioridade de exibição.
- **Turma / Vínculo Acadêmico (Alunos/Egressos):**
  - Adicionar campo para selecionar a turma do profissional (ex: Turma 23A, 23B, 24A, 25B, etc.).
  - Indicação se o profissional é aluno/egresso dos cursos da clínica (ex: Especialização, Avaliação Psicológica).

---

## 3. Gestão de Profissionais e Controle de Vitrine/Rodízio
- **Ativação / Desativação de Perfil (Toggle Manual):**
  - Painel administrativo com chave manual para ativar/desativar o perfil de psicólogos diariamente.
  - Motivos: Profissionais que atingiram o limite de pacientes (ex: 5 pessoas), solicitações de pausa, férias ou desativações administrativas.
- **Integração com Rodízio Inteligente (Matching Engine):**
  - O sistema de triagem/rodízio deve filtrar apenas os profissionais habilitados para o serviço específico escolhido pelo paciente.
  - *Exemplo:* Se o próximo da fila do rodízio geral não realiza "Avaliação Psicológica", o sistema deve ignorar este profissional e alocar o próximo da fila que possua essa habilitação.
- **Gestão de Dados e Correção Visual:**
  - Permissão para a administração incluir cadastros de psicologos, editar/corrigir dados cadastrados pelos profissionais (ex: fotos, erros de digitação/ortografia/gramática na bio/apresentação).

---


- **Exibição na Vitrine Publica (Carrossel):**
  - Exibir no carrossel da vitrine: Foto, Nome/Nome Social, Número de CRP, Cursos de Especialização e Modalidades de Atendimento nas quais está habilitado.

---

## 4. Gestão de Pacientes, Status e Fluxo Clínico
- **Ampliação das Opções de Status do Paciente:**
  - Ao alterar o status do paciente no painel (ex: marcar como *Desistente*, *Em Férias*, *Encaminhado*, *Em Acompanhamento*), o sistema deve abrir campos dinâmicos complementares (ex: motivo da desistência, período de pausa, observações).


---

## 5. Integração com Asaas (Cobranças & Chave API)
- **Integração Financeira (Asaas):**
  - Validação e sincronização do token/chave API do Asaas (a ser fornecido pela equipe) para geração de cobranças automáticas pós-sessão e gestão financeira da clínica.

---

## 📊 Matriz de Priorização Recomendada

| Requisito / Funcionalidade | Módulo | Impacto | Complexidade |
| :--- | :--- | :--- | :--- |
| **Ativar/Desativar perfil manual no rodízio** | `apps/web` / Gestão | 🔥 Alto | Baixa |
| **Filtro de modalidade/serviço no rodízio (Matching Engine)** | `packages/core` | 🔥 Alto | Média |
| **Campos de Nome Social, Turma e Foto no cadastro** | `apps/web` & Core | 🟡 Médio | Baixa |
| **Campos complementares na mudança de status do paciente** | `apps/web` / Cockpit | 🟡 Médio | Baixa |
| **Página/Painel de Cadastro de Serviços e Preços** | `apps/web` / Gestão | 🟡 Médio | Média |
| **Relatórios de atendimento por modalidade (Acessível/Particular)** | `apps/web` / Relatórios | 🟢 Normal | Média |
