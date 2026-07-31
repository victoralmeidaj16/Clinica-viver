/**
 * Catálogo Geral de Avaliações Psicométricas & Escalas Clínicas (17 Domínios)
 * Inclui instrumentos padrão-ouro para TCC, TDAH, Autismo, TOC, Burnout e Risco de Suicídio.
 */

export type ClinicalDomain =
  | 'Ansiedade'
  | 'Depressão'
  | 'Estresse'
  | 'Qualidade de Vida'
  | 'Sono'
  | 'TDAH'
  | 'Autismo'
  | 'TOC'
  | 'Personalidade'
  | 'Humor'
  | 'Burnout'
  | 'Substâncias'
  | 'Alimentação'
  | 'Cognição'
  | 'Trauma'
  | 'Risco de Suicídio'
  | 'Funcionamento Geral';

export interface CatalogInstrument {
  code: string; // Ex: 'DASS-21', 'ASRS v1.1', 'C-SSRS'
  title: string;
  domain: ClinicalDomain;
  purpose: string;
  itemsCount: number;
  applicationMode: 'Autorrelato Pré-Sessão' | 'Aplicação pelo Profissional' | 'Entrevista Diagnóstica';
  isTccRecommended: boolean;
  isHighRiskProtocol?: boolean;
}

export const PSYCHOMETRIC_CATALOG: CatalogInstrument[] = [
  // 1. Ansiedade
  { code: 'BAI', title: 'Inventário de Ansiedade de Beck', domain: 'Ansiedade', purpose: 'Intensidade da ansiedade física e cognitiva', itemsCount: 21, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'GAD-7', title: 'Escala de Ansiedade Generalizada', domain: 'Ansiedade', purpose: 'Triagem para Transtorno de Ansiedade Generalizada', itemsCount: 7, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'STAI / IDATE', title: 'Inventário de Ansiedade Traço-Estado', domain: 'Ansiedade', purpose: 'Avaliação de ansiedade situacional (estado) e disposicional (traço)', itemsCount: 40, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'OASIS', title: 'Overall Anxiety Severity and Impairment Scale', domain: 'Ansiedade', purpose: 'Gravidade e prejuízo funcional da ansiedade', itemsCount: 5, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },

  // 2. Depressão
  { code: 'BDI-II', title: 'Inventário de Depressão de Beck', domain: 'Depressão', purpose: 'Mensuração da gravidade da depressão', itemsCount: 21, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'PHQ-9', title: 'Patient Health Questionnaire-9', domain: 'Depressão', purpose: 'Triagem rápida e seguimento da depressão', itemsCount: 9, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'CES-D', title: 'Center for Epidemiologic Studies Depression Scale', domain: 'Depressão', purpose: 'Rastreio de sintomas depressivos na população geral', itemsCount: 20, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'HAM-D', title: 'Escala de Depressão de Hamilton', domain: 'Depressão', purpose: 'Avaliação clínica da gravidade da depressão', itemsCount: 17, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: false },

  // 3. Estresse
  { code: 'DASS-21', title: 'Depression Anxiety Stress Scales', domain: 'Estresse', purpose: 'Triagem tripartida de Depressão, Ansiedade e Estresse', itemsCount: 21, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'PSS', title: 'Perceived Stress Scale (Escala de Estresse Percebido)', domain: 'Estresse', purpose: 'Grau em que situações da vida são avaliadas como estressantes', itemsCount: 14, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'ISSL', title: 'Inventário de Sintomas de Stress de Lipp', domain: 'Estresse', purpose: 'Diagnóstico de estresse e suas fases (Alerta, Resistência, Exaustão)', itemsCount: 37, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: false },

  // 4. Qualidade de Vida
  { code: 'WHOQOL-BREF', title: 'Questionário de Qualidade de Vida da OMS', domain: 'Qualidade de Vida', purpose: 'Domínios físico, psicológico, relações sociais e meio ambiente', itemsCount: 26, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'SF-36', title: 'Medical Outcomes Study 36-Item Short-Form', domain: 'Qualidade de Vida', purpose: 'Avaliação do estado geral de saúde e capacidade funcional', itemsCount: 36, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },

  // 5. Sono
  { code: 'PSQI', title: 'Índice de Qualidade do Sono de Pittsburgh', domain: 'Sono', purpose: 'Qualidade e distúrbios do sono no último mês', itemsCount: 19, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'ISI', title: 'Índice de Gravidade da Insônia', domain: 'Sono', purpose: 'Percepção da gravidade da insônia e impacto diurno', itemsCount: 7, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'ESS', title: 'Escala de Sonolência de Epworth', domain: 'Sono', purpose: 'Probabilidade de cochilar em situações do cotidiano', itemsCount: 8, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },

  // 6. TDAH
  { code: 'ASRS v1.1', title: 'Adult ADHD Self-Report Scale', domain: 'TDAH', purpose: 'Triagem de sintomas de TDAH em adultos (Inatenção e Hiperatividade)', itemsCount: 18, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'DIVA-5', title: 'Entrevista Diagnóstica para TDAH em Adultos', domain: 'TDAH', purpose: 'Investigação estruturada de critérios DSM-5 para TDAH', itemsCount: 18, applicationMode: 'Entrevista Diagnóstica', isTccRecommended: false },
  { code: 'SNAP-IV', title: 'Escala SNAP-IV para Crianças e Adolescentes', domain: 'TDAH', purpose: 'Rastreio de TDAH e Transtorno Opositor Desafiante (TOD)', itemsCount: 26, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },

  // 7. Autismo
  { code: 'AQ', title: 'Autism Spectrum Quotient', domain: 'Autismo', purpose: 'Quociente do Espectro Autista em adultos com inteligência preservada', itemsCount: 50, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'RAADS-R', title: 'Ritvo Autism Asperger Diagnostic Scale-Revised', domain: 'Autismo', purpose: 'Auxílio no diagnóstico de autismo em adultos', itemsCount: 80, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'M-CHAT-R/F', title: 'Modified Checklist for Autism in Toddlers', domain: 'Autismo', purpose: 'Rastreio precoce de autismo em crianças de 16 a 30 meses', itemsCount: 20, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: false },

  // 8. TOC
  { code: 'Y-BOCS', title: 'Escala Obsessivo-Compulsiva de Yale-Brown', domain: 'TOC', purpose: 'Gravidade de obsessões e compulsões', itemsCount: 10, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: true },
  { code: 'OCI-R', title: 'Obsessive-Compulsive Inventory-Revised', domain: 'TOC', purpose: 'Gravidade dos sintomas obsessivos em 6 subescalas', itemsCount: 18, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },

  // 9. Personalidade
  { code: 'PID-5', title: 'Inventário de Personalidade para o DSM-5', domain: 'Personalidade', purpose: 'Avaliação de traços desadaptativos de personalidade', itemsCount: 220, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'BFP', title: 'Bateria Fatorial de Personalidade', domain: 'Personalidade', purpose: 'Avaliação dos cinco grandes fatores (Big Five) no Brasil', itemsCount: 126, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: false },

  // 10. Humor
  { code: 'MDQ', title: 'Mood Disorder Questionnaire', domain: 'Humor', purpose: 'Rastreio de Transtorno do Espectro Bipolar', itemsCount: 13, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'HCL-32', title: 'Hypomania Checklist-32', domain: 'Humor', purpose: 'Detecção de sintomas hipomaníacos prévios', itemsCount: 32, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },

  // 11. Burnout
  { code: 'MBI', title: 'Maslach Burnout Inventory', domain: 'Burnout', purpose: 'Exaustão emocional, despersonalização e realização profissional', itemsCount: 22, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'CBI', title: 'Copenhagen Burnout Inventory', domain: 'Burnout', purpose: 'Burnout pessoal, relacionado ao trabalho e aos clientes', itemsCount: 19, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },

  // 12. Uso de Substâncias
  { code: 'AUDIT', title: 'Alcohol Use Disorders Identification Test', domain: 'Substâncias', purpose: 'Rastreio do uso nocivo e dependência de álcool', itemsCount: 10, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
  { code: 'ASSIST', title: 'Alcohol, Smoking and Substance Involvement Test', domain: 'Substâncias', purpose: 'Triagem de uso de álcool, tabaco e outras drogas (OMS)', itemsCount: 8, applicationMode: 'Entrevista Diagnóstica', isTccRecommended: false },

  // 13. Alimentação
  { code: 'EAT-26', title: 'Eating Attitudes Test-26', domain: 'Alimentação', purpose: 'Rastreio de atitudes alimentares anômalas e anoréxicas', itemsCount: 26, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'BES', title: 'Escala de Compulsão Alimentar Periódica', domain: 'Alimentação', purpose: 'Gravidade de episódios de compulsão alimentar', itemsCount: 16, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },

  // 14. Função Cognitiva
  { code: 'MoCA', title: 'Montreal Cognitive Assessment', domain: 'Cognição', purpose: 'Rastreio rápido para declínio cognitivo leve', itemsCount: 30, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: false },
  { code: 'MEEM', title: 'Mini Exame do Estado Mental', domain: 'Cognição', purpose: 'Avaliação rastreadora do estado cognitivo global', itemsCount: 30, applicationMode: 'Aplicação pelo Profissional', isTccRecommended: false },

  // 15. Trauma
  { code: 'PCL-5', title: 'PTSD Checklist for DSM-5', domain: 'Trauma', purpose: 'Rastreio e monitoramento de sintomas de TEPT', itemsCount: 20, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'CAPS-5', title: 'Clinician-Administered PTSD Scale for DSM-5', domain: 'Trauma', purpose: 'Entrevista estruturada padrão-ouro para TEPT', itemsCount: 30, applicationMode: 'Entrevista Diagnóstica', isTccRecommended: false },

  // 16. Risco de Suicídio (Urgência)
  {
    code: 'C-SSRS',
    title: 'Escala de Avaliação de Risco de Suicídio de Columbia',
    domain: 'Risco de Suicídio',
    purpose: 'Avaliação quantitativa de ideação e comportamento suicida',
    itemsCount: 6,
    applicationMode: 'Entrevista Diagnóstica',
    isTccRecommended: true,
    isHighRiskProtocol: true,
  },
  {
    code: 'BSSI',
    title: 'Escala de Ideação Suicida de Beck',
    domain: 'Risco de Suicídio',
    purpose: 'Intensidade de pensamentos e planos autolesivos',
    itemsCount: 19,
    applicationMode: 'Aplicação pelo Profissional',
    isTccRecommended: true,
    isHighRiskProtocol: true,
  },

  // 17. Funcionamento Geral
  { code: 'CORE-OM', title: 'Clinical Outcomes in Routine Evaluation-Outcome Measure', domain: 'Funcionamento Geral', purpose: 'Mensuração global do progresso e bem-estar em psicoterapia', itemsCount: 34, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'OQ-45', title: 'Outcome Questionnaire-45.2', domain: 'Funcionamento Geral', purpose: 'Acompanhamento longitudinal de sintomas e funcionamento interpessoal', itemsCount: 45, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: true },
  { code: 'WHODAS 2.0', title: 'WHO Disability Assessment Schedule 2.0', domain: 'Funcionamento Geral', purpose: 'Avaliação de incapacidade funcional em 6 domínios de vida', itemsCount: 36, applicationMode: 'Autorrelato Pré-Sessão', isTccRecommended: false },
];
