/**
 * Thats Life (TL - Psi) Core Package
 * Exportações completas de tipos, modelos, motor de IA SOAP, Evolution API, Anonimizador e Catálogo Psicométrico (17 Domínios).
 */

export interface Paciente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  dataNascimento?: string;
  dataInicioTratamento: string;
}

export interface ProntuarioSOAP {
  id: string;
  pacienteId: string;
  psicologoId: string;
  dataSessao: string;
  subjetivo: string;   // Relato do paciente, queixas e sentimentos
  objetivo: string;     // Observações clínicas do profissional
  avaliacao: string;    // Análise técnica, hipóteses e evolução
  plano: string;        // Condutas, intervenções e tarefas passadas
  tarefasExtraidas: string[];
  aprovadoEm?: string;
}

export interface RegistroHumor {
  id: string;
  pacienteId: string;
  data: string;
  nivelHumor: 1 | 2 | 3 | 4 | 5; // 1 = Muito Mal, 5 = Excelente
  emocoes: string[];
  notas?: string;
}

export * from './anonymizer';
export * from './evolutionApi';
export * from './soapEngine';
export * from './assessments';
export * from './assessmentAiInterpreter';
export * from './assessmentsCatalog';
export * from './assessmentWorkflow';
export * from './patientHandoff';
export * from './financial';
export * from './identity';
export * from './clinicalSession';
export * from './clinicalRecord';
export * from './scheduling';
export * from './communication';
export * from './clinicalTimeline';

// Viver Mais Psicologia Core Domain
export * from './viverMaisTypes';
export * from './viverMaisMatchingEngine';
export * from './viverMaisAsaasService';
