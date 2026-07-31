export interface GeneratedSoapResult {
  sessionId: string;
  transcricaoAudio: string;
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
  resumoPacienteSugerido: string;
  tarefasPacientes: string[];
  valorSessao: number;
  chavePix: string;
}

export async function processAudioToSoap(
  patientId: string,
  patientName: string,
  audioDurationSeconds: number
): Promise<GeneratedSoapResult> {
  // Simula o tempo de inferência de IA (1.2s para ótima UX)
  await new Promise((resolve) => setTimeout(resolve, 1200));

  return {
    sessionId: `demo-${patientId}-${audioDurationSeconds}`,
    transcricaoAudio: `Sessão gravada (${Math.floor(audioDurationSeconds / 60)}min ${audioDurationSeconds % 60}s). Paciente ${patientName} relata episódio de ansiedade acentuada na terça-feira no ambiente corporativo durante apresentação de metas. Relata sudorese, taquicardia e pensamento automático de insuficiência. Afirma que utilizou a técnica de respiração diafragmática treinada na sessão anterior, conseguindo mitigar o pico em 15 minutos. Discutido também a dificuldade de estabelecer limites com a gerência.`,
    subjetivo: `Paciente expressa sensação de sobrecarga profissional. Relata crise de ansiedade durante reunião de apresentação na última terça-feira. Sentiu insatisfação e receio de desaprovação por parte da liderança. Destaca que a técnica de respiração diafragmática ajudou a conter os sintomas físicos do ataque de pânico em ~15min.`,
    objetivo: `A transcrição registra discurso articulado e relato consistente de oscilação de ansiedade ao relembrar a apresentação. Contato visual, postura, linguagem corporal e sinais vitais não são observáveis na fonte de áudio e devem ser preenchidos pelo profissional apenas se verificados durante a sessão.`,
    avaliacao: `Evolução favorável quanto à adesão e eficácia das estratégias de regulação fisiológica pré-adquiridas. Persistem crenças centrais de desvalia e medo do julgamento alheio em situações de exposição corporativa. Boa capacidade de metacognição e autocompaixão em desenvolvimento.`,
    plano: `1. Treino em assertividade e comunicação não-violenta para alinhamento de expectativas com a gestão.\n2. Manutenção do diário de pensamentos automáticos (RPD) no App Mobile.\n3. Registro diário de humor no App.\n4. Próxima consulta agendada para semana que vem.`,
    resumoPacienteSugerido: `Nesta sessão vocês trabalharam estratégias para lidar com a ansiedade em situações profissionais, reconhecer limites na rotina e fortalecer formas mais assertivas de comunicação.`,
    tarefasPacientes: [
      '📝 Preencher RPD diário ao perceber gatilhos de ansiedade',
      '🧘 Praticar 10 min de respiração diafragmática ao acordar',
      '✉️ Escrever rascunho de e-mail de alinhamento de demandas com a gerência'
    ],
    valorSessao: 250,
    chavePix: '00020126580014BR.GOV.BCB.PIX0136thatslife-pix-key5204000053039865406250.005802BR5925THATS LIFE PSICOLOGIA6009SAO PAULO62070503***6304E2B6'
  };
}
